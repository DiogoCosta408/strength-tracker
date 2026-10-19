import type { AppState, ExercisePrescription, LoggedExercise, LoggedSet, Program, ProgramDay, Workout } from '../types';
import { flattenDays } from '../data/programs';
import { e1rm, roundTo, rpePercent, warmupRamp } from './calc';
import { bodyweightAt, getExercise, getProgram, update } from './store';
import { setE1rm, suggestLoad } from './stats';
import { clone, uid } from './util';

export function newSet(partial: Partial<LoggedSet> = {}): LoggedSet {
  return { id: uid(), kind: 'work', weight: 0, reps: 0, done: false, ...partial };
}

export function exerciseFromPrescription(s: AppState, p: ExercisePrescription): LoggedExercise {
  const sets = p.sets.map((sp) => {
    const w = sp.percentOfTop !== undefined ? undefined : suggestLoad(s, p.exerciseId, sp);
    return newSet({ kind: sp.kind, reps: sp.reps, rpe: undefined, weight: w ?? 0, autoWeight: true, target: { ...sp } });
  });
  return { id: uid(), exerciseId: p.exerciseId, sets, notes: p.notes, rest: p.rest };
}

export function emptyExercise(s: AppState, exerciseId: string): LoggedExercise {
  // Pre-fill with what was done last time, so repeating a session is one tap per set.
  const last = [...s.workouts]
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((w) => w.exercises)
    .find((e) => e.exerciseId === exerciseId);
  const sets = last
    ? last.sets.filter((x) => x.kind !== 'warmup').map((x) => newSet({ kind: x.kind, weight: x.weight, reps: x.reps }))
    : [newSet(), newSet(), newSet()];
  return { id: uid(), exerciseId, sets, rest: s.profile.defaultRest };
}

export function startWorkout(opts: { program?: Program; day?: ProgramDay; name?: string; copyOf?: Workout } = {}): void {
  update((s) => {
    if (s.activeWorkout) return s;
    let exercises: LoggedExercise[] = [];
    if (opts.day) exercises = opts.day.exercises.map((p) => exerciseFromPrescription(s, p));
    else if (opts.copyOf)
      exercises = opts.copyOf.exercises.map((e) => ({
        id: uid(),
        exerciseId: e.exerciseId,
        rest: e.rest,
        sets: e.sets.map((x) => newSet({ kind: x.kind, weight: x.weight, reps: x.reps, target: x.target })),
      }));
    const w: Workout = {
      id: uid(),
      name: opts.name ?? (opts.day ? `${opts.program?.name ?? ''} · ${opts.day.name}` : opts.copyOf?.name ?? 'Workout'),
      startedAt: new Date().toISOString(),
      programId: opts.program?.id,
      dayId: opts.day?.id,
      bodyweight: bodyweightAt(s),
      exercises,
    };
    return { ...s, activeWorkout: w };
  });
}

export function updateActive(fn: (w: Workout) => Workout): void {
  update((s) => (s.activeWorkout ? { ...s, activeWorkout: fn(s.activeWorkout) } : s));
}

export function updateExercise(id: string, fn: (e: LoggedExercise) => LoggedExercise): void {
  updateActive((w) => ({ ...w, exercises: w.exercises.map((e) => (e.id === id ? fn(e) : e)) }));
}

/** Insert a warm-up ramp toward the first work set's load. */
export function addWarmups(s: AppState, le: LoggedExercise): LoggedExercise {
  const ex = getExercise(le.exerciseId, s);
  const firstWork = le.sets.find((x) => x.kind !== 'warmup' && x.weight > 0);
  if (!firstWork) return le;
  const bar = ex?.equipment === 'barbell' ? s.profile.barWeight : 0;
  const ramp = warmupRamp(firstWork.weight, bar, s.profile.rounding);
  const warmups = ramp.map((r) => newSet({ kind: 'warmup', weight: r.weight, reps: r.reps }));
  return { ...le, sets: [...warmups, ...le.sets.filter((x) => x.kind !== 'warmup')] };
}

