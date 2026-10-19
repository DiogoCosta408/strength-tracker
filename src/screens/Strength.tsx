import { useMemo, useState } from 'react';
import type { Muscle, StandardLift } from '../types';
import { MUSCLE_LABELS } from '../data/exercises';
import { fmtKg } from '../lib/calc';
import { bodyweightAt, exerciseName, getExercise, update, useAppState } from '../lib/store';
import { standings } from '../lib/stats';
import { LEVELS, levelFor, LIFT_LABELS, LIFT_MUSCLES, loadForLevel, muscleScores, scoreColor } from '../lib/strength';
import { BodyMap } from '../components/BodyMap';
import { go, NumInput, Sheet, TopBar } from '../components/ui';

const STANDARD_IDS: Record<StandardLift, string> = {
  squat: 'squat',
  frontSquat: 'front-squat',
  bench: 'bench-press',
  inclineBench: 'incline-bench-press',
  deadlift: 'deadlift',
  sumoDeadlift: 'sumo-deadlift',
  press: 'press',
  powerClean: 'power-clean',
  row: 'barbell-row',
  chinup: 'chin-up',
  pullup: 'pull-up',
  dip: 'dip',
  rdl: 'romanian-deadlift',
  hipThrust: 'hip-thrust',
};

export function useStrengthProfile() {
  const s = useAppState();
  return useMemo(() => {
    const st = standings(s);
    const scores: Partial<Record<StandardLift, number>> = {};
    st.forEach((x) => (scores[x.lift] = x.score));
    const muscles = muscleScores(scores);
    const avg = st.length ? st.reduce((a, x) => a + x.score, 0) / st.length : 0;
    return { standings: st, muscles, avg };
  }, [s]);
}

export function StrengthMini({ onClick }: { onClick?: () => void }) {
  const { muscles, avg, standings: st } = useStrengthProfile();
  return (
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <BodyMap colorFor={(m) => scoreColor(muscles[m])} labelFor={(m) => `${MUSCLE_LABELS[m]}: ${muscles[m] === null ? 'no data' : levelFor(muscles[m]!)}`} />
      {st.length > 0 && (
        <div className="center small">
          Overall: <b>{levelFor(avg)}</b> <span className="muted">({Math.round(avg)} pts)</span>
        </div>
      )}
    </div>
  );
}

