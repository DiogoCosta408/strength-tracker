import type { AppState, Exercise, LoggedExercise, LoggedSet, SetPrescription, StandardLift, Workout } from '../types';
import { e1rm, loadForRpe, roundTo } from './calc';
import { bodyweightAt, getExercise } from './store';
import { liftScore } from './strength';
import { weekKey } from './util';

export function isWorkSet(s: LoggedSet): boolean {
  return s.done && s.kind !== 'warmup' && s.reps > 0;
}

/** Total load moved per rep: adds bodyweight for bodyweight-loaded exercises. */
export function effectiveLoad(ex: Exercise | undefined, weight: number, bw: number | undefined): number {
  return ex?.bodyweightLoaded ? weight + (bw ?? 0) : weight;
}

export function finishedWorkouts(s: AppState): Workout[] {
  return s.workouts.filter((w) => w.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** e1RM of a logged set in total-load terms (includes bodyweight where relevant). */
export function setE1rm(s: AppState, ex: Exercise | undefined, set: LoggedSet, bw?: number): number {
  return e1rm(effectiveLoad(ex, set.weight, bw), set.reps, set.rpe, s.profile.e1rmFormula);
}

export interface SessionPoint {
  date: string;
  workoutId: string;
  e1rm: number; // total load
  topWeight: number;
  topReps: number;
  topRpe?: number;
  volume: number; // kg * reps over work sets (logged weight)
  sets: number;
  reps: number;
}

export function exerciseHistory(s: AppState, exerciseId: string): SessionPoint[] {
  const ex = getExercise(exerciseId, s);
  const out: SessionPoint[] = [];
  for (const w of finishedWorkouts(s)) {
    const bw = w.bodyweight ?? bodyweightAt(s, w.startedAt);
    for (const le of w.exercises) {
      if (le.exerciseId !== exerciseId) continue;
      const work = le.sets.filter(isWorkSet);
      if (!work.length) continue;
      let best = 0;
      let top = work[0];
      for (const set of work) {
        const v = setE1rm(s, ex, set, bw);
        if (v > best) best = v;
        if (set.weight > top.weight || (set.weight === top.weight && set.reps > top.reps)) top = set;
      }
      out.push({
        date: w.startedAt,
        workoutId: w.id,
        e1rm: best,
        topWeight: top.weight,
        topReps: top.reps,
        topRpe: top.rpe,
        volume: work.reduce((a, x) => a + x.weight * x.reps, 0),
        sets: work.length,
        reps: work.reduce((a, x) => a + x.reps, 0),
      });
    }
  }
  return out;
}

/** Best e1RM (total load) within the last `days` days, or all-time when omitted. Includes manual maxes. */
export function bestE1rm(s: AppState, exerciseId: string, days?: number): number {
  const since = days ? Date.now() - days * 86400000 : 0;
  let best = 0;
  for (const p of exerciseHistory(s, exerciseId)) {
    if (new Date(p.date).getTime() >= since && p.e1rm > best) best = p.e1rm;
  }
  const manual = s.manualMaxes[exerciseId];
  if (manual) {
    const ex = getExercise(exerciseId, s);
    best = Math.max(best, effectiveLoad(ex, manual, bodyweightAt(s)));
  }
  return best;
}

/** Heaviest actual weight lifted per rep count (1-12) — classic rep-max table. */
export function repMaxes(s: AppState, exerciseId: string): { reps: number; weight: number; date: string; rpe?: number }[] {
  const best = new Map<number, { weight: number; date: string; rpe?: number }>();
  for (const w of finishedWorkouts(s)) {
    for (const le of w.exercises) {
      if (le.exerciseId !== exerciseId) continue;
      for (const set of le.sets.filter(isWorkSet)) {
        const r = Math.min(set.reps, 12);
        const cur = best.get(r);
        if (!cur || set.weight > cur.weight) best.set(r, { weight: set.weight, date: w.startedAt, rpe: set.rpe });
      }
    }
  }
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([reps, v]) => ({ reps, ...v }));
}

export function lastPerformance(s: AppState, exerciseId: string, excludeWorkoutId?: string): { workout: Workout; entry: LoggedExercise } | undefined {
  const ws = finishedWorkouts(s);
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i];
    if (w.id === excludeWorkoutId) continue;
    const entry = w.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some(isWorkSet));
    if (entry) return { workout: w, entry };
  }
  return undefined;
}

