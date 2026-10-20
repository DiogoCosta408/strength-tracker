import type { Muscle, Sex, StandardLift } from '../types';

/**
 * Strength standards as 1RM / bodyweight ratios, one column per level:
 * Untrained, Novice, Intermediate, Proficient, Advanced, Exceptional, Elite, World class.
 *
 * Derived from Symmetric Strength's published standards (symmetricstrength.com/standards),
 * read off their 80 kg male and 63 kg female reference tables and divided by that bodyweight.
 * For bodyweight-loaded lifts (chin-up, pull-up, dip) their "+kg added" figures are converted
 * to a total-load ratio, (bodyweight + added) / bodyweight, which is what this app scores.
 *
 * Their model scales by Wilks rather than a flat bodyweight ratio, so these are a close
 * approximation anchored at those two bodyweights rather than an exact reproduction.
 */
type Standards = [number, number, number, number, number, number, number, number];

const MALE_STANDARDS: Record<StandardLift, Standards> = {
  squat: [0.763, 1.138, 1.513, 1.9, 2.213, 2.525, 2.85, 3.163],
  frontSquat: [0.613, 0.913, 1.213, 1.513, 1.775, 2.025, 2.275, 2.525],
  bench: [0.563, 0.85, 1.138, 1.413, 1.65, 1.888, 2.125, 2.363],
  inclineBench: [0.463, 0.7, 0.925, 1.163, 1.35, 1.55, 1.738, 1.938],
  deadlift: [0.875, 1.313, 1.75, 2.175, 2.538, 2.913, 3.275, 3.638],
  sumoDeadlift: [0.875, 1.313, 1.75, 2.175, 2.538, 2.913, 3.275, 3.638],
  press: [0.363, 0.55, 0.738, 0.925, 1.075, 1.225, 1.388, 1.538],
  pushPress: [0.488, 0.738, 0.975, 1.225, 1.425, 1.638, 1.838, 2.038],
  snatchGripPress: [0.3, 0.438, 0.588, 0.738, 0.863, 0.988, 1.1, 1.225],
  powerClean: [0.488, 0.738, 0.975, 1.225, 1.425, 1.625, 1.825, 2.038],
  row: [0.463, 0.688, 0.925, 1.15, 1.35, 1.538, 1.738, 1.925],
  chinup: [1.013, 1.15, 1.313, 1.5, 1.663, 1.825, 1.975, 2.125],
  pullup: [0.975, 1.138, 1.275, 1.438, 1.6, 1.763, 1.913, 2.05],
  dip: [1.1, 1.288, 1.5, 1.713, 1.925, 2.125, 2.313, 2.525],
};

const FEMALE_STANDARDS: Record<StandardLift, Standards> = {
  squat: [0.619, 0.921, 1.238, 1.54, 1.81, 2.063, 2.317, 2.571],
  frontSquat: [0.492, 0.746, 0.984, 1.238, 1.444, 1.651, 1.857, 2.063],
  bench: [0.413, 0.635, 0.841, 1.048, 1.222, 1.397, 1.571, 1.746],
  inclineBench: [0.349, 0.524, 0.683, 0.857, 1.0, 1.143, 1.286, 1.429],
  deadlift: [0.73, 1.111, 1.476, 1.841, 2.143, 2.46, 2.762, 3.063],
  sumoDeadlift: [0.73, 1.111, 1.476, 1.841, 2.143, 2.46, 2.762, 3.063],
  press: [0.27, 0.413, 0.54, 0.683, 0.794, 0.905, 1.016, 1.143],
  pushPress: [0.365, 0.54, 0.73, 0.905, 1.063, 1.206, 1.365, 1.508],
  snatchGripPress: [0.222, 0.333, 0.429, 0.54, 0.635, 0.73, 0.825, 0.905],
  powerClean: [0.413, 0.619, 0.825, 1.032, 1.206, 1.381, 1.54, 1.714],
  row: [0.397, 0.587, 0.778, 0.968, 1.143, 1.302, 1.46, 1.619],
  chinup: [0.794, 0.921, 1.032, 1.159, 1.286, 1.413, 1.54, 1.635],
  // Their table has no untrained pull-up figure for women; extrapolated from the step above it.
  pullup: [0.762, 0.889, 1.016, 1.127, 1.238, 1.365, 1.492, 1.587],
  dip: [0.857, 1.0, 1.127, 1.27, 1.397, 1.54, 1.667, 1.794],
};

export const LIFT_LABELS: Record<StandardLift, string> = {
  squat: 'Back squat',
  frontSquat: 'Front squat',
  bench: 'Bench press',
  inclineBench: 'Incline bench',
  deadlift: 'Deadlift',
  sumoDeadlift: 'Sumo deadlift',
  press: 'Overhead press',
  pushPress: 'Push press',
  snatchGripPress: 'Snatch-grip press',
  powerClean: 'Power clean',
  row: 'Pendlay row',
  chinup: 'Chin-up',
  pullup: 'Pull-up',
  dip: 'Dip',
};

