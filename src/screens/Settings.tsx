import { useRef, useState } from 'react';
import type { AppState, Profile } from '../types';
import { exerciseName, exportJson, getState, replaceState, update, useAppState } from '../lib/store';
import { nowISO, todayISO } from '../lib/util';
import { ask, askText, go, Help, Icon, NumInput, Segmented, Sheet, TopBar, toast } from '../components/ui';
import { seedDemoData } from '../lib/demo';
import { connectDrive, disconnectDrive, listSnapshots, restoreSnapshot, syncNow, useSyncState, type SnapshotInfo, type SyncStatus } from '../lib/sync';

function relTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

const STATUS_CLASS: Record<SyncStatus, string> = { disconnected: 'muted', idle: 'muted', syncing: 'muted', synced: 'good', error: 'bad', reconnect: 'warn' };

function CloudSyncCard() {
  const sync = useSyncState();
  const [busy, setBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const statusText =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'reconnect'
        ? 'Reconnect needed'
        : sync.status === 'error'
          ? `Sync failed${sync.error ? `: ${sync.error}` : ''}`
          : sync.lastSyncedAt
            ? `Synced ${relTime(sync.lastSyncedAt)}`
            : 'Not synced yet';

  return (
    <>
      <div className="title-row">
        <h2 style={{ margin: 0 }}>Cloud sync</h2>
        <Help title="Cloud sync">
          <p>Backs up and merges your log with the others — a workout added on one device and a bodyweight entry added on another both end up on both.</p>
          <p>Data goes into a hidden folder in your own Google Drive that only this app can see. Your Anthropic API key (Coach) is never included.</p>
          <p>The last 7 daily snapshots are kept in Drive, so you can roll back a bad sync from Restore snapshot.</p>
          <p>There's no password-free "stay signed in forever" here — if Google says this device's access has expired, you'll see Reconnect; one tap fixes it.</p>
        </Help>
      </div>
      <div className="card">
        {sync.status === 'disconnected' ? (
          <>
            <p className="small muted">Not connected.</p>
            <button className="btn-primary btn-block" disabled={busy} onClick={() => run(connectDrive)}>
              {busy ? 'Connecting…' : 'Connect Google Drive'}
            </button>
          </>
        ) : (
          <>
            <div className="row between">
              <span className={`status ${STATUS_CLASS[sync.status]}`}>{statusText}</span>
            </div>
            <div className="grid2" style={{ marginTop: 10 }}>
              {sync.status === 'reconnect' ? (
                <button className="btn-primary" disabled={busy} onClick={() => run(connectDrive)}>
                  Reconnect
                </button>
              ) : (
                <button disabled={busy || sync.status === 'syncing'} onClick={() => run(syncNow)}>
                  Sync now
                </button>
              )}
              <button disabled={busy} onClick={() => run(async () => setSnapshots(await listSnapshots()))}>
                Restore snapshot…
              </button>
            </div>
            <button
              className="btn-block btn-danger"
              style={{ marginTop: 10 }}
              onClick={async () => {
                if (await ask('Disconnect Google Drive? Your data stays, but it will stop backing up automatically.', { confirmLabel: 'Disconnect', danger: true })) disconnectDrive();
              }}
            >
              Disconnect
            </button>
          </>
        )}
      </div>
      {snapshots && (
        <Sheet title="Restore snapshot" onClose={() => setSnapshots(null)}>
          {!snapshots.length && <p className="small muted">No snapshots yet.</p>}
          <div className="list">
            {snapshots.map((s) => (
              <div key={s.fileId} className="row between list-item">
                <span>{s.date}</span>
                <button
                  className="btn-sm"
                  onClick={async () => {
                    if (!(await ask(`Replace all current data with the ${s.date} snapshot?`, { confirmLabel: 'Restore', danger: true }))) return;
                    await run(async () => {
                      replaceState(await restoreSnapshot(s.fileId));
                      toast('Snapshot restored');
                      setSnapshots(null);
                    });
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function More() {
  const s = useAppState();
  const items = [
    { to: '/tools', icon: 'calc', label: 'Calculators', sub: '1RM, RPE, Wilks/DOTS, plates, meet attempts' },
    { to: '/history', icon: 'history', label: 'Workout history', sub: `${s.workouts.length} sessions` },
    { to: '/body', icon: 'scale', label: 'Bodyweight tracker', sub: `${s.bodyweight.length} entries` },
    { to: '/strength', icon: 'body', label: 'Strength profile & muscle map', sub: 'Standards, levels, imbalances' },
    { to: '/share', icon: 'share', label: 'Share best lifts', sub: 'Image card or text' },
    { to: '/exercises', icon: 'search', label: 'Exercise library', sub: 'Variations, records, history' },
    { to: '/settings', icon: 'settings', label: 'Settings & backup', sub: 'Profile, plates, export / import' },
  ];
  return (
    <div>
      <TopBar title="More" />
      <div className="card tight">
        <div className="list">
          {items.map((i) => (
            <button key={i.to} className="list-item" onClick={() => go(i.to)}>
              <Icon name={i.icon} />
              <div className="grow">
                <div className="bold">{i.label}</div>
                <div className="small muted">{i.sub}</div>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const s = useAppState();
  const p = s.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Profile>) => update((st) => ({ ...st, profile: { ...st.profile, ...patch, updatedAt: nowISO() } }));
  const theme = (document.documentElement.dataset.theme as 'light' | 'dark' | undefined) ?? 'auto';

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `strength-tracker-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (src: File | string) => {
    try {
      const data = JSON.parse(typeof src === 'string' ? src : await src.text()) as AppState;
      if (!Array.isArray(data.workouts) || !data.profile) throw new Error('bad file');
      if (!(await ask(`Replace all current data with this backup (${data.workouts.length} workouts)?`, { confirmLabel: 'Replace', danger: true }))) return;
      replaceState(data);
      toast('Backup restored');
    } catch {
      toast('That file is not a valid backup');
    }
  };

  const exportCsv = () => {
    const st = getState();
    const rows = [['date', 'workout', 'exercise', 'set_type', 'weight_kg', 'reps', 'rpe', 'bodyweight_kg']];
    const name = (id: string) => exerciseName(id, st);
    for (const w of st.workouts)
      for (const e of w.exercises) for (const x of e.sets) rows.push([w.startedAt, w.name, name(e.exerciseId), x.kind, String(x.weight), String(x.reps), x.rpe !== undefined ? String(x.rpe) : '', w.bodyweight ? String(w.bodyweight) : '']);
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `strength-tracker-sets-${todayISO()}.csv`;
    a.click();
  };

  return (
    <div>
      <TopBar title="Settings" backTo="/more" />
      <h2>Profile</h2>
      <div className="card">
        <label className="field">
          <span>Name (shown on share cards)</span>
          <input value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="grid2">
          <label className="field">
            <span>Sex (for standards & points)</span>
            <Segmented value={p.sex} onChange={(v) => set({ sex: v })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          </label>
          <label className="field">
            <span>Birth year</span>
            <NumInput value={p.birthYear} onChange={(v) => set({ birthYear: v ? Math.round(v) : undefined })} />
          </label>
        </div>
      </div>

      <h2>Training</h2>
      <div className="card">
        <div className="grid2">
          <label className="field">
            <span>Bar weight (kg)</span>
            <NumInput value={p.barWeight} onChange={(v) => set({ barWeight: v ?? 20 })} />
          </label>
          <label className="field">
            <span>Round loads to (kg)</span>
            <select value={p.rounding} onChange={(e) => set({ rounding: parseFloat(e.target.value) })}>
              {[0.5, 1, 1.25, 2.5, 5].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Default rest</span>
            <select value={p.defaultRest} onChange={(e) => set({ defaultRest: parseInt(e.target.value) })}>
              {[60, 90, 120, 150, 180, 240, 300].map((r) => (
                <option key={r} value={r}>
                  {Math.floor(r / 60)}:{String(r % 60).padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>e1RM formula (no RPE)</span>
            <select value={p.e1rmFormula} onChange={(e) => set({ e1rmFormula: e.target.value as Profile['e1rmFormula'] })}>
              <option value="epley">Epley</option>
              <option value="brzycki">Brzycki</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Plates available (kg, per side)</span>
          <input
            defaultValue={p.plates.join(', ')}
            onBlur={(e) => {
              const plates = e.target.value
                .split(/[ ,;]+/)
                .map((x) => parseFloat(x.replace(',', '.')))
                .filter((x) => x > 0);
              if (plates.length) set({ plates });
            }}
          />
        </label>
      </div>

      <h2>Appearance</h2>
      <div className="card">
        <Segmented
          value={theme}
          onChange={(v) => {
            try {
              if (v === 'auto') localStorage.removeItem('theme');
              else localStorage.setItem('theme', v);
            } catch {
              /* ignore */
            }
            if (v === 'auto') delete document.documentElement.dataset.theme;
            else document.documentElement.dataset.theme = v;
            update((st) => ({ ...st }));
          }}
          options={[{ value: 'auto', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        />
      </div>

      <CloudSyncCard />

      <h2>Your data</h2>
      <div className="card">
        <p className="small muted">A one-off manual backup, on top of Cloud sync above.</p>
        <div className="grid2" style={{ marginTop: 8 }}>
          <button onClick={doExport}>Export backup</button>
          <button onClick={() => fileRef.current?.click()}>Import backup</button>
          <button onClick={exportCsv}>Export sets (CSV)</button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(exportJson());
                toast('Backup copied — paste it into a note or email to yourself');
              } catch {
                toast('Clipboard not available here — use Export backup');
              }
            }}
          >
            Copy backup text
          </button>
          <button
            onClick={async () => {
              const t = await askText('Paste the backup text you copied earlier:');
              if (t?.trim()) doImport(t);
            }}
          >
            Restore from text
          </button>
          <button
            onClick={async () => {
              if (s.workouts.length && !(await ask('Add ~16 weeks of demo training data to your log?', { confirmLabel: 'Add demo data' }))) return;
              seedDemoData();
              toast('Demo data added');
            }}
          >
            Load demo data
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <button
          className="btn-block btn-danger"
          style={{ marginTop: 10 }}
          onClick={async () => {
            if ((await ask('Delete ALL workouts, programs and bodyweight entries? This cannot be undone.', { confirmLabel: 'Delete everything', danger: true })) && (await ask('Really delete everything?', { confirmLabel: 'Yes, delete', danger: true }))) {
              replaceState({
                ...getState(),
                workouts: [],
                programs: [],
                bodyweight: [],
                customExercises: [],
                manualMaxes: {},
                manualMaxUpdatedAt: {},
                diagnoses: {},
                coachChat: [],
                nutrition: [],
                goals: undefined,
                goalsUpdatedAt: nowISO(),
                activeWorkout: undefined,
                activeProgram: undefined,
                activeProgramUpdatedAt: nowISO(),
                tombstones: [],
              });
              toast('All data deleted');
            }
          }}
        >
          Delete all data
        </button>
      </div>
    </div>
  );
}