/**
 * Suggested load (logged weight, kg) for a prescription. `topSet` is the session's top-set
 * load; `todayE1` is today's e1RM (total load) from sets already logged with an RPE, which
 * takes precedence over history for RPE-based sets.
 */
export function suggestLoad(s: AppState, exerciseId: string, p: SetPrescription, topSet?: number, todayE1?: number): number | undefined {
  const ex = getExercise(exerciseId, s);
  const bw = ex?.bodyweightLoaded ? bodyweightAt(s) ?? 0 : 0;
  const step = s.profile.rounding;
  const finish = (total: number) => Math.max(0, roundTo(total - bw, step));
  if (p.weight !== undefined) return p.weight;
  if (p.percentOfTop !== undefined) return topSet ? roundTo((topSet * p.percentOfTop) / 100, step) : undefined;
  if (p.lpIncrement !== undefined) {
    const last = lastPerformance(s, exerciseId);
    if (!last) return undefined;
    const work = last.entry.sets.filter((x) => x.done && x.kind !== 'warmup');
    if (!work.length) return undefined;
    const heaviest = Math.max(...work.map((x) => x.weight));
    const target = last.entry.sets.filter((x) => x.kind !== 'warmup' && x.weight === heaviest);
    const success = target.every((x) => x.done && x.reps >= (x.target?.reps ?? x.reps));
    return success ? heaviest + p.lpIncrement : heaviest;
  }
  // RPE sets follow today's performance once there is one; otherwise recent (6 weeks), then all-time.
  if (p.rpe !== undefined && todayE1) return finish(loadForRpe(todayE1, p.reps, p.rpe));
  const e1 = bestE1rm(s, exerciseId, 42) || bestE1rm(s, exerciseId);
  if (!e1) return undefined;
  if (p.percent !== undefined) return finish((e1 * p.percent) / 100);
  if (p.rpe !== undefined) return finish(loadForRpe(e1, p.reps, p.rpe));
  return undefined;
}

export interface LiftStanding {
  lift: StandardLift;
  exerciseId: string;
  e1rm: number;
  score: number;
}

/** Best recent e1RM for each canonical lift, scored against strength standards. */
export function standings(s: AppState): LiftStanding[] {
  const bw = bodyweightAt(s);
  if (!bw) return [];
  const age = s.profile.birthYear ? new Date().getFullYear() - s.profile.birthYear : undefined;
  const out: LiftStanding[] = [];
  for (const ex of standardLiftExercises(s)) {
    const best = bestE1rm(s, ex.id, 365) || bestE1rm(s, ex.id);
    if (!best) continue;
    out.push({ lift: ex.standard!, exerciseId: ex.id, e1rm: best, score: liftScore(ex.standard!, best, bw, s.profile.sex, age) });
  }
  return out;
}

/** One exercise per standard lift category (first logged custom variant, else the built-in). */
function standardLiftExercises(s: AppState): (Exercise & { standard: StandardLift })[] {
  const out: (Exercise & { standard: StandardLift })[] = [];
  const seen = new Set<StandardLift>();
  for (const ex of [...s.customExercises, ...allStandardExercises(s)]) {
    if (!ex.standard || seen.has(ex.standard)) continue;
    seen.add(ex.standard);
    out.push(ex as Exercise & { standard: StandardLift });
  }
  return out;
}

function allStandardExercises(s: AppState): Exercise[] {
  const ids = ['squat', 'front-squat', 'bench-press', 'incline-bench-press', 'deadlift', 'sumo-deadlift', 'press', 'push-press', 'snatch-grip-press', 'power-clean', 'barbell-row', 'chin-up', 'pull-up', 'dip'];
  return ids.map((id) => getExercise(id, s)).filter((x): x is Exercise => !!x);
}

/**
 * Overall strength score (average across standard lifts, like standings()) at weekly points
 * over the trailing period — for a trend chart. Uses the best e1RM logged up to each point and
 * bodyweight as of that date, same inputs liftScore() uses for the current score.
 */
