import { useRef } from 'react';
import type { AppState, Profile } from '../types';
import { exerciseName, exportJson, getState, replaceState, update, useAppState } from '../lib/store';
import { todayISO } from '../lib/util';
import { ask, askText, go, Icon, NumInput, Segmented, TopBar, toast } from '../components/ui';
import { seedDemoData } from '../lib/demo';

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
  const set = (patch: Partial<Profile>) => update((st) => ({ ...st, profile: { ...st.profile, ...patch } }));
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
        <p className="tiny muted">Sets with an RPE use the RPE chart for e1RM; sets without use the formula above.</p>
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

      <h2>Your data</h2>
      <div className="card">
        <p className="small muted">Everything is stored on this device only. Export a backup regularly — and before clearing browser data or switching phones.</p>
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
              replaceState({ ...getState(), workouts: [], programs: [], bodyweight: [], customExercises: [], manualMaxes: {}, diagnoses: {}, coachChat: [], activeWorkout: undefined, activeProgram: undefined });
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
