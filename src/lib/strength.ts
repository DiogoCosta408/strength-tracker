import type { Muscle, Sex, StandardLift } from '../types';

/**
 * Strength standards expressed as 1RM / bodyweight ratios for adult males.
 * Thresholds mark the start of: Novice, Intermediate, Advanced, Elite, World class.
 * For bodyweight-loaded lifts (chin-up, pull-up, dip) the ratio is (bodyweight + added) / bodyweight.
 * These are approximations compiled from common public standards; treat them as a guide.
 */
const MALE_STANDARDS: Record<StandardLift, [number, number, number, number, number]> = {
  squat: [1.0, 1.5, 2.0, 2.5, 3.0],
  frontSquat: [0.85, 1.25, 1.65, 2.05, 2.45],
  bench: [0.75, 1.0, 1.4, 1.8, 2.2],
  inclineBench: [0.6, 0.85, 1.2, 1.5, 1.85],
  deadlift: [1.25, 1.75, 2.25, 2.85, 3.4],
  sumoDeadlift: [1.25, 1.75, 2.25, 2.85, 3.4],
  press: [0.5, 0.7, 0.9, 1.1, 1.35],
  powerClean: [0.65, 0.9, 1.15, 1.4, 1.65],
  row: [0.6, 0.85, 1.15, 1.45, 1.75],
  chinup: [1.05, 1.3, 1.55, 1.8, 2.05],
  pullup: [1.0, 1.25, 1.5, 1.75, 2.0],
  dip: [1.1, 1.4, 1.75, 2.1, 2.45],
  rdl: [0.95, 1.4, 1.85, 2.3, 2.75],
  hipThrust: [1.0, 1.6, 2.2, 2.8, 3.4],
};

/** Female standards as a fraction of male ratios (upper body is relatively lower). */
const FEMALE_FACTOR: Record<StandardLift, number> = {
  squat: 0.72,
  frontSquat: 0.72,
  bench: 0.6,
  inclineBench: 0.6,
  deadlift: 0.75,
  sumoDeadlift: 0.75,
  press: 0.62,
  powerClean: 0.7,
  row: 0.65,
  chinup: 0.82,
  pullup: 0.82,
  dip: 0.8,
  rdl: 0.75,
  hipThrust: 0.85,
};

export const LIFT_LABELS: Record<StandardLift, string> = {
  squat: 'Squat',
  frontSquat: 'Front squat',
  bench: 'Bench press',
  inclineBench: 'Incline bench',
  deadlift: 'Deadlift',
  sumoDeadlift: 'Sumo deadlift',
  press: 'Overhead press',
  powerClean: 'Power clean',
  row: 'Barbell row',
  chinup: 'Chin-up',
  pullup: 'Pull-up',
  dip: 'Dip',
  rdl: 'Romanian deadlift',
  hipThrust: 'Hip thrust',
};

export const LEVELS = [
  { name: 'Beginner', min: 0 },
  { name: 'Novice', min: 20 },
  { name: 'Intermediate', min: 40 },
  { name: 'Advanced', min: 60 },
  { name: 'Elite', min: 80 },
  { name: 'World class', min: 100 },
] as const;

export function levelFor(score: number): string {
  let name: string = LEVELS[0].name;
  for (const l of LEVELS) if (score >= l.min) name = l.name;
  return name;
}

/** Age adjustment (masters / juniors), loosely based on McCulloch-style coefficients. */
export function ageFactor(age?: number): number {
  if (!age) return 1;
  if (age < 23) return 1 + (23 - age) * 0.02;
  if (age <= 40) return 1;
  return 1 + (age - 40) * 0.01 + Math.max(0, age - 55) * 0.01;
}

export function standardsFor(lift: StandardLift, sex: Sex): number[] {
  const f = sex === 'male' ? 1 : FEMALE_FACTOR[lift];
  return MALE_STANDARDS[lift].map((x) => x * f);
}

/**
 * Score 0..~120 for a lift: thresholds map to 20/40/60/80/100, linear in between,
 * below Novice scales linearly from 0, above World class extrapolates.
 */
export function liftScore(lift: StandardLift, oneRm: number, bodyweight: number, sex: Sex, age?: number): number {
  if (!oneRm || !bodyweight) return 0;
  const ratio = (oneRm / bodyweight) * ageFactor(age);
  const t = standardsFor(lift, sex);
  if (ratio <= t[0]) return (ratio / t[0]) * 20;
  for (let i = 1; i < t.length; i++) {
    if (ratio <= t[i]) return 20 * i + ((ratio - t[i - 1]) / (t[i] - t[i - 1])) * 20;
  }
  const last = t[t.length - 1] - t[t.length - 2];
  return Math.min(125, 100 + ((ratio - t[t.length - 1]) / last) * 20);
}

