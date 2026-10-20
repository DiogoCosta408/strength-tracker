import { useMemo, useState } from 'react';
import type { Workout } from '../types';
import { fmtKg } from '../lib/calc';
import { getExercise, update, useAppState } from '../lib/store';
import { finishedWorkouts, isWorkSet, setE1rm, workoutPRs, workoutTonnage } from '../lib/stats';
import { startWorkout } from '../lib/workout';
import { fmtDate, fmtDuration, nowISO, weekKey } from '../lib/util';
import { ask, go, Icon, NumInput, TopBar, toast } from '../components/ui';

export function HistoryList() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return finishedWorkouts(s)
      .reverse()
      .filter((w) => !t || w.name.toLowerCase().includes(t) || w.exercises.some((e) => (getExercise(e.exerciseId, s)?.name ?? '').toLowerCase().includes(t)));
  }, [s, q]);
  let lastWeek = '';
  return (
    <div>
      <TopBar title="History" backTo="/more" />
      <input type="search" placeholder="Filter by workout or exercise" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length && <div className="empty">No workouts logged yet.</div>}
      {list.map((w) => {
        const wk = weekKey(w.startedAt);
        const header = wk !== lastWeek ? (lastWeek = wk) : null;
        return (
          <div key={w.id}>
            {header && <div className="small muted" style={{ margin: '14px 0 2px' }}>Week of {fmtDate(wk, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
            <button className="card list-item" style={{ display: 'block', borderRadius: 14, border: '1px solid var(--border)', margin: '6px 0' }} onClick={() => go(`/history/${w.id}`)}>
              <div className="row between">
                <span className="bold ellipsis">{w.name}</span>
                <span className="small muted">{fmtDate(w.startedAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
              {w.exercises.slice(0, 5).map((e) => {
                const work = e.sets.filter(isWorkSet);
                const top = work.reduce((a, x) => (x.weight > a.weight ? x : a), work[0] ?? { weight: 0, reps: 0 });
                return (
                  <div key={e.id} className="row between small num" style={{ padding: '1px 0' }}>
                    <span className="ellipsis grow muted">
                      {work.length}× {getExercise(e.exerciseId, s)?.name}
                    </span>
                    <span>
                      {fmtKg(top.weight)}×{top.reps}
                      {top.rpe ? ` @${top.rpe}` : ''}
                    </span>
                  </div>
                );
              })}
              {w.exercises.length > 5 && <div className="tiny muted">+{w.exercises.length - 5} more</div>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function WorkoutDetail({ id }: { id: string }) {
  const s = useAppState();
  const w = s.workouts.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  if (!w) return <div className="empty">Workout not found</div>;
  const prs = workoutPRs(s, w);
  const prKeys = new Set(prs.map((p) => p.exerciseId));
  const bw = w.bodyweight;

  const save = (next: Workout) => update((st) => ({ ...st, workouts: st.workouts.map((x) => (x.id === id ? { ...next, updatedAt: nowISO() } : x)) }));

  return (
    <div>
      <TopBar
        title={w.name}
        backTo="/history"
        right={
          <button className="btn-sm" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        }
      />
      <div className="small muted">
        {fmtDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        {w.finishedAt && ` · ${fmtDuration(new Date(w.finishedAt).getTime() - new Date(w.startedAt).getTime())}`}
        {bw ? ` · BW ${bw} kg` : ''} · {Math.round(workoutTonnage(w)).toLocaleString()} kg total
      </div>
      {editing && (
        <label className="field" style={{ marginTop: 8 }}>
          <span>Date & time (for sessions logged after the fact)</span>
          <input
            type="datetime-local"
            value={toLocalInput(w.startedAt)}
            onChange={(e) => {
              if (!e.target.value) return;
              const started = new Date(e.target.value);
              if (isNaN(started.getTime())) return;
              // Keep however long the session took; only move it on the calendar.
              const duration = w.finishedAt ? new Date(w.finishedAt).getTime() - new Date(w.startedAt).getTime() : 0;
              save({ ...w, startedAt: started.toISOString(), finishedAt: w.finishedAt ? new Date(started.getTime() + duration).toISOString() : undefined });
            }}
          />
        </label>
      )}
      {w.notes && <div className="card tight small">{w.notes}</div>}
      {w.exercises.map((e) => {
        const ex = getExercise(e.exerciseId, s);
        return (
          <div className="card" key={e.id}>
            <div className="row between">
              <button className="btn-ghost bold" style={{ padding: 0, minHeight: 0 }} onClick={() => go(`/exercise/${e.exerciseId}`)}>
                {ex?.name ?? e.exerciseId}
              </button>
              {prKeys.has(e.exerciseId) && <span className="pr-badge">PR</span>}
            </div>
            {e.notes && <div className="small muted">{e.notes}</div>}
            <table className="tbl" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Set</th>
                  <th>kg</th>
                  <th>Reps</th>
                  <th>RPE</th>
                  <th>e1RM</th>
                </tr>
              </thead>
              <tbody>
                {e.sets.map((x, i) => (
                  <tr key={x.id} className={x.kind === 'warmup' ? 'muted' : ''}>
                    <td>{x.kind === 'warmup' ? 'W' : x.kind === 'top' ? 'Top' : x.kind === 'backoff' ? 'Back-off' : x.kind === 'amrap' ? 'AMRAP' : i + 1}</td>
                    {editing ? (
                      <>
                        <td style={{ width: 70 }}>
                          <NumInput value={x.weight} onChange={(v) => save(patchSet(w, e.id, x.id, { weight: v ?? 0 }))} />
                        </td>
                        <td style={{ width: 56 }}>
                          <NumInput value={x.reps} onChange={(v) => save(patchSet(w, e.id, x.id, { reps: Math.round(v ?? 0) }))} />
                        </td>
                        <td style={{ width: 56 }}>
                          <NumInput value={x.rpe} onChange={(v) => save(patchSet(w, e.id, x.id, { rpe: v }))} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{fmtKg(x.weight)}</td>
                        <td>{x.reps}</td>
                        <td>{x.rpe ?? ''}</td>
                      </>
                    )}
                    <td>{x.kind === 'warmup' ? '' : fmtKg(setE1rm(s, ex, x, bw) - (ex?.bodyweightLoaded ? bw ?? 0 : 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {editing && (
        <label className="field">
          <span>Bodyweight (kg)</span>
          <NumInput value={w.bodyweight} onChange={(v) => save({ ...w, bodyweight: v })} />
        </label>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="grow"
          onClick={() => {
            if (s.activeWorkout) return toast('Finish your current workout first');
            startWorkout({ copyOf: w, name: w.name });
            go('/workout');
          }}
        >
          <Icon name="copy" /> Repeat
        </button>
        <button
          className="grow btn-danger"
          onClick={async () => {
            if (!(await ask('Delete this workout permanently?', { confirmLabel: 'Delete', danger: true }))) return;
            update((st) => ({ ...st, workouts: st.workouts.filter((x) => x.id !== id), tombstones: [...(st.tombstones ?? []), { collection: 'workouts', id, deletedAt: nowISO() }] }));
            go('/history');
          }}
        >
          <Icon name="trash" /> Delete
        </button>
      </div>
    </div>
  );
}

/** ISO timestamp → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function patchSet(w: Workout, exId: string, setId: string, patch: Partial<Workout['exercises'][number]['sets'][number]>): Workout {
  return { ...w, exercises: w.exercises.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) })) };
}