/** Today's e1RM (total load) for an exercise entry, from completed work sets that have an RPE. */
export function todayE1rm(s: AppState, le: LoggedExercise): number | undefined {
  const ex = getExercise(le.exerciseId, s);
  const bw = bodyweightAt(s);
  const vals = le.sets.filter((x) => x.done && x.kind !== 'warmup' && x.rpe !== undefined && x.reps > 0).map((x) => setE1rm(s, ex, x, bw));
  return vals.length ? Math.max(...vals) : undefined;
}

/**
 * Load that back-off sets are calculated from. If the top set overshot its target RPE,
 * use the weight that would have matched the target instead of the overshoot.
 */
export function topSetBase(s: AppState, le: LoggedExercise): number | undefined {
  const top = [...le.sets].reverse().find((x) => x.kind === 'top' && x.done && x.weight > 0);
  if (!top) return undefined;
  const target = top.target?.rpe;
  if (target !== undefined && top.rpe !== undefined && top.rpe > target && !getExercise(le.exerciseId, s)?.bodyweightLoaded) {
    const e1 = e1rm(top.weight, top.reps, top.rpe);
    return Math.min(top.weight, roundTo(e1 * rpePercent(top.reps, target), s.profile.rounding));
  }
  return top.weight;
}

/**
 * After a set is logged, re-suggest the remaining app-filled sets: RPE sets follow today's
 * e1RM (so a set that felt harder than planned means a smaller jump next), and back-offs
 * follow the top set. Weights the lifter typed are never touched.
 */
export function reflowSuggestions(s: AppState, le: LoggedExercise): LoggedExercise {
  const today = todayE1rm(s, le);
  const base = topSetBase(s, le);
  return {
    ...le,
    sets: le.sets.map((x) => {
      if (x.done || !x.autoWeight || !x.target) return x;
      if (x.target.percentOfTop !== undefined) return base ? { ...x, weight: roundTo((base * x.target.percentOfTop) / 100, s.profile.rounding) } : x;
      if (x.target.rpe !== undefined && today) {
        const w = suggestLoad(s, le.exerciseId, x.target, undefined, today);
        return w !== undefined ? { ...x, weight: w } : x;
      }
      return x;
    }),
  };
}

export function finishActive(): Workout | undefined {
  let finished: Workout | undefined;
  update((s) => {
    const w = s.activeWorkout;
    if (!w) return s;
    // Drop untouched sets and empty exercises.
    const exercises = w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
      .filter((e) => e.sets.length);
    finished = { ...w, exercises, finishedAt: new Date().toISOString() };
    let activeProgram = s.activeProgram;
    if (activeProgram && w.programId === activeProgram.programId && w.dayId) {
      const p = getProgram(activeProgram.programId, s);
      if (p) {
        const days = flattenDays(p);
        const idx = days.findIndex((d) => d.day.id === w.dayId);
        if (idx >= 0) activeProgram = { ...activeProgram, nextIndex: (idx + 1) % days.length };
      }
    }
    return { ...s, workouts: [...s.workouts, finished], activeWorkout: undefined, activeProgram };
  });
  return finished;
}

export function discardActive(): void {
  update((s) => ({ ...s, activeWorkout: undefined }));
}

export function nextProgramDay(s: AppState): { program: Program; day: ProgramDay; week: string } | undefined {
  if (!s.activeProgram) return undefined;
  const p = getProgram(s.activeProgram.programId, s);
  if (!p) return undefined;
  const days = flattenDays(p);
  const d = days[s.activeProgram.nextIndex % days.length];
  return d ? { program: p, day: d.day, week: d.week } : undefined;
}

export function duplicateProgram(p: Program): Program {
  const c = clone(p);
  c.id = 'user-' + uid();
  c.name = p.name + ' (copy)';
  c.builtIn = false;
  c.weeks.forEach((w) => w.days.forEach((d) => (d.id = uid())));
  return c;
}
