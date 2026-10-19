import type { LoggedExercise, Workout } from '../types';
import { roundTo } from './calc';
import { update } from './store';
import { uid } from './util';

/** ~16 weeks of 3x/week RPE-style training with slowly rising maxes, for trying the app out. */
export function seedDemoData(): void {
  const weeks = 16;
  const start = Date.now() - weeks * 7 * 86400000;
  const workouts: Workout[] = [];
  const bodyweight: { id: string; date: string; weight: number }[] = [];
  let rnd = 7;
  const noise = () => {
    rnd = (rnd * 9301 + 49297) % 233280;
    return rnd / 233280 - 0.5;
  };
  const set = (weight: number, reps: number, rpe?: number, kind: 'work' | 'top' | 'backoff' | 'warmup' = 'work') => ({ id: uid(), kind, weight: roundTo(weight, 2.5), reps, rpe, done: true });
  const ex = (exerciseId: string, sets: ReturnType<typeof set>[]): LoggedExercise => ({ id: uid(), exerciseId, sets });

  for (let d = 0; d < weeks * 7; d++) {
    const t = start + d * 86400000;
    const date = new Date(t);
    const iso = date.toISOString();
    const progress = d / (weeks * 7);
    const bw = 84 + progress * 1.5 + noise() * 1.2;
    if (d % 2 === 0) bodyweight.push({ id: uid(), date: iso.slice(0, 10), weight: Math.round(bw * 10) / 10 });
    const dow = date.getDay();
    if (![1, 3, 5].includes(dow)) continue;
    const sq = 180 + progress * 15;
    const bp = 125 + progress * 8;
    const dl = 220 + progress * 17.5;
    const ohp = 75 + progress * 5;
    const top = (e1: number, reps: number, rpe: number) => e1 * [1, 0.955, 0.922, 0.892, 0.863][reps - 1] * (1 - (10 - rpe) * 0.03);
    let exercises: LoggedExercise[];
    let name: string;
    if (dow === 1) {
      name = 'Day 1 — Squat / Bench';
      const s = top(sq, 3, 8);
      const b = top(bp, 3, 8);
      exercises = [
        ex('squat', [set(60, 5, undefined, 'warmup'), set(100, 3, undefined, 'warmup'), set(140, 2, undefined, 'warmup'), set(s, 3, 8, 'top'), set(s * 0.9, 4, 7), set(s * 0.9, 4, 7), set(s * 0.9, 4, 7.5)]),
        ex('bench-press', [set(b, 3, 8, 'top'), set(b * 0.9, 5, 7.5), set(b * 0.9, 5, 8), set(b * 0.9, 5, 8)]),
        ex('barbell-row', [set(90, 8, 8), set(90, 8, 8), set(90, 8, 8.5)]),
      ];
    } else if (dow === 3) {
      name = 'Day 2 — Deadlift / Press';
      const dd = top(dl, 3, 8);
      exercises = [
        ex('deadlift', [set(100, 5, undefined, 'warmup'), set(160, 3, undefined, 'warmup'), set(dd, 3, 8, 'top'), set(dd * 0.9, 3, 7), set(dd * 0.9, 3, 7.5)]),
        ex('press', [set(top(ohp, 5, 8), 5, 8), set(top(ohp, 5, 8), 5, 8.5), set(top(ohp, 5, 8), 5, 9)]),
        ex('chin-up', [set(10 + progress * 7.5, 6, 8), set(10 + progress * 7.5, 6, 8.5), set(10 + progress * 7.5, 5, 9)]),
      ];
    } else {
      name = 'Day 3 — Variations';
      exercises = [
        ex('pause-squat', [set(top(sq * 0.88, 4, 7), 4, 7), set(top(sq * 0.88, 4, 7), 4, 7.5), set(top(sq * 0.88, 4, 7), 4, 8)]),
        ex('close-grip-bench', [set(top(bp * 0.92, 5, 8), 6, 8), set(top(bp * 0.92, 5, 8), 6, 8), set(top(bp * 0.92, 5, 8), 6, 8.5)]),
        ex('romanian-deadlift', [set(top(dl * 0.65, 5, 7), 8, 7), set(top(dl * 0.65, 5, 7), 8, 7.5), set(top(dl * 0.65, 5, 7), 8, 8)]),
        ex('dip', [set(15, 8, 8), set(15, 8, 8.5)]),
        ex('hip-thrust', [set(160 + progress * 20, 8, 8), set(160 + progress * 20, 8, 8)]),
      ];
    }
    const started = new Date(t);
    started.setHours(18, 0, 0, 0);
    workouts.push({ id: uid(), name, startedAt: started.toISOString(), finishedAt: new Date(started.getTime() + 75 * 60000).toISOString(), bodyweight: Math.round(bw * 10) / 10, exercises });
  }
  update((s) => ({ ...s, workouts: [...s.workouts, ...workouts], bodyweight: [...s.bodyweight, ...bodyweight] }));
}
