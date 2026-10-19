import { useEffect, useMemo, useState } from 'react';
import type { LoggedExercise, LoggedSet, SetKind, SetPrescription, Workout } from '../types';
import { fmtKg, platesFor, RPE_VALUES } from '../lib/calc';
import { getExercise, getState, update, useAppState } from '../lib/store';
import { bestE1rm, lastPerformance, setE1rm, suggestLoad, workoutPRs, type PR } from '../lib/stats';
import { addWarmups, discardActive, emptyExercise, finishActive, newSet, reflowSuggestions, todayE1rm, topSetBase, updateActive, updateExercise } from '../lib/workout';
import { fmtDate, fmtDuration, uid, todayISO } from '../lib/util';
import { ExercisePicker } from '../components/ExercisePicker';
import { startRest } from '../components/RestTimer';
import { ask, askText, go, Icon, NumInput, Sheet, toast } from '../components/ui';

const KIND_CYCLE: SetKind[] = ['work', 'top', 'backoff', 'amrap', 'warmup'];
const KIND_LABEL: Record<SetKind, string> = { warmup: 'W', work: '', top: 'T', backoff: 'B', amrap: 'A' };
const KIND_NAME: Record<SetKind, string> = { warmup: 'Warm-up', work: 'Work set', top: 'Top set', backoff: 'Back-off', amrap: 'AMRAP' };

export function targetText(t: SetPrescription | undefined): string {
  if (!t) return '';
  const r = t.kind === 'amrap' ? `${t.reps}+` : `${t.reps}`;
  if (t.rpe !== undefined) return `${r} @ RPE ${t.rpe}`;
  if (t.percent !== undefined) return `${r} @ ${Math.round(t.percent * 10) / 10}%`;
  if (t.percentOfTop !== undefined) return `${r} @ ${t.percentOfTop}% of top`;
  if (t.lpIncrement !== undefined) return `${r} · LP +${t.lpIncrement} kg`;
  if (t.weight !== undefined) return `${r} × ${t.weight} kg`;
  return `${r} reps`;
}

