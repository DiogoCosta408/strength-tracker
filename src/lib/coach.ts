import type { AppState, Workout } from '../types';
import { FAMILY_MAIN, type LiftFamily, type Rx } from '../data/coachKnowledge';
import { bodyweightAt, getExercise, getProgram } from './store';
import { exerciseHistory, finishedWorkouts, isWorkSet, standings, type SessionPoint } from './stats';
import { LIFT_LABELS } from './strength';

const DAY = 86400000;
const WEEK = 7 * DAY;

export type Trend = 'progressing' | 'stalled' | 'regressing' | 'insufficient';

export interface LiftAnalysis {
  family: LiftFamily;
  exerciseId: string;
  name: string;
  trend: Trend;
  sessions8w: number;
  bestE1rm: number;
  recentE1rm: number; // best of last 2 weeks
  /** e1RM change per week as % of e1RM (regression over last 6 weeks). */
  slopePct: number;
  weeksSincePR: number;
  /** Change in average top-set RPE (last 3 wk vs previous 3 wk) at similar relative load. */
  rpeDrift?: number;
  /** Sessions per week that include any variation of this lift (last 4 weeks). */
  frequency: number;
  /** Hard sets per week for the lift family (last 4 weeks). */
  hardSets: number;
  /** Share of competition-lift work sets ≥ 85% of best e1RM (last 4 weeks). */
  heavyShare: number;
  /** Other variations of this lift trained in the last 8 weeks. */
  variations: string[];
  history: SessionPoint[];
}

export type Severity = 'good' | 'info' | 'warn' | 'alert';

export interface Insight {
  id: string;
  severity: Severity;
  family?: LiftFamily;
  title: string;
  detail: string;
  actions: string[];
  rx?: Rx[];
}

const FAMILY_CATEGORY: Record<LiftFamily, string> = { squat: 'squat', bench: 'bench', deadlift: 'deadlift', press: 'press' };

function inFamily(s: AppState, exerciseId: string, family: LiftFamily): boolean {
  const ex = getExercise(exerciseId, s);
  return !!ex && ex.category === FAMILY_CATEGORY[family];
}

/** Least-squares slope of y over x. */
function slope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den ? num / den : 0;
}

export function analyzeLift(s: AppState, family: LiftFamily, now = Date.now()): LiftAnalysis {
  // Sumo pullers: analyse whichever deadlift they train more.
  let exerciseId = FAMILY_MAIN[family];
  if (family === 'deadlift') {
    const sumo = exerciseHistory(s, 'sumo-deadlift').filter((p) => now - +new Date(p.date) < 8 * WEEK).length;
    const conv = exerciseHistory(s, 'deadlift').filter((p) => now - +new Date(p.date) < 8 * WEEK).length;
    if (sumo > conv) exerciseId = 'sumo-deadlift';
  }
  const history = exerciseHistory(s, exerciseId);
  const t = (p: SessionPoint) => +new Date(p.date);
  const last8 = history.filter((p) => now - t(p) < 8 * WEEK);
  const last6 = history.filter((p) => now - t(p) < 6 * WEEK);

  // PR timeline: a session that beats every previous one by > 0.5%.
  let runningBest = 0;
  let lastPR = 0;
  for (const p of history) {
    if (p.e1rm > runningBest * 1.005) {
      runningBest = Math.max(runningBest, p.e1rm);
      lastPR = t(p);
    } else runningBest = Math.max(runningBest, p.e1rm);
  }
  const bestE1rm = runningBest;
  const recent = history.filter((p) => now - t(p) < 2 * WEEK);
  const recentE1rm = recent.length ? Math.max(...recent.map((p) => p.e1rm)) : 0;
  const mean = last6.length ? last6.reduce((a, p) => a + p.e1rm, 0) / last6.length : 0;
  const slopePct = mean ? (slope(last6.map((p) => ({ x: (t(p) - now) / WEEK, y: p.e1rm }))) / mean) * 100 : 0;
  const weeksSincePR = lastPR ? (now - lastPR) / WEEK : Infinity;

  // RPE drift on top sets, normalised for load.
  let rpeDrift: number | undefined;
  const withRpe = history.filter((p) => p.topRpe !== undefined && now - t(p) < 6 * WEEK);
  const a = withRpe.filter((p) => now - t(p) < 3 * WEEK);
  const b = withRpe.filter((p) => now - t(p) >= 3 * WEEK);
  if (a.length >= 2 && b.length >= 2 && bestE1rm) {
    const avg = (xs: SessionPoint[], f: (p: SessionPoint) => number) => xs.reduce((acc, p) => acc + f(p), 0) / xs.length;
    const dRpe = avg(a, (p) => p.topRpe!) - avg(b, (p) => p.topRpe!);
    const dLoad = (avg(a, (p) => p.topWeight) - avg(b, (p) => p.topWeight)) / bestE1rm;
    // Same or lower relative load feeling harder is a fatigue signal.
    rpeDrift = dLoad <= 0.02 ? dRpe : dRpe - dLoad * 20;
  }

  // Family-level frequency, volume, intensity and variation use.
  const ws = finishedWorkouts(s).filter((w) => now - +new Date(w.startedAt) < 4 * WEEK);
  let famSessions = 0;
  let hard = 0;
  let compSets = 0;
  let heavy = 0;
  for (const w of ws) {
    let touched = false;
    for (const le of w.exercises) {
      if (!inFamily(s, le.exerciseId, family)) continue;
      const work = le.sets.filter(isWorkSet);
      if (!work.length) continue;
      touched = true;
      hard += work.filter((x) => x.rpe === undefined || x.rpe >= 7).length;
      if (le.exerciseId === exerciseId && bestE1rm) {
        compSets += work.length;
        heavy += work.filter((x) => x.weight >= 0.85 * bestE1rm).length;
      }
    }
    if (touched) famSessions++;
  }
  const variations = new Set<string>();
  for (const w of finishedWorkouts(s).filter((w) => now - +new Date(w.startedAt) < 8 * WEEK))
    for (const le of w.exercises) if (le.exerciseId !== exerciseId && inFamily(s, le.exerciseId, family)) variations.add(le.exerciseId);

  let trend: Trend;
  if (last8.length < 3) trend = 'insufficient';
  else if (slopePct <= -0.5 && recentE1rm && recentE1rm < bestE1rm * 0.97) trend = 'regressing';
  else if (weeksSincePR >= 4 && slopePct < 0.25) trend = 'stalled';
  else trend = 'progressing';

  return {
    family,
    exerciseId,
    name: getExercise(exerciseId, s)?.name ?? exerciseId,
    trend,
    sessions8w: last8.length,
    bestE1rm,
    recentE1rm,
    slopePct,
    weeksSincePR,
    rpeDrift,
    frequency: famSessions / 4,
    hardSets: hard / 4,
    heavyShare: compSets ? heavy / compSets : 0,
    variations: [...variations],
    history,
  };
}

