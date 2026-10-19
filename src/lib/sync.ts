// Orchestrates cloud sync: connect / sync now / auto sync are all the same algorithm
// (download the remote backup if any, merge with local, write both back), triggered by
// edits (debounced), app open, foreground, and reconnecting to the network.
import { useSyncExternalStore } from 'react';
import type { AppState } from '../types';
import { getState, onStateChange, replaceState } from './store';
import { mergeAppState } from './merge';
import * as defaultAuth from './googleAuth';
import * as defaultDrive from './googleDrive';
import { ReconnectRequiredError } from './googleAuth';
import { nowISO, todayISO } from './util';

export { ReconnectRequiredError };

type AuthBackend = Pick<typeof defaultAuth, 'isConnected' | 'connect' | 'disconnect' | 'getAccessToken'>;
type DriveBackend = Pick<typeof defaultDrive, 'findFile' | 'downloadFile' | 'upsertFile' | 'listFiles' | 'deleteFile'>;

let authBackend: AuthBackend = defaultAuth;
let driveBackend: DriveBackend = defaultDrive;

/** Swaps the Drive/auth implementation. Used only by the dev-mode mock bootstrap in main.tsx. */
export function setSyncBackend(auth: AuthBackend, drive: DriveBackend): void {
  authBackend = auth;
  driveBackend = drive;
}

const STATE_FILE = 'state.json';
const SNAPSHOT_PREFIX = 'snapshot-';
const KEEP_SNAPSHOTS = 7;
const DEBOUNCE_MS = 45_000;
const LAST_SYNCED_KEY = 'gdrive-last-synced-at';

export type SyncStatus = 'disconnected' | 'idle' | 'syncing' | 'synced' | 'error' | 'reconnect';
export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: string;
  error?: string;
}

function readLastSyncedAt(): string | undefined {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLastSyncedAt(iso: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, iso);
  } catch {
    /* storage unavailable */
  }
}

let syncState: SyncState = { status: authBackend.isConnected() ? 'idle' : 'disconnected', lastSyncedAt: readLastSyncedAt() };
const listeners = new Set<() => void>();

function setSyncState(patch: Partial<SyncState>): void {
  syncState = { ...syncState, ...patch };
  listeners.forEach((l) => l());
}

function subscribeSyncState(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSyncState(): SyncState {
  return syncState;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState);
}

let applyingRemote = false; // guards the change-listener against reacting to our own replaceState()
let syncing = false; // in-flight guard
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

async function writeSnapshotAndPrune(token: string, payload: string): Promise<void> {
  await driveBackend.upsertFile(token, `${SNAPSHOT_PREFIX}${todayISO()}.json`, payload);
  const files = await driveBackend.listFiles(token, SNAPSHOT_PREFIX);
  const toDelete = [...files].sort((a, b) => b.name.localeCompare(a.name)).slice(KEEP_SNAPSHOTS);
  for (const f of toDelete) await driveBackend.deleteFile(token, f.id);
}

export async function syncNow(): Promise<void> {
  if (syncing) return;
  if (!authBackend.isConnected()) {
    setSyncState({ status: 'disconnected' });
    return;
  }
  if (!navigator.onLine) {
    setSyncState({ status: 'error', error: 'Offline — will sync once back online.' });
    return;
  }
  syncing = true;
  setSyncState({ status: 'syncing', error: undefined });
  try {
    const token = await authBackend.getAccessToken();
    const local = getState();
    const remoteFile = await driveBackend.findFile(token, STATE_FILE);
    const merged = remoteFile ? mergeAppState(local, JSON.parse(await driveBackend.downloadFile(token, remoteFile.id)) as AppState) : local;

    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      applyingRemote = true;
      try {
        replaceState(merged);
      } finally {
        applyingRemote = false;
      }
    }

    const payload = JSON.stringify({ ...merged, activeWorkout: undefined });
    await driveBackend.upsertFile(token, STATE_FILE, payload);
    await writeSnapshotAndPrune(token, payload);

    const now = nowISO();
    writeLastSyncedAt(now);
    setSyncState({ status: 'synced', lastSyncedAt: now, error: undefined });
  } catch (e) {
    if (e instanceof ReconnectRequiredError) setSyncState({ status: 'reconnect', error: e.message });
    else setSyncState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  } finally {
    syncing = false;
  }
}

/**
 * Interactive connect. The real backend navigates the whole page away to Google and back
 * (see googleAuth.ts) — nothing after that call matters until the page reloads and initSync()
 * runs again. The dev-mock backend connects immediately in place, so the sync right after
 * still makes the UI feel responsive there.
 */
export async function connectDrive(): Promise<void> {
  authBackend.connect();
  setSyncState({ status: 'idle' });
  await syncNow();
}

export function disconnectDrive(): void {
  authBackend.disconnect();
  try {
    localStorage.removeItem(LAST_SYNCED_KEY);
  } catch {
    /* storage unavailable */
  }
  setSyncState({ status: 'disconnected', error: undefined, lastSyncedAt: undefined });
}

export interface SnapshotInfo {
  fileId: string;
  date: string;
  modifiedTime: string;
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const token = await authBackend.getAccessToken();
  const files = await driveBackend.listFiles(token, SNAPSHOT_PREFIX);
  return files
    .map((f) => ({ fileId: f.id, date: f.name.slice(SNAPSHOT_PREFIX.length, -'.json'.length), modifiedTime: f.modifiedTime }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Downloads a snapshot's content. The caller (Settings UI) confirms and calls replaceState(). */
export async function restoreSnapshot(fileId: string): Promise<AppState> {
  const token = await authBackend.getAccessToken();
  return JSON.parse(await driveBackend.downloadFile(token, fileId)) as AppState;
}

let initialized = false;

/** Wires up automatic sync: on load (if connected), after debounced edits, on foreground, on reconnecting to the network. */
export function initSync(): void {
  if (initialized) return;
  initialized = true;
  setSyncState({ status: authBackend.isConnected() ? 'idle' : 'disconnected', lastSyncedAt: readLastSyncedAt() });
  if (authBackend.isConnected()) syncNow();

  onStateChange(() => {
    if (applyingRemote || !authBackend.isConnected()) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncNow, DEBOUNCE_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  window.addEventListener('online', syncNow);
}
