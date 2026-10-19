import { useState } from 'react';
import { flattenDays } from '../data/programs';
import { allPrograms, exerciseName, getProgram, update, useAppState } from '../lib/store';
import { finishedWorkouts, workoutTonnage } from '../lib/stats';
import { nextProgramDay, startWorkout } from '../lib/workout';
import { fmtDate } from '../lib/util';
import { go, Icon, Sheet, TopBar } from '../components/ui';
import { targetText } from './WorkoutLogger';

export function Train() {
  const s = useAppState();
  const next = nextProgramDay(s);
  const [choose, setChoose] = useState(false);
  const recent = finishedWorkouts(s).slice(-5).reverse();

  const begin = (opts: Parameters<typeof startWorkout>[0]) => {
    startWorkout(opts);
    go('/workout');
  };

  if (s.activeWorkout)
    return (
      <div>
        <TopBar title="Train" />
        <div className="card accent">
          <h3>Workout in progress</h3>
          <p className="muted small">{s.activeWorkout.name} · started {fmtDate(s.activeWorkout.startedAt, { hour: '2-digit', minute: '2-digit' })}</p>
          <button className="btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => go('/workout')}>
            Resume workout
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <TopBar title="Train" />
      {next ? (
        <div className="card accent">
          <div className="small muted">
            Next in {next.program.name} · {next.week}
          </div>
          <h2 style={{ marginTop: 2 }}>{next.day.name}</h2>
          {next.day.exercises.map((p, i) => (
            <div key={i} className="row between small" style={{ padding: '3px 0' }}>
              <span className="ellipsis grow">{exerciseName(p.exerciseId, s)}</span>
              <span className="muted num">{summarizeSets(p.sets.map(targetText))}</span>
            </div>
          ))}
          <button className="btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => begin({ program: next.program, day: next.day })}>
            Start {next.day.name}
          </button>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-sm grow" onClick={() => setChoose(true)}>
              Pick another day
            </button>
            <button className="btn-sm grow" onClick={() => go(`/program/${next.program.id}`)}>
              View program
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <h3>No active program</h3>
          <p className="small muted">Pick a template (Starting Strength, 5/3/1, RPE blocks…) or build your own. The app will queue the next session for you.</p>
          <button className="btn-block" style={{ marginTop: 8 }} onClick={() => go('/programs')}>
            Browse programs
          </button>
        </div>
      )}

      <div className="row" style={{ marginTop: 4 }}>
        <button className="grow" onClick={() => begin({ name: 'Workout' })}>
          <Icon name="plus" /> Empty workout
        </button>
        <button className="grow" onClick={() => go('/tools')}>
          <Icon name="calc" /> Calculators
        </button>
      </div>

      {recent.length > 0 && (
        <>
          <h2>Repeat a recent session</h2>
          <div className="card tight">
            <div className="list">
              {recent.map((w) => (
                <button key={w.id} className="list-item" onClick={() => begin({ copyOf: w, name: w.name })}>
                  <div className="grow">
                    <div className="bold ellipsis">{w.name}</div>
                    <div className="small muted">
                      {fmtDate(w.startedAt)} · {w.exercises.length} exercises · {Math.round(workoutTonnage(w)).toLocaleString()} kg
                    </div>
                  </div>
                  <Icon name="copy" size={18} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {choose && next && <DayChooser programId={next.program.id} onClose={() => setChoose(false)} onPick={(day) => begin({ program: next.program, day })} />}
    </div>
  );
}

export function summarizeSets(texts: string[]): string {
  // "5 @ RPE 8, 5 @ RPE 8, 5 @ RPE 8" → "3 × 5 @ RPE 8"
  const out: string[] = [];
  let i = 0;
  while (i < texts.length) {
    let j = i;
    while (j < texts.length && texts[j] === texts[i]) j++;
    out.push(j - i > 1 ? `${j - i}×${texts[i]}` : texts[i]);
    i = j;
  }
  return out.join(', ');
}

export function DayChooser({ programId, onClose, onPick }: { programId: string; onClose: () => void; onPick: (d: import('../types').ProgramDay) => void }) {
  const s = useAppState();
  const p = getProgram(programId, s);
  if (!p) return null;
  const days = flattenDays(p);
  return (
    <Sheet title={p.name} onClose={onClose}>
      <div className="list">
        {days.map((d) => (
          <button
            key={d.day.id + d.index}
            className="list-item"
            onClick={() => {
              update((st) => (st.activeProgram?.programId === p.id ? { ...st, activeProgram: { ...st.activeProgram, nextIndex: d.index } } : st));
              onPick(d.day);
            }}
          >
            <div className="grow">
              <div className="bold">{d.day.name}</div>
              <div className="small muted">{d.week}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function ProgramsQuickList() {
  const s = useAppState();
  return (
    <div className="list">
      {allPrograms(s).map((p) => (
        <button key={p.id} className="list-item" onClick={() => go(`/program/${p.id}`)}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