export function Strength() {
  const s = useAppState();
  const { standings: st, muscles, avg } = useStrengthProfile();
  const [sel, setSel] = useState<Muscle | null>(null);
  const [editMax, setEditMax] = useState<StandardLift | null>(null);
  const bw = bodyweightAt(s);
  const age = s.profile.birthYear ? new Date().getFullYear() - s.profile.birthYear : undefined;

  if (!bw)
    return (
      <div>
        <TopBar title="Strength profile" backTo="/" />
        <div className="card">
          <p>Log your bodyweight first — strength standards are relative to bodyweight.</p>
          <button className="btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => go('/body')}>
            Log bodyweight
          </button>
        </div>
      </div>
    );

  const sorted = [...st].sort((a, b) => b.score - a.score);
  const weak = st.filter((x) => x.score < avg - 10).sort((a, b) => a.score - b.score);
  const selLifts = sel ? st.filter((x) => LIFT_MUSCLES[x.lift][sel]).sort((a, b) => (LIFT_MUSCLES[b.lift][sel] ?? 0) - (LIFT_MUSCLES[a.lift][sel] ?? 0)) : [];
  const missing = (Object.keys(STANDARD_IDS) as StandardLift[]).filter((l) => !st.some((x) => x.lift === l));

  return (
    <div>
      <TopBar title="Strength profile" backTo="/" />
      <p className="small muted">
        Based on your best e1RM per lift over the last year, relative to {bw} kg bodyweight ({s.profile.sex}
        {age ? `, ${age}y` : ''}). Tap a muscle.
      </p>
      <div className="card">
        <BodyMap colorFor={(m) => scoreColor(muscles[m])} selected={sel} onSelect={(m) => setSel(sel === m ? null : m)} labelFor={(m) => `${MUSCLE_LABELS[m]}: ${muscles[m] === null ? 'no data' : `${levelFor(muscles[m]!)} (${Math.round(muscles[m]!)})`}`} />
        <div className="legend-ramp" style={{ marginTop: 8 }} />
        <div className="row between tiny muted">
          {LEVELS.slice(1).map((l) => (
            <span key={l.name}>{l.name}</span>
          ))}
        </div>
        {st.length > 0 && (
          <div className="center" style={{ marginTop: 10 }}>
            <div className="small muted">Overall strength</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{levelFor(avg)}</div>
            <div className="small muted num">{Math.round(avg)} / 100 pts</div>
          </div>
        )}
      </div>

      {sel && (
        <div className="card accent">
          <div className="row between">
            <h3 style={{ margin: 0 }}>{MUSCLE_LABELS[sel]}</h3>
            <span className="bold">{muscles[sel] === null ? 'No data' : `${levelFor(muscles[sel]!)} · ${Math.round(muscles[sel]!)}`}</span>
          </div>
          {selLifts.length ? (
            selLifts.map((x) => (
              <div key={x.lift} className="row between small" style={{ padding: '3px 0' }}>
                <span>{LIFT_LABELS[x.lift]}</span>
                <span className="muted">{levelFor(x.score)} ({Math.round(x.score)})</span>
              </div>
            ))
          ) : (
            <p className="small muted">Log a lift that trains this muscle to score it.</p>
          )}
        </div>
      )}

      {weak.length > 0 && (
        <div className="card">
          <h3>⚖️ Imbalances</h3>
          <p className="small muted">Lifts more than 10 pts below your average ({Math.round(avg)}):</p>
          {weak.map((x) => (
            <div key={x.lift} className="small" style={{ padding: '3px 0' }}>
              <b>{LIFT_LABELS[x.lift]}</b> is {Math.round(avg - x.score)} pts behind — reaching your average would be ≈{' '}
              <b>{fmtKg(liftLoadAtScore(x.lift, avg, bw, s.profile.sex, age, getExercise(STANDARD_IDS[x.lift], s)?.bodyweightLoaded))} kg</b>.
            </div>
          ))}
        </div>
      )}

      <h2>Lift standards</h2>
      {sorted.map((x) => {
        const lvlIdx = LEVELS.findIndex((l) => l.name === levelFor(x.score));
        const next = lvlIdx + 1 < LEVELS.length ? lvlIdx + 1 : null;
        const bwL = getExercise(x.exerciseId, s)?.bodyweightLoaded;
        const shown = x.e1rm - (bwL ? bw : 0);
        const nextLoad = next ? loadForLevel(x.lift, next, bw, s.profile.sex, age) - (bwL ? bw : 0) : 0;
        return (
          <div key={x.lift} className="card tight" onClick={() => setEditMax(x.lift)} style={{ cursor: 'pointer' }}>
            <div className="row between">
              <span className="bold">{LIFT_LABELS[x.lift]}</span>
              <span className="num">
                {fmtKg(shown)} kg{bwL ? ' added' : ''} · <span className="muted">{(x.e1rm / bw).toFixed(2)}×BW</span>
              </span>
            </div>
            <div className="level-bar" style={{ margin: '6px 0' }}>
              <div style={{ width: `${Math.min(100, (x.score / 120) * 100)}%`, background: scoreColor(x.score) }} />
            </div>
            <div className="row between tiny muted">
              <span>
                {levelFor(x.score)} · {Math.round(x.score)} pts
              </span>
              {next && <span>{LEVELS[next].name} at {fmtKg(nextLoad)} kg</span>}
            </div>
          </div>
        );
      })}
      {missing.length > 0 && (
        <>
          <h2>Not scored yet</h2>
          <p className="small muted">Log these (or enter a known max) to fill in the map.</p>
          <div className="row wrap" style={{ gap: 6 }}>
            {missing.map((l) => (
              <button key={l} className="chip" onClick={() => setEditMax(l)}>
                + {LIFT_LABELS[l]}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="tiny muted" style={{ marginTop: 16 }}>
        Standards are approximations compiled from public strength-standard data, scaled by sex and age. 20 pts = Novice, 40 = Intermediate, 60 = Advanced, 80 = Elite, 100 = World class.
      </p>

      {editMax && <ManualMaxSheet lift={editMax} onClose={() => setEditMax(null)} />}
    </div>
  );
}

function liftLoadAtScore(lift: StandardLift, score: number, bw: number, sex: 'male' | 'female', age: number | undefined, bwLoaded?: boolean): number {
  const i = Math.floor(score / 20);
  const lo = i === 0 ? 0 : loadForLevel(lift, i, bw, sex, age);
  const hi = loadForLevel(lift, Math.min(5, i + 1), bw, sex, age);
  const total = lo + ((hi - lo) * (score - i * 20)) / 20;
  return total - (bwLoaded ? bw : 0);
}

function ManualMaxSheet({ lift, onClose }: { lift: StandardLift; onClose: () => void }) {
  const s = useAppState();
  const id = STANDARD_IDS[lift];
  const [v, setV] = useState<number | undefined>(s.manualMaxes[id]);
  return (
    <Sheet title={LIFT_LABELS[lift]} onClose={onClose}>
      <p className="small muted">
        Enter a tested 1RM (e.g. a meet result) for {exerciseName(id, s)}. It's used alongside your logged sets — whichever is higher counts.
        {getExercise(id, s)?.bodyweightLoaded ? ' For bodyweight lifts enter the added weight.' : ''}
      </p>
      <label className="field">
        <span>Known 1RM (kg)</span>
        <NumInput value={v} onChange={setV} />
      </label>
      <div className="row">
        <button className="grow" onClick={() => go(`/exercise/${id}`)}>
          Exercise history
        </button>
        <button
          className="btn-primary grow"
          onClick={() => {
            update((st) => {
              const m = { ...st.manualMaxes };
              if (v) m[id] = v;
              else delete m[id];
              return { ...st, manualMaxes: m };
            });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
