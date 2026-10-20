// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, Workout } from '../../types';
import { DEFAULT_STATE, getState, loadState, replaceState } from '../store';

vi.mock('../googleAuth', async () => {
  const actual = await vi.importActual<typeof import('../googleAuth')>('../googleAuth');
  return {
    ...actual,
    isConnected: vi.fn(() => false),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(() => {}),
    getAccessToken: vi.fn(async () => 'token'),
  };
});

vi.mock('../googleDrive', () => ({
  findFile: vi.fn(async () => undefined),
  downloadFile: vi.fn(async () => '{}'),
  upsertFile: vi.fn(async () => ({ id: 'f1', name: 'state.json', modifiedTime: new Date().toISOString() })),
  listFiles: vi.fn(async () => []),
  deleteFile: vi.fn(async () => {}),
}));

const auth = await import('../googleAuth');
const drive = await import('../googleDrive');
const { ReconnectRequiredError } = auth;
const { connectDrive, disconnectDrive, getSyncState, initSync, listSnapshots, syncNow } = await import('../sync');

function workout(id: string, updatedAt: string): Workout {
  return { id, name: 'W', startedAt: updatedAt, finishedAt: updatedAt, updatedAt, exercises: [] };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('sync', () => {
  it('does nothing until local data has loaded (syncing first would merge against an empty state)', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    await syncNow();
    expect(drive.findFile).not.toHaveBeenCalled();
    await loadState(); // every later test runs with the store loaded, as the app does
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.isConnected).mockReturnValue(false); // each test opts in to being connected
    replaceState({ ...DEFAULT_STATE, workouts: [] });
    disconnectDrive(); // reset status to 'disconnected' between tests
    vi.clearAllMocks(); // disconnectDrive itself calls auth.disconnect(); don't count it
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('does nothing when not connected', async () => {
    await syncNow();
    expect(drive.findFile).not.toHaveBeenCalled();
    expect(getSyncState().status).toBe('disconnected');
  });

  it('connects and syncs, reporting a synced status', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    await connectDrive();
    expect(auth.connect).toHaveBeenCalledTimes(1);
    expect(drive.upsertFile).toHaveBeenCalledWith('token', 'state.json', expect.any(String));
    expect(getSyncState().status).toBe('synced');
    expect(getSyncState().lastSyncedAt).toBeTruthy();
  });

  it('merges an existing remote backup on first connect instead of overwriting it', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    replaceState({ ...DEFAULT_STATE, workouts: [workout('local-1', '2026-01-01T00:00:00.000Z')] });
    vi.mocked(drive.findFile).mockResolvedValue({ id: 'remote-file', name: 'state.json', modifiedTime: '' });
    const remote: AppState = { ...DEFAULT_STATE, workouts: [workout('remote-1', '2026-01-02T00:00:00.000Z')] };
    vi.mocked(drive.downloadFile).mockResolvedValue(JSON.stringify(remote));

    await syncNow();

    expect(getState().workouts.map((w) => w.id).sort()).toEqual(['local-1', 'remote-1']);
    const uploaded = vi.mocked(drive.upsertFile).mock.calls.find(([, name]) => name === 'state.json');
    expect(JSON.parse(uploaded![2] as string).workouts).toHaveLength(2);
  });

  it('reports a reconnect status when silent auth fails', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    vi.mocked(auth.getAccessToken).mockRejectedValueOnce(new ReconnectRequiredError('session expired'));
    await syncNow();
    expect(getSyncState().status).toBe('reconnect');
    expect(getSyncState().error).toBe('session expired');
  });

  it('reports a generic error status on a Drive API failure', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    vi.mocked(drive.findFile).mockRejectedValueOnce(new Error('boom'));
    await syncNow();
    expect(getSyncState().status).toBe('error');
    expect(getSyncState().error).toBe('boom');
  });

  it('skips syncing while offline and does not call the Drive API', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await syncNow();
    expect(drive.findFile).not.toHaveBeenCalled();
    expect(getSyncState().status).toBe('error');
  });

  it('prunes snapshots beyond the 7 most recent', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    const files = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, name: `snapshot-2026-01-${String(i + 1).padStart(2, '0')}.json`, modifiedTime: '' }));
    vi.mocked(drive.listFiles).mockResolvedValue(files);
    await syncNow();
    // keep the 7 newest by name (sorted descending) -> delete the 2 oldest: s0, s1
    expect(drive.deleteFile).toHaveBeenCalledTimes(2);
    const deletedIds = vi.mocked(drive.deleteFile).mock.calls.map(([, id]) => id);
    expect(deletedIds.sort()).toEqual(['s0', 's1']);
  });

  it('lists snapshots newest first', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    vi.mocked(drive.listFiles).mockResolvedValue([
      { id: 'a', name: 'snapshot-2026-01-01.json', modifiedTime: '' },
      { id: 'b', name: 'snapshot-2026-01-05.json', modifiedTime: '' },
    ]);
    const snaps = await listSnapshots();
    expect(snaps.map((s) => s.date)).toEqual(['2026-01-05', '2026-01-01']);
  });

  it('debounces repeated edits into one sync, and reacts to foreground/online', async () => {
    vi.mocked(auth.isConnected).mockReturnValue(true);
    initSync();
    await flush();
    await flush();
    vi.clearAllMocks();

    vi.useFakeTimers();
    replaceState({ ...DEFAULT_STATE, workouts: [] });
    replaceState({ ...DEFAULT_STATE, workouts: [] });
    replaceState({ ...DEFAULT_STATE, workouts: [] });
    expect(drive.findFile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(drive.findFile).toHaveBeenCalledTimes(1);
    vi.useRealTimers();

    vi.mocked(drive.findFile).mockClear();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(drive.findFile).toHaveBeenCalledTimes(1);

    vi.mocked(drive.findFile).mockClear();
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(drive.findFile).toHaveBeenCalledTimes(1);
  });
});
