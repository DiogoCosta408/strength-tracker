import type { Sex } from '../types';

/**
 * RTS / Tuchscherer RPE chart collapsed into one sequence: every rep and every
 * half RPE point below 10 moves one step down. %1RM = RPE_SEQ[(reps-1)*2 + (10-rpe)*2].
 * Covers reps 1-12 at RPE 6-10.
 */
const RPE_SEQ = [
  100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4,
  76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6, 57.2,
];

export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Fraction of 1RM that `reps` @ `rpe` represents (e.g. 5 @ 8 → 0.811). */
export function rpePercent(reps: number, rpe = 10): number {
  const r = Math.max(1, Math.round(reps));
  const clampedRpe = Math.min(10, Math.max(4, rpe));
  // Reps in reserve are equivalent to extra reps at RPE 10.
  const effectiveReps = r + (10 - clampedRpe);
  const idx = (effectiveReps - 1) * 2;
  if (idx <= RPE_SEQ.length - 1) {
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const v = RPE_SEQ[lo] + (RPE_SEQ[hi] - RPE_SEQ[lo]) * (idx - lo);
    return v / 100;
  }
  // Beyond the chart, fall back to Epley on effective reps.
  return 1 / (1 + effectiveReps / 30);
}

export type Formula = 'epley' | 'brzycki' | 'lombardi' | 'mayhew' | 'oconner' | 'wathan' | 'lander';

export const FORMULAS: { id: Formula; name: string; fn: (w: number, r: number) => number }[] = [
  { id: 'epley', name: 'Epley', fn: (w, r) => (r === 1 ? w : w * (1 + r / 30)) },
  { id: 'brzycki', name: 'Brzycki', fn: (w, r) => (r >= 37 ? NaN : (w * 36) / (37 - r)) },
  { id: 'lombardi', name: 'Lombardi', fn: (w, r) => w * Math.pow(r, 0.1) },
  { id: 'mayhew', name: 'Mayhew', fn: (w, r) => (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)) },
  { id: 'oconner', name: "O'Conner", fn: (w, r) => w * (1 + 0.025 * r) },
  { id: 'wathan', name: 'Wathan', fn: (w, r) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)) },
  { id: 'lander', name: 'Lander', fn: (w, r) => (100 * w) / (101.3 - 2.67123 * r) },
];

/**
 * Estimated 1RM for a set. With RPE we use the RPE chart (accounts for reps in
 * reserve); without it we assume RPE 10 and use the chosen formula.
 */
export function e1rm(weight: number, reps: number, rpe?: number, formula: 'epley' | 'brzycki' = 'epley'): number {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1 && (rpe === undefined || rpe >= 10)) return weight;
  if (rpe !== undefined && rpe > 0) return weight / rpePercent(reps, rpe);
  const f = FORMULAS.find((x) => x.id === formula)!;
  return f.fn(weight, reps);
}

/** Load for reps @ RPE given an e1RM. */
export function loadForRpe(e1: number, reps: number, rpe: number): number {
  return e1 * rpePercent(reps, rpe);
}

export function roundTo(x: number, step: number): number {
  if (!step) return x;
  return Math.round(x / step) * step;
}

export function fmtKg(x: number | undefined, digits = 1): string {
  if (x === undefined || !isFinite(x)) return '–';
  const r = Math.round(x * 10 ** digits) / 10 ** digits;
  return `${r}`;
}

// ---------------------------------------------------------------------------
// Bodyweight-relative scoring formulas

function poly(coeffs: number[], x: number): number {
  return coeffs.reduce((acc, c, i) => acc + c * Math.pow(x, i), 0);
}

const WILKS_M = [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8];
const WILKS_F = [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];

/** Original Wilks (1995-2020). */
export function wilks(total: number, bw: number, sex: Sex): number {
  const x = sex === 'male' ? clamp(bw, 40, 201.9) : clamp(bw, 26.51, 154.53);
  return (total * 500) / poly(sex === 'male' ? WILKS_M : WILKS_F, x);
}

const WILKS2_M = [47.4617885411949, 8.47206137941125, 0.073694103462609, -0.00139583381094385, 7.07665973070743e-6, -1.20804336482315e-8];
const WILKS2_F = [-125.425539779509, 13.7121941940668, -0.0330725063103405, -0.0010504000506583, 9.38773881462799e-6, -2.3334613884954e-8];

/** Wilks 2020 ("Wilks2"). */
export function wilks2(total: number, bw: number, sex: Sex): number {
  const x = sex === 'male' ? clamp(bw, 40, 200.95) : clamp(bw, 40, 150.95);
  return (total * 600) / poly(sex === 'male' ? WILKS2_M : WILKS2_F, x);
}

const DOTS_M = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
const DOTS_F = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];

export function dots(total: number, bw: number, sex: Sex): number {
  const x = sex === 'male' ? clamp(bw, 40, 210) : clamp(bw, 40, 150);
  return (total * 500) / poly(sex === 'male' ? DOTS_M : DOTS_F, x);
}

type GlEvent = 'classic-sbd' | 'equipped-sbd' | 'classic-bench' | 'equipped-bench';
const GL: Record<Sex, Record<GlEvent, [number, number, number]>> = {
  male: {
    'classic-sbd': [1199.72839, 1025.18162, 0.00921],
    'equipped-sbd': [1236.25115, 1449.21864, 0.01644],
    'classic-bench': [320.98041, 281.40258, 0.01008],
    'equipped-bench': [381.22073, 733.79378, 0.02398],
  },
  female: {
    'classic-sbd': [610.32796, 1045.59282, 0.03048],
    'equipped-sbd': [758.63878, 949.31382, 0.02435],
    'classic-bench': [142.40398, 442.52671, 0.04724],
    'equipped-bench': [221.82209, 357.00377, 0.02937],
  },
};

/** IPF GoodLift points (2020). */
export function ipfGl(total: number, bw: number, sex: Sex, event: GlEvent = 'classic-sbd'): number {
  if (bw < 35) return 0;
  const [a, b, c] = GL[sex][event];
  return (total * 100) / (a - b * Math.exp(-c * bw));
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

// ---------------------------------------------------------------------------
// Plates

/** Greedy plate loading per side. Returns plates used and any remainder that can't be loaded. */
export function platesFor(target: number, bar: number, plates: number[]): { perSide: number[]; remainder: number } {
  let side = (target - bar) / 2;
  const perSide: number[] = [];
  if (side <= 0) return { perSide, remainder: Math.max(0, target - bar) };
  const sorted = [...plates].sort((a, b) => b - a);
  for (const p of sorted) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side -= p;
    }
  }
  return { perSide, remainder: Math.round(side * 2 * 100) / 100 };
}

/** Classic warm-up ramp toward a working weight. */
export function warmupRamp(work: number, bar: number, step: number): { weight: number; reps: number }[] {
  if (work <= bar) return [];
  const pcts: [number, number][] = [
    [0, 5],
    [0.4, 5],
    [0.6, 3],
    [0.75, 2],
    [0.85, 1],
    [0.92, 1],
  ];
  const out: { weight: number; reps: number }[] = [];
  for (const [p, reps] of pcts) {
    const w = p === 0 ? bar : Math.max(bar, roundTo(work * p, step));
    if (w >= work) break;
    if (out.length && out[out.length - 1].weight === w) continue;
    out.push({ weight: w, reps });
  }
  return out;
}
