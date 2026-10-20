import { useMemo, useState } from 'react';
import type { Muscle, StandardLift } from '../types';
import { MUSCLE_LABELS } from '../data/exercises';
import { fmtKg } from '../lib/calc';
import { bodyweightAt, exerciseName, getExercise, update, useAppState } from '../lib/store';
import { standings, strengthScoreHistory } from '../lib/stats';
import { balanceScore, LEVELS, levelFor, LIFT_LABELS, LIFT_MUSCLES, loadForLevel, loadForScore, muscleScores, scoreColor } from '../lib/strength';
import { BodyMap } from '../components/BodyMap';
import { LineChart } from '../components/Charts';
import { go, Help, NumInput, Sheet, TopBar } from '../components/ui';
import { nowISO } from '../lib/util';

const STANDARD_IDS: Record<StandardLift, string> = {
  squat: 'squat',
  frontSquat: 'front-squat',
  bench: 'bench-press',
  inclineBench: 'incline-bench-press',
  deadlift: 'deadlift',
  sumoDeadlift: 'sumo-deadlift',
  press: 'press',
  pushPress: 'push-press',
  snatchGripPress: 'snatch-grip-press',
  powerClean: 'power-clean',
  row: 'barbell-row',
  chinup: 'chin-up',
  pullup: 'pull-up',
  dip: 'dip',
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
      <StrengthLegend />
      {st.length > 0 && (
        <div className="center small" style={{ marginTop: 6 }}>
          Overall: <b>{levelFor(avg)}</b> <span className="muted">({Math.round(avg)} pts)</span>
        </div>
      )}
    </div>
  );
}

/** What each muscle colour means, one swatch per level. */
export function StrengthLegend() {
  return (
    <div className="row wrap center" style={{ gap: '4px 12px', justifyContent: 'center', marginTop: 8 }}>
      {LEVELS.map((l) => (
        <span key={l.name} className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {/* each level's own colour stop, so a muscle sitting exactly at that level matches its swatch */}
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: scoreColor(l.min), display: 'inline-block', flexShrink: 0 }} />
          {l.name}
        </span>
      ))}
    </div>
  );
}

/** Headline score, balance and per-lift bars — the at-a-glance summary for the dashboard. */
export function StrengthScoreCard({ max = 5, onClick }: { max?: number; onClick?: () => void }) {
  const { standings: st, avg } = useStrengthProfile();
  if (!st.length) return null;
  const balance = balanceScore(st);
  const bars = [...st].sort((a, b) => b.score - a.score).slice(0, max);
  return (
    <div className="card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="tiny muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Strength score</div>
          <div className="num" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>{Math.round(avg)}</div>
          <div className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: scoreColor(avg), display: 'inline-block' }} />
            {levelFor(avg)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tiny muted title-row" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', justifyContent: 'flex-end' }}>
            Balance
            <Help title="Balance">
              <p>How even your lifts are relative to each other: 100% means every scored lift sits at the same level, lower means some lag behind.</p>
              <p>It's the average gap between each lift's score and your overall score — the same gaps listed under Imbalances.</p>
            </Help>
          </div>
          <div className="num" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
            {Math.round(balance)}
            <span className="small muted">%</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {bars.map((x) => (
          <div key={x.lift} className="row" style={{ alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span className="small ellipsis" style={{ width: 96, flexShrink: 0 }}>{LIFT_LABELS[x.lift]}</span>
            <div className="level-bar grow">
              <div style={{ width: `${Math.min(100, x.score)}%`, background: scoreColor(x.score) }} />
            </div>
            <span className="tiny muted num" style={{ width: 26, textAlign: 'right' }}>{Math.round(x.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Overall strength score over time. */
export function StrengthProgressChart({ weeks = 16 }: { weeks?: number }) {
  const s = useAppState();
  const history = useMemo(() => strengthScoreHistory(s, weeks), [s, weeks]);
  if (history.length < 2) return null;
  return (
    <div className="card">
      <div className="title-row" style={{ marginBottom: 2 }}>
        <h3 style={{ margin: 0 }}>Strength score trend</h3>
        <Help title="Strength score trend">
          <p>Your overall score (the average across every scored lift) recalculated at each week, using the best e1RM logged up to that point and your bodyweight at the time.</p>
        </Help>
      </div>
      <LineChart unit="pts" points={history.map((p) => ({ x: new Date(p.date).getTime(), y: p.score }))} />
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
      <TopBar
        title="Strength profile"
        backTo="/"
        right={
          <Help title="Strength profile">
            <p>
              Each lift is scored from your best e1RM over the last year relative to {bw} kg bodyweight ({s.profile.sex}
              {age ? `, ${age}y` : ''}). Muscles are coloured by the lifts that train them. Tap a muscle to see which lifts count.
            </p>
            <p>The scale runs to 100 at World class, with a level every 12.5 points: 25 = Novice, 37.5 = Intermediate, 50 = Proficient, 62.5 = Advanced, 75 = Exceptional, 87.5 = Elite.</p>
            <p>Standards come from Symmetric Strength's published tables, converted to bodyweight ratios and adjusted for sex and age. Their model scales by Wilks rather than a flat ratio, so these track it closely rather than matching exactly.</p>
            <p>Imbalances list lifts more than 10 pts below your average. Tap a lift to enter a tested max.</p>
          </Help>
        }
      />
      <div className="card">
        <BodyMap colorFor={(m) => scoreColor(muscles[m])} selected={sel} onSelect={(m) => setSel(sel === m ? null : m)} labelFor={(m) => `${MUSCLE_LABELS[m]}: ${muscles[m] === null ? 'no data' : `${levelFor(muscles[m]!)} (${Math.round(muscles[m]!)})`}`} />
        <StrengthLegend />
      </div>

      {st.length > 0 && <StrengthScoreCard max={st.length} />}
      <StrengthProgressChart />

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
              <div style={{ width: `${Math.min(100, x.score)}%`, background: scoreColor(x.score) }} />
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
          <div className="row wrap" style={{ gap: 6 }}>
            {missing.map((l) => (
              <button key={l} className="chip" onClick={() => setEditMax(l)}>
                + {LIFT_LABELS[l]}
              </button>
            ))}
          </div>
        </>
      )}

      {editMax && <ManualMaxSheet lift={editMax} onClose={() => setEditMax(null)} />}
    </div>
  );
}

function liftLoadAtScore(lift: StandardLift, score: number, bw: number, sex: 'male' | 'female', age: number | undefined, bwLoaded?: boolean): number {
  return loadForScore(lift, score, bw, sex, age) - (bwLoaded ? bw : 0);
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
              return { ...st, manualMaxes: m, manualMaxUpdatedAt: { ...st.manualMaxUpdatedAt, [id]: nowISO() } };
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