const FAMILIES: LiftFamily[] = ['squat', 'bench', 'deadlift', 'press'];

export function analyzeAll(s: AppState, now = Date.now()): LiftAnalysis[] {
  return FAMILIES.map((f) => analyzeLift(s, f, now));
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Turn the analysis into prioritised, actionable insights. */
export function buildInsights(s: AppState, now = Date.now()): Insight[] {
  const out: Insight[] = [];
  const lifts = analyzeAll(s, now);
  const workouts = finishedWorkouts(s);

  for (const l of lifts) {
    const label = l.name.replace(/\s*\(.*\)/, '');
    if (l.trend === 'insufficient') {
      const last = l.history[l.history.length - 1];
      if (last && now - +new Date(last.date) > 3 * WEEK)
        out.push({ id: `${l.family}-gap`, severity: 'info', family: l.family, title: `${label}: not trained recently`, detail: `Last logged ${Math.round((now - +new Date(last.date)) / WEEK)} weeks ago.`, actions: ['Ease back in at RPE 6-7 for 1-2 weeks before pushing top sets.'] });
      continue;
    }

    if (l.trend === 'progressing' && l.weeksSincePR <= 2) {
      out.push({ id: `${l.family}-pr`, severity: 'good', family: l.family, title: `${label} is moving 📈`, detail: `New e1RM PR ${l.weeksSincePR < 1 ? 'this week' : 'in the last 2 weeks'} (${r1(l.bestE1rm)} kg). Trend ${l.slopePct >= 0 ? '+' : ''}${r1(l.slopePct)}%/week.`, actions: ['Keep doing what you are doing. Don\'t change a program that is still working.'] });
    }

    if (l.trend === 'stalled' || l.trend === 'regressing') {
      const actions: string[] = [];
      const rx: Rx[] = [];
      const why: string[] = [];
      if (l.rpeDrift !== undefined && l.rpeDrift >= 0.5) {
        why.push(`top sets feel harder (RPE +${r1(l.rpeDrift)}) at the same loads, a classic sign of accumulated fatigue`);
        actions.push('Take a deload: 1 week at ~60-70% of normal volume with top sets at RPE 6-7, then resume.');
      }
      if (l.frequency < 1.5) {
        why.push(`you only train it ~${r1(l.frequency)}×/week`);
        actions.push(`Add a second weekly ${label.toLowerCase()} exposure, using a variation (see Diagnose) at RPE 7-8.`);
      }
      if (l.hardSets < 6) {
        why.push(`weekly volume is low (~${Math.round(l.hardSets)} hard sets)`);
        actions.push('Add 2-4 hard sets per week (back-off sets or a variation) for the next block.');
      } else if (l.hardSets > 20 && (l.rpeDrift ?? 0) > 0.25) {
        why.push(`volume is high (~${Math.round(l.hardSets)} hard sets/week) and recovery seems to lag`);
        actions.push('Cut 25-30% of the back-off/variation sets for 3 weeks.');
      }
      if (l.heavyShare < 0.1) {
        why.push('almost no work above 85% of your e1RM lately');
        actions.push('Add a top single or double at RPE 8 before your volume work, 1-2× per week, to practise heavy loads.');
      } else if (l.heavyShare > 0.6) {
        why.push('most of your sets are very heavy');
        actions.push('Shift to a volume block: more sets at 70-80% (RPE 6-8) for 4-6 weeks, then re-intensify.');
      }
      if (!l.variations.length) {
        why.push('you only train the competition variation');
        actions.push('Pick a variation that targets where the lift fails: answer the Diagnose questions for specific suggestions.');
      }
      if (!actions.length) actions.push('Answer the Diagnose questions so the coach can pinpoint the weak range and suggest variations.');
      const head = l.trend === 'regressing' ? `${label} is going backwards` : `${label} has stalled`;
      out.push({
        id: `${l.family}-${l.trend}`,
        severity: l.trend === 'regressing' ? 'alert' : 'warn',
        family: l.family,
        title: head,
        detail:
          `No e1RM PR for ${Number.isFinite(l.weeksSincePR) ? Math.round(l.weeksSincePR) : '–'} weeks (best ${r1(l.bestE1rm)} kg, recent ${r1(l.recentE1rm)} kg, trend ${l.slopePct >= 0 ? '+' : ''}${r1(l.slopePct)}%/week).` +
          (why.length ? ` Likely factors: ${why.join('; ')}.` : ''),
        actions,
        rx,
      });
    } else if (l.rpeDrift !== undefined && l.rpeDrift >= 1) {
      out.push({ id: `${l.family}-fatigue`, severity: 'info', family: l.family, title: `${label}: fatigue building`, detail: `Top sets are ~${r1(l.rpeDrift)} RPE harder than 3 weeks ago at similar loads.`, actions: ['Plan a deload within the next 1-2 weeks, before performance drops.'] });
    }
  }

  // Linear progression that has run its course.
  const prog = s.activeProgram && getProgram(s.activeProgram.programId, s);
  if (prog && /starting-strength|gzclp/.test(prog.id) && lifts.some((l) => l.trend === 'stalled' || l.trend === 'regressing')) {
    out.push({
      id: 'lp-done',
      severity: 'warn',
      title: 'Your linear progression may be running out',
      detail: `On ${prog.name}, stalling after a reset or two is normal: you're no longer a novice for that lift.`,
      actions: ['Reset the stalled lift ~10% once. If it stalls again, move to weekly progression (Texas Method) or an RPE-based program (RPE Powerlifting Block).'],
    });
  }

  // Consistency.
  const perWeek = (from: number, to: number) => workouts.filter((w) => now - +new Date(w.startedAt) >= from * WEEK && now - +new Date(w.startedAt) < to * WEEK).length / (to - from);
  const recentFreq = perWeek(0, 4);
  const priorFreq = perWeek(4, 12);
  if (priorFreq >= 2 && recentFreq < priorFreq * 0.6)
    out.push({ id: 'consistency', severity: 'warn', title: 'Training frequency dropped', detail: `${r1(recentFreq)} sessions/week over the last 4 weeks vs ${r1(priorFreq)} before.`, actions: ['If time is short, keep the main lifts and drop accessories: 45-minute sessions are fine.'] });

  // Bodyweight trend while stalled.
  const bwNow = bodyweightAt(s);
  const bwThen = bodyweightAt(s, new Date(now - 4 * WEEK).toISOString());
  if (bwNow && bwThen && (bwNow - bwThen) / bwThen < -0.015 && lifts.some((l) => l.trend === 'stalled' || l.trend === 'regressing'))
    out.push({ id: 'bw-down', severity: 'info', title: 'Bodyweight is dropping', detail: `${r1(bwThen)} → ${r1(bwNow)} kg in 4 weeks. Strength stalls are expected in a deficit.`, actions: ['If strength is the priority, eat at maintenance or a small surplus. If you\'re cutting on purpose, aim to hold strength rather than set PRs.'] });

  // Imbalances from strength standards.
  const st = standings(s);
  if (st.length >= 3) {
    const avg = st.reduce((acc, x) => acc + x.score, 0) / st.length;
    for (const x of st)
      if (x.score < avg - 12)
        out.push({ id: `imb-${x.lift}`, severity: 'info', title: `${LIFT_LABELS[x.lift]} lags behind your other lifts`, detail: `${Math.round(avg - x.score)} points below your average strength level.`, actions: [`Give ${LIFT_LABELS[x.lift].toLowerCase()} priority: train it first in the session and 2×/week for a block.`] });
  }

  if (!workouts.length)
    out.push({ id: 'empty', severity: 'info', title: 'Not enough data yet', detail: 'The coach needs a few weeks of logged sessions to spot trends.', actions: ['Log your workouts (with RPE if you can) and check back after 3-4 weeks.'] });

  const order: Record<Severity, number> = { alert: 0, warn: 1, info: 2, good: 3 };
  return out.sort((x, y) => order[x.severity] - order[y.severity]);
}

/** Compact plain-text training summary used as context for the AI coach. */
export function trainingSummary(s: AppState, now = Date.now()): string {
  const p = s.profile;
  const bw = bodyweightAt(s);
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : undefined;
  const lines: string[] = [];
  lines.push(`Lifter: ${p.sex}${age ? `, ${age} years` : ''}${bw ? `, bodyweight ${bw} kg` : ''}. Units: kg.`);
  const bw8 = bodyweightAt(s, new Date(now - 8 * WEEK).toISOString());
  if (bw && bw8) lines.push(`Bodyweight 8 weeks ago: ${bw8} kg.`);
  const prog = s.activeProgram && getProgram(s.activeProgram.programId, s);
  lines.push(`Current program: ${prog ? prog.name : 'none / free training'}.`);

  lines.push('', 'Main lift analysis (e1RM from RPE chart where RPE logged):');
  for (const l of analyzeAll(s, now)) {
    if (!l.history.length) {
      lines.push(`- ${l.name}: never logged.`);
      continue;
    }
    lines.push(
      `- ${l.name}: trend ${l.trend}; best e1RM ${r1(l.bestE1rm)}; last 2 wk ${r1(l.recentE1rm)}; ${r1(l.slopePct)}%/wk over 6 wk; ${Number.isFinite(l.weeksSincePR) ? Math.round(l.weeksSincePR) : '–'} wk since PR; ` +
        `${r1(l.frequency)} sessions/wk; ${Math.round(l.hardSets)} hard sets/wk (family); ${Math.round(l.heavyShare * 100)}% of comp sets ≥85%; ` +
        `RPE drift ${l.rpeDrift === undefined ? 'n/a' : r1(l.rpeDrift)}; variations: ${l.variations.map((id) => getExercise(id, s)?.name ?? id).join(', ') || 'none'}.`,
    );
  }

  lines.push('', 'Last 6 weeks of sessions (work sets as kg×reps@RPE):');
  const recent = finishedWorkouts(s).filter((w) => now - +new Date(w.startedAt) < 6 * WEEK);
  for (const w of recent.slice(-24)) lines.push(describeWorkout(s, w));
  if (!recent.length) lines.push('(none)');

  const diag = Object.values(s.diagnoses);
  if (diag.length) {
    lines.push('', 'Self-reported diagnostics:');
    for (const d of diag) {
      const parts = Object.entries(d.answers).map(([q, a]) => `${q}=${a.join('/')}`);
      lines.push(`- ${d.exerciseId === '_recovery' ? 'Recovery' : getExercise(d.exerciseId, s)?.name ?? d.exerciseId}: ${parts.join('; ')}`);
    }
  }
  const maxes = Object.entries(s.manualMaxes);
  if (maxes.length) lines.push('', `Tested maxes: ${maxes.map(([id, v]) => `${getExercise(id, s)?.name ?? id} ${v}`).join(', ')}.`);
  return lines.join('\n');
}

function describeWorkout(s: AppState, w: Workout): string {
  const ex = w.exercises
    .map((le) => {
      const sets = le.sets.filter(isWorkSet).map((x) => `${x.weight}×${x.reps}${x.rpe ? `@${x.rpe}` : ''}`);
      return sets.length ? `${getExercise(le.exerciseId, s)?.name ?? le.exerciseId}: ${sets.join(', ')}` : '';
    })
    .filter(Boolean)
    .join(' | ');
  return `- ${w.startedAt.slice(0, 10)}: ${ex}${w.notes ? ` (notes: ${w.notes.slice(0, 120)})` : ''}`;
}