/** Symmetric Strength's eight benchmark levels. `min` is where each one starts on the 0-100 score. */
export const LEVELS = [
  { name: 'Untrained', min: 0 },
  { name: 'Novice', min: 25 },
  { name: 'Intermediate', min: 37.5 },
  { name: 'Proficient', min: 50 },
  { name: 'Advanced', min: 62.5 },
  { name: 'Exceptional', min: 75 },
  { name: 'Elite', min: 87.5 },
  { name: 'World class', min: 100 },
] as const;

/**
 * Score each standards column maps to. The untrained column lands mid-way through the
 * untrained band rather than at 0, so there's still room to show progress below it — a
 * beginner working up to the untrained standard moves from 0 to 12.5 rather than sitting at 0.
 */
const LEVEL_SCORES: Standards = [12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];

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

export function standardsFor(lift: StandardLift, sex: Sex): Standards {
  return sex === 'male' ? MALE_STANDARDS[lift] : FEMALE_STANDARDS[lift];
}

/**
 * Score 0..~125 for a lift: each standards column maps to its level's score, linear in
 * between, below the untrained standard scales from 0, above world class extrapolates.
 */
export function liftScore(lift: StandardLift, oneRm: number, bodyweight: number, sex: Sex, age?: number): number {
  if (!oneRm || !bodyweight) return 0;
  const ratio = (oneRm / bodyweight) * ageFactor(age);
  const t = standardsFor(lift, sex);
  if (ratio <= t[0]) return (ratio / t[0]) * LEVEL_SCORES[0];
  for (let i = 1; i < t.length; i++) {
    if (ratio <= t[i]) return LEVEL_SCORES[i - 1] + ((ratio - t[i - 1]) / (t[i] - t[i - 1])) * (LEVEL_SCORES[i] - LEVEL_SCORES[i - 1]);
  }
  const n = t.length - 1;
  return Math.min(125, LEVEL_SCORES[n] + ((ratio - t[n]) / (t[n] - t[n - 1])) * (LEVEL_SCORES[n] - LEVEL_SCORES[n - 1]));
}

/** Load that reaches a given level (index into LEVELS). */
export function loadForLevel(lift: StandardLift, levelIndex: number, bodyweight: number, sex: Sex, age?: number): number {
  const t = standardsFor(lift, sex);
  const i = Math.max(0, Math.min(t.length - 1, levelIndex));
  return (t[i] * bodyweight) / ageFactor(age);
}

/** Inverse of liftScore: the load that would score this many points. */
export function loadForScore(lift: StandardLift, score: number, bodyweight: number, sex: Sex, age?: number): number {
  const t = standardsFor(lift, sex);
  let ratio: number;
  if (score <= LEVEL_SCORES[0]) {
    ratio = (score / LEVEL_SCORES[0]) * t[0];
  } else {
    const i = LEVEL_SCORES.findIndex((s) => score <= s);
    const hi = i === -1 ? t.length - 1 : i;
    const lo = hi - 1;
    const span = LEVEL_SCORES[hi] - LEVEL_SCORES[lo];
    ratio = t[lo] + ((score - LEVEL_SCORES[lo]) / span) * (t[hi] - t[lo]);
  }
  return (ratio * bodyweight) / ageFactor(age);
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
  pushPress: { frontDelts: 1, sideDelts: 0.7, triceps: 0.7, quads: 0.4, glutes: 0.3, traps: 0.4, abs: 0.3 },
  snatchGripPress: { frontDelts: 1, sideDelts: 0.8, triceps: 0.6, traps: 0.5, upperBack: 0.4 },
  powerClean: { traps: 1, glutes: 0.6, quads: 0.5, hamstrings: 0.5, lowerBack: 0.5, upperBack: 0.6, calves: 0.3, rearDelts: 0.3, forearms: 0.4 },
  row: { upperBack: 1, lats: 0.9, rearDelts: 0.7, biceps: 0.5, lowerBack: 0.4, forearms: 0.4, traps: 0.4 },
  chinup: { lats: 1, biceps: 0.9, upperBack: 0.6, forearms: 0.5, abs: 0.2 },
  pullup: { lats: 1, upperBack: 0.7, biceps: 0.6, forearms: 0.5, rearDelts: 0.3 },
  dip: { triceps: 1, chest: 0.7, frontDelts: 0.6 },
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

/** Colour ramp, one stop per level: grey (untrained) → red → amber → green → teal → blue → purple. */
const STOPS: [number, [number, number, number]][] = [
  [0, [120, 120, 130]],
  [25, [214, 69, 65]],
  [37.5, [236, 150, 50]],
  [50, [222, 205, 60]],
  [62.5, [70, 185, 100]],
  [75, [45, 180, 165]],
  [87.5, [60, 140, 230]],
  [100, [150, 90, 220]],
  [125, [196, 92, 196]],
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
  const s = Math.max(0, Math.min(125, score));
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