/** Load needed to reach a given score threshold. */
export function loadForLevel(lift: StandardLift, levelIndex: number, bodyweight: number, sex: Sex, age?: number): number {
  const t = standardsFor(lift, sex);
  return (t[levelIndex - 1] * bodyweight) / ageFactor(age);
}

/** How much each lift trains each muscle (0..1). Drives the body map. */
export const LIFT_MUSCLES: Record<StandardLift, Partial<Record<Muscle, number>>> = {
  squat: { quads: 1, glutes: 0.9, adductors: 0.8, lowerBack: 0.5, hamstrings: 0.3, abs: 0.3, obliques: 0.3, calves: 0.15 },
  frontSquat: { quads: 1, glutes: 0.6, adductors: 0.5, upperBack: 0.4, abs: 0.5, obliques: 0.3 },
  bench: { chest: 1, frontDelts: 0.7, triceps: 0.8, lats: 0.15 },
  inclineBench: { chest: 0.9, frontDelts: 0.9, triceps: 0.6 },
  deadlift: { lowerBack: 1, glutes: 0.9, hamstrings: 0.8, traps: 0.7, upperBack: 0.6, lats: 0.4, quads: 0.4, forearms: 0.7, adductors: 0.4 },
  sumoDeadlift: { glutes: 1, adductors: 0.9, quads: 0.6, lowerBack: 0.8, hamstrings: 0.6, traps: 0.6, upperBack: 0.5, forearms: 0.7 },
  press: { frontDelts: 1, sideDelts: 0.7, triceps: 0.8, traps: 0.4, upperBack: 0.3, abs: 0.3 },
  powerClean: { traps: 1, glutes: 0.6, quads: 0.5, hamstrings: 0.5, lowerBack: 0.5, upperBack: 0.6, calves: 0.3, rearDelts: 0.3, forearms: 0.4 },
  row: { upperBack: 1, lats: 0.9, rearDelts: 0.7, biceps: 0.5, lowerBack: 0.4, forearms: 0.4, traps: 0.4 },
  chinup: { lats: 1, biceps: 0.9, upperBack: 0.6, forearms: 0.5, abs: 0.2 },
  pullup: { lats: 1, upperBack: 0.7, biceps: 0.6, forearms: 0.5, rearDelts: 0.3 },
  dip: { triceps: 1, chest: 0.7, frontDelts: 0.6 },
  rdl: { hamstrings: 1, glutes: 0.8, lowerBack: 0.8, forearms: 0.4, upperBack: 0.3 },
  hipThrust: { glutes: 1, hamstrings: 0.4, quads: 0.2 },
};

export const ALL_MUSCLES: Muscle[] = [
  'chest', 'frontDelts', 'sideDelts', 'rearDelts', 'triceps', 'biceps', 'forearms', 'traps', 'upperBack',
  'lats', 'lowerBack', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves',
];

/** Weighted mean of lift scores per muscle. Muscles not covered by any logged lift → null. */
export function muscleScores(scores: Partial<Record<StandardLift, number>>): Record<Muscle, number | null> {
  const out = {} as Record<Muscle, number | null>;
  for (const m of ALL_MUSCLES) {
    let sum = 0;
    let wsum = 0;
    for (const [lift, s] of Object.entries(scores) as [StandardLift, number][]) {
      const w = LIFT_MUSCLES[lift][m];
      // Weight^2 so the lifts that really drive a muscle dominate its colour.
      if (w) {
        sum += s * w * w;
        wsum += w * w;
      }
    }
    out[m] = wsum >= 0.1 ? sum / wsum : null;
  }
  return out;
}

/** Colour ramp: red (weak) → amber → green → blue → purple (world class). */
const STOPS: [number, [number, number, number]][] = [
  [0, [120, 120, 130]],
  [20, [214, 69, 65]],
  [40, [236, 150, 50]],
  [60, [222, 205, 60]],
  [80, [70, 185, 100]],
  [100, [60, 140, 230]],
  [120, [150, 90, 220]],
];

/**
 * How even strength is across logged lifts (100 = all at the same score, lower = more
 * imbalanced) — a Symmetric Strength-style secondary stat alongside the overall score.
 */
export function balanceScore(scores: { score: number }[]): number {
  if (scores.length < 2) return 100;
  const avg = scores.reduce((a, x) => a + x.score, 0) / scores.length;
  const avgDeviation = scores.reduce((a, x) => a + Math.abs(x.score - avg), 0) / scores.length;
  return Math.max(0, 100 - avgDeviation * 2);
}

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'var(--muscle-empty, #4a505c)';
  const s = Math.max(0, Math.min(120, score));
  for (let i = 1; i < STOPS.length; i++) {
    const [s1, c1] = STOPS[i];
    const [s0, c0] = STOPS[i - 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  const c = STOPS[STOPS.length - 1][1];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