export function strengthScoreHistory(s: AppState, weeks = 16): { date: string; score: number }[] {
  const bw = bodyweightAt(s);
  if (!bw) return [];
  const age = s.profile.birthYear ? new Date().getFullYear() - s.profile.birthYear : undefined;
  const histories = standardLiftExercises(s).map((ex) => ({ lift: ex.standard, points: exerciseHistory(s, ex.id) }));
  const out: { date: string; score: number }[] = [];
  const now = Date.now();
  for (let w = weeks - 1; w >= 0; w--) {
    const cutoff = now - w * 7 * 86400000;
    const cutoffIso = new Date(cutoff).toISOString();
    const bwAt = bodyweightAt(s, cutoffIso) ?? bw;
    const scores: number[] = [];
    for (const h of histories) {
      let best = 0;
      for (const p of h.points) if (new Date(p.date).getTime() <= cutoff && p.e1rm > best) best = p.e1rm;
      if (best) scores.push(liftScore(h.lift, best, bwAt, s.profile.sex, age));
    }
    if (scores.length) out.push({ date: cutoffIso, score: scores.reduce((a, x) => a + x, 0) / scores.length });
  }
  return out;
}

export interface WeekStat {
  week: string;
  tonnage: number;
  hardSets: number;
  sessions: number;
}

export function weeklyStats(s: AppState, weeks = 12): WeekStat[] {
  const map = new Map<string, WeekStat>();
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 86400000);
    const k = weekKey(d.toISOString());
    map.set(k, { week: k, tonnage: 0, hardSets: 0, sessions: 0 });
  }
  for (const w of finishedWorkouts(s)) {
    const st = map.get(weekKey(w.startedAt));
    if (!st) continue;
    st.sessions++;
    for (const le of w.exercises) {
      for (const set of le.sets.filter(isWorkSet)) {
        st.tonnage += set.weight * set.reps;
        if (set.rpe === undefined || set.rpe >= 7) st.hardSets++;
      }
    }
  }
  return [...map.values()];
}

export interface PR {
  exerciseId: string;
  type: 'e1rm' | 'rep';
  value: number;
  reps?: number;
  previous?: number;
}

/** PRs set in `w` compared with all earlier finished workouts. */
export function workoutPRs(s: AppState, w: Workout): PR[] {
  const prior = finishedWorkouts(s).filter((x) => x.id !== w.id && x.startedAt < w.startedAt);
  const bw = w.bodyweight ?? bodyweightAt(s, w.startedAt);
  const prs: PR[] = [];
  for (const le of w.exercises) {
    const ex = getExercise(le.exerciseId, s);
    const work = le.sets.filter(isWorkSet);
    if (!work.length) continue;
    let prevE1 = 0;
    const prevRep = new Map<number, number>();
    for (const pw of prior) {
      const pbw = pw.bodyweight ?? bodyweightAt(s, pw.startedAt);
      for (const pe of pw.exercises) {
        if (pe.exerciseId !== le.exerciseId) continue;
        for (const set of pe.sets.filter(isWorkSet)) {
          prevE1 = Math.max(prevE1, setE1rm(s, ex, set, pbw));
          prevRep.set(set.reps, Math.max(prevRep.get(set.reps) ?? 0, set.weight));
        }
      }
    }
    if (!prior.some((pw) => pw.exercises.some((pe) => pe.exerciseId === le.exerciseId))) continue; // first time isn't a PR
    const curE1 = Math.max(...work.map((x) => setE1rm(s, ex, x, bw)));
    if (curE1 > prevE1 + 0.05) prs.push({ exerciseId: le.exerciseId, type: 'e1rm', value: curE1, previous: prevE1 });
    const bestByReps = new Map<number, number>();
    for (const set of work) bestByReps.set(set.reps, Math.max(bestByReps.get(set.reps) ?? 0, set.weight));
    for (const [reps, wt] of bestByReps) {
      const prev = prevRep.get(reps);
      if (prev !== undefined && wt > prev) prs.push({ exerciseId: le.exerciseId, type: 'rep', value: wt, reps, previous: prev });
    }
  }
  return prs;
}

export function workoutTonnage(w: Workout): number {
  return w.exercises.reduce((a, le) => a + le.sets.filter(isWorkSet).reduce((b, x) => b + x.weight * x.reps, 0), 0);
}

export function trainingStreakWeeks(s: AppState): number {
  const weeks = new Set(finishedWorkouts(s).map((w) => weekKey(w.startedAt)));
  let n = 0;
  const d = new Date();
  // Current week counts if trained; otherwise start from last week.
  if (!weeks.has(weekKey(d.toISOString()))) d.setDate(d.getDate() - 7);
  while (weeks.has(weekKey(d.toISOString()))) {
    n++;
    d.setDate(d.getDate() - 7);
  }
  return n;
}