export function WorkoutLogger() {
  const s = useAppState();
  const w = s.activeWorkout;
  const [picker, setPicker] = useState<null | { replace?: string }>(null);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<{ w: Workout; prs: PR[] } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (summary) return <FinishSummary w={summary.w} prs={summary.prs} />;

  if (!w)
    return (
      <div className="empty">
        <p>No workout in progress.</p>
        <button className="btn-primary" onClick={() => go('/train')}>
          Start one
        </button>
      </div>
    );

  const doneSets = w.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const tonnage = w.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done && x.kind !== 'warmup').reduce((b, x) => b + x.weight * x.reps, 0), 0);

  return (
    <div>
      <div className="topbar">
        <div className="grow">
          <input
            aria-label="Workout name"
            value={w.name}
            onChange={(e) => updateActive((x) => ({ ...x, name: e.target.value }))}
            style={{ fontWeight: 700, fontSize: 17, background: 'transparent', border: 0, padding: '4px 0' }}
          />
        </div>
        <button className="btn-primary" onClick={() => setFinishing(true)}>
          Finish
        </button>
      </div>
      <div className="row small muted num" style={{ gap: 14 }}>
        <span>
          <Icon name="timer" size={14} /> {fmtDuration(now - new Date(w.startedAt).getTime())}
        </span>
        <span>{doneSets} sets</span>
        <span>{Math.round(tonnage).toLocaleString()} kg</span>
        <span className="grow" />
        <label className="row small" style={{ gap: 4 }}>
          BW
          <div style={{ width: 70 }}>
            <NumInput value={w.bodyweight} onChange={(v) => updateActive((x) => ({ ...x, bodyweight: v }))} ariaLabel="Bodyweight" />
          </div>
        </label>
      </div>

      {w.exercises.map((le, i) => (
        <ExerciseCard key={le.id} le={le} index={i} count={w.exercises.length} workout={w} onReplace={() => setPicker({ replace: le.id })} />
      ))}

      <button className="btn-block" style={{ margin: '12px 0' }} onClick={() => setPicker({})}>
        <Icon name="plus" /> Add exercise
      </button>
      <label className="field">
        <span>Session notes</span>
        <textarea value={w.notes ?? ''} onChange={(e) => updateActive((x) => ({ ...x, notes: e.target.value }))} placeholder="How did it feel? Sleep, stress, cues…" />
      </label>
      <button
        className="btn-block btn-danger"
        onClick={async () => {
          if (await ask('Discard this workout? Logged sets will be lost.', { confirmLabel: 'Discard', danger: true })) {
            discardActive();
            go('/train');
          }
        }}
      >
        Discard workout
      </button>

      {picker && (
        <ExercisePicker
          title={picker.replace ? 'Replace exercise' : 'Add exercise'}
          similarTo={picker.replace ? getExercise(w.exercises.find((x) => x.id === picker.replace)?.exerciseId ?? '', s) : undefined}
          onClose={() => setPicker(null)}
          onPick={(ex) => {
            if (picker.replace) updateExercise(picker.replace, (le) => ({ ...le, exerciseId: ex.id }));
            else updateActive((x) => ({ ...x, exercises: [...x.exercises, emptyExercise(getState(), ex.id)] }));
            setPicker(null);
          }}
        />
      )}

      {finishing && (
        <Sheet title="Finish workout?" onClose={() => setFinishing(false)}>
          <p className="muted small">Unchecked sets are discarded. {w.exercises.some((e) => e.sets.some((x) => !x.done)) ? 'Some sets are not checked yet.' : ''}</p>
          <SaveBodyweight w={w} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="grow" onClick={() => setFinishing(false)}>
              Keep training
            </button>
            <button
              className="btn-primary grow"
              onClick={() => {
                const done = finishActive();
                setFinishing(false);
                if (done) setSummary({ w: done, prs: workoutPRs(getState(), done) });
              }}
            >
              Finish & save
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SaveBodyweight({ w }: { w: Workout }) {
  const s = useAppState();
  const date = todayISO();
  const has = s.bodyweight.some((b) => b.date === date);
  if (!w.bodyweight || has) return null;
  return (
    <button
      className="btn-block btn-sm"
      onClick={() => {
        update((st) => ({ ...st, bodyweight: [...st.bodyweight, { id: uid(), date, weight: w.bodyweight! }] }));
        toast('Bodyweight saved');
      }}
    >
      Log {w.bodyweight} kg to bodyweight tracker
    </button>
  );
}

function ExerciseCard({ le, index, count, workout, onReplace }: { le: LoggedExercise; index: number; count: number; workout: Workout; onReplace: () => void }) {
  const s = useAppState();
  const ex = getExercise(le.exerciseId, s);
  const [menu, setMenu] = useState(false);
  const bw = workout.bodyweight;
  const last = useMemo(() => lastPerformance(s, le.exerciseId), [s.workouts, le.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = useMemo(() => bestE1rm(s, le.exerciseId), [s.workouts, s.manualMaxes, le.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayBest = Math.max(0, ...le.sets.filter((x) => x.done && x.kind !== 'warmup').map((x) => setE1rm(s, ex, x, bw)));
  const isBarbell = ex?.equipment === 'barbell';
  const topDone = topSetBase(s, le);
  const today = todayE1rm(s, le);

  const setSet = (id: string, patch: Partial<LoggedSet>) => updateExercise(le.id, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const toggleDone = (set: LoggedSet) => {
    const st = getState();
    if (!set.done) {
      // Accept the prescription when fields were left blank.
      let weight = set.weight;
      if (!weight && set.target && !ex?.bodyweightLoaded) weight = suggestLoad(st, le.exerciseId, set.target, topDone, today) ?? 0;
      const reps = set.reps || set.target?.reps || 0;
      if (!reps) {
        toast('Enter reps first');
        return;
      }
      updateExercise(le.id, (e) => reflowSuggestions(st, { ...e, sets: e.sets.map((x) => (x.id === set.id ? { ...x, weight, reps, done: true } : x)) }));
      const isLast = le.sets[le.sets.length - 1].id === set.id;
      if (!isLast || index < count - 1) startRest(set.kind === 'warmup' ? Math.min(90, le.rest ?? st.profile.defaultRest) : le.rest ?? st.profile.defaultRest);
    } else setSet(set.id, { done: false });
  };

  let workNo = 0;
  return (
    <div className="card">
      <div className="row">
        <button className="btn-ghost grow" style={{ justifyContent: 'flex-start', padding: 0, minHeight: 0, textAlign: 'left', whiteSpace: 'normal' }} onClick={() => go(`/exercise/${le.exerciseId}`)}>
          <span className="bold" style={{ fontSize: 16 }}>
            {ex?.name ?? le.exerciseId}
          </span>
        </button>
        <button className="btn-ghost icon-btn" aria-label="Exercise options" onClick={() => setMenu(true)}>
          <Icon name="more" />
        </button>
      </div>
      <div className="small muted num">
        {last ? (
          <>
            Last ({fmtDate(last.workout.startedAt, { day: 'numeric', month: 'short' })}):{' '}
            {last.entry.sets
              .filter((x) => x.kind !== 'warmup' && x.done)
              .map((x) => `${fmtKg(x.weight)}×${x.reps}${x.rpe ? `@${x.rpe}` : ''}`)
              .join(', ')}
          </>
        ) : (
          'First time logging this exercise'
        )}
      </div>
      <div className="small num" style={{ marginTop: 2 }}>
        {best > 0 && <span className="muted">Best e1RM {fmtKg(best - (ex?.bodyweightLoaded ? bw ?? 0 : 0))} kg</span>}
        {todayBest > 0 && (
          <span className={todayBest > best ? 'good bold' : 'muted'}>
            {' '}
            · Today {fmtKg(todayBest - (ex?.bodyweightLoaded ? bw ?? 0 : 0))} {todayBest > best && best > 0 ? '▲ PR' : ''}
          </span>
        )}
      </div>
      {le.notes && <div className="small" style={{ marginTop: 4 }}>📝 {le.notes}</div>}

      <div className="set-grid head">
        <span className="center">Set</span>
        <span className="center">{ex?.bodyweightLoaded ? '+kg' : 'kg'}</span>
        <span className="center">Reps</span>
        <span className="center">RPE</span>
        <span />
      </div>
      {le.sets.map((set) => {
        if (set.kind !== 'warmup') workNo++;
        const sugg = set.target && !set.done ? suggestLoad(s, le.exerciseId, set.target, topDone, today) : undefined;
        const e1 = set.weight || ex?.bodyweightLoaded ? setE1rm(s, ex, { ...set, reps: set.reps || set.target?.reps || 0 }, bw) : 0;
        const plates = isBarbell && set.weight > s.profile.barWeight ? platesFor(set.weight, s.profile.barWeight, s.profile.plates) : null;
        return (
          <div key={set.id} className={`set-row ${set.done ? 'done' : ''}`}>
            <div className="set-grid">
              <button
                className={`set-kind ${set.kind}`}
                title={KIND_NAME[set.kind]}
                aria-label={`${KIND_NAME[set.kind]} — tap to change type`}
                onClick={() => setSet(set.id, { kind: KIND_CYCLE[(KIND_CYCLE.indexOf(set.kind) + 1) % KIND_CYCLE.length] })}
              >
                {KIND_LABEL[set.kind] || workNo}
              </button>
              <NumInput blankZero value={set.weight} placeholder={sugg !== undefined ? fmtKg(sugg) : ex?.bodyweightLoaded ? 'BW' : 'kg'} ariaLabel="Weight" onChange={(v) => setSet(set.id, { weight: v ?? 0, autoWeight: false })} />
              <NumInput blankZero value={set.reps} placeholder={set.target ? String(set.target.reps) : 'reps'} ariaLabel="Reps" onChange={(v) => setSet(set.id, { reps: Math.max(0, Math.round(v ?? 0)) })} />
              <select aria-label="RPE" value={set.rpe ?? ''} onChange={(e) => { const rpe = e.target.value ? parseFloat(e.target.value) : undefined; updateExercise(le.id, (x) => reflowSuggestions(getState(), { ...x, sets: x.sets.map((y) => (y.id === set.id ? { ...y, rpe } : y)) })); }}>
                <option value="">{set.target?.rpe ? `@${set.target.rpe}` : '–'}</option>
                {RPE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button className={`check ${set.done ? 'on' : ''}`} aria-label={set.done ? 'Mark not done' : 'Mark done'} aria-pressed={set.done} onClick={() => toggleDone(set)}>
                ✓
              </button>
            </div>
            {(set.target || e1 > 0 || plates) && (
              <div className="set-meta">
                {set.target && <span>{targetText(set.target)}</span>}
                {sugg !== undefined && !set.weight && <span> → {fmtKg(sugg)} kg</span>}
                {e1 > 0 && set.done && set.kind !== 'warmup' && <span> · e1RM {fmtKg(e1 - (ex?.bodyweightLoaded ? bw ?? 0 : 0))}</span>}
                {plates && plates.perSide.length > 0 && (
                  <span>
                    {' '}
                    · {plates.perSide.join('+')}
                    {plates.remainder ? ` (+${plates.remainder})` : ''}/side
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn-sm grow"
          onClick={() =>
            updateExercise(le.id, (e) => {
              const prev = e.sets[e.sets.length - 1];
              return { ...e, sets: [...e.sets, newSet(prev ? { kind: prev.kind === 'warmup' ? 'work' : prev.kind, weight: prev.weight, reps: prev.reps, target: prev.target } : {})] };
            })
          }
        >
          + Set
        </button>
        {isBarbell && !le.sets.some((x) => x.kind === 'warmup') && (
          <button className="btn-sm grow" onClick={() => updateExercise(le.id, (e) => addWarmups(getState(), e))}>
            + Warm-ups
          </button>
        )}
        <label className="row small muted" style={{ gap: 4 }}>
          Rest
          <select className="btn-sm" style={{ width: 78, minHeight: 32, padding: '2px 4px' }} value={le.rest ?? s.profile.defaultRest} onChange={(e) => updateExercise(le.id, (x) => ({ ...x, rest: parseInt(e.target.value) }))}>
            {[...new Set([0, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480, le.rest ?? s.profile.defaultRest])].sort((a, b) => a - b).map((r) => (
              <option key={r} value={r}>
                {r ? `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}` : 'off'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {menu && (
        <Sheet title={ex?.name ?? 'Exercise'} onClose={() => setMenu(false)}>
          <div className="list">
            <button className="list-item" disabled={index === 0} onClick={() => (move(le.id, -1), setMenu(false))}>
              <Icon name="up" /> Move up
            </button>
            <button className="list-item" disabled={index === count - 1} onClick={() => (move(le.id, 1), setMenu(false))}>
              <Icon name="down" /> Move down
            </button>
            <button className="list-item" onClick={() => (onReplace(), setMenu(false))}>
              <Icon name="edit" /> Replace exercise
            </button>
            <button
              className="list-item"
              onClick={async () => {
                setMenu(false);
                const n = await askText('Exercise notes (cues, setup, how it felt)', le.notes ?? '');
                if (n !== null) updateExercise(le.id, (e) => ({ ...e, notes: n.trim() || undefined }));
              }}
            >
              <Icon name="edit" /> Notes
            </button>
            <button
              className="list-item"
              onClick={() => {
                updateExercise(le.id, (e) => ({ ...e, sets: e.sets.filter((x) => x.done || e.sets.indexOf(x) !== e.sets.length - 1) }));
                setMenu(false);
              }}
            >
              <Icon name="close" /> Remove last unchecked set
            </button>
            <button className="list-item" onClick={() => (go(`/exercise/${le.exerciseId}`), setMenu(false))}>
              <Icon name="chart" /> History & records
            </button>
            <button
              className="list-item btn-danger"
              onClick={() => {
                updateActive((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== le.id) }));
                setMenu(false);
              }}
            >
              <Icon name="trash" /> Remove exercise
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function move(id: string, dir: -1 | 1) {
  updateActive((w) => {
    const i = w.exercises.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= w.exercises.length) return w;
    const ex = [...w.exercises];
    [ex[i], ex[j]] = [ex[j], ex[i]];
    return { ...w, exercises: ex };
  });
}

function FinishSummary({ w, prs }: { w: Workout; prs: PR[] }) {
  const s = useAppState();
  const sets = w.exercises.reduce((a, e) => a + e.sets.filter((x) => x.kind !== 'warmup').length, 0);
  const tonnage = w.exercises.reduce((a, e) => a + e.sets.filter((x) => x.kind !== 'warmup').reduce((b, x) => b + x.weight * x.reps, 0), 0);
  return (
    <div>
      <h1>Workout saved 💪</h1>
      <div className="grid3">
        <div className="stat">
          <div className="label">Duration</div>
          <div className="value">{fmtDuration(new Date(w.finishedAt!).getTime() - new Date(w.startedAt).getTime())}</div>
        </div>
        <div className="stat">
          <div className="label">Work sets</div>
          <div className="value">{sets}</div>
        </div>
        <div className="stat">
          <div className="label">Tonnage</div>
          <div className="value">{Math.round(tonnage / 100) / 10}t</div>
        </div>
      </div>
      {prs.length > 0 && (
        <div className="card accent">
          <h3>🏆 Personal records</h3>
          {prs.map((p, i) => {
            const ex = getExercise(p.exerciseId, s);
            const bwAdj = ex?.bodyweightLoaded && p.type === 'e1rm' ? w.bodyweight ?? 0 : 0;
            return (
              <div key={i} className="row between small num" style={{ padding: '4px 0' }}>
                <span>{ex?.name}</span>
                <span className="bold">
                  {p.type === 'e1rm' ? `e1RM ${fmtKg(p.value - bwAdj)} kg` : `${p.reps}RM ${fmtKg(p.value)} kg`}
                  {p.previous ? <span className="muted"> (was {fmtKg(p.previous - bwAdj)})</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="grow" onClick={() => go(`/history/${w.id}`)}>
          View session
        </button>
        <button className="btn-primary grow" onClick={() => go('/')}>
          Dashboard
        </button>
      </div>
    </div>
  );
}
