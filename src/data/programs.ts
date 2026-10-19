import type { ExercisePrescription, Program, ProgramDay, SetPrescription, SetKind } from '../types';

// Compact builders ----------------------------------------------------------

const rep = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => ({ ...x }));

/** n sets × reps with linear progression (+inc kg each successful session). */
const lp = (n: number, reps: number, inc: number): SetPrescription[] => rep(n, { kind: 'work' as SetKind, reps, lpIncrement: inc });
/** n sets × reps @ RPE. */
const atRpe = (n: number, reps: number, rpe: number, kind: SetKind = 'work'): SetPrescription[] => rep(n, { kind, reps, rpe });
/** n sets × reps @ % of e1RM. */
const pct = (n: number, reps: number, percent: number, kind: SetKind = 'work'): SetPrescription[] => rep(n, { kind, reps, percent });
/** Top set @ RPE followed by back-off sets at a % of the top set. */
const topBack = (reps: number, rpe: number, backSets: number, backReps: number, percentOfTop: number): SetPrescription[] => [
  { kind: 'top', reps, rpe },
  ...rep(backSets, { kind: 'backoff' as SetKind, reps: backReps, percentOfTop }),
];
/** Plain sets × reps without a load rule (accessories). */
const plain = (n: number, reps: number): SetPrescription[] => rep(n, { kind: 'work' as SetKind, reps });

const ex = (exerciseId: string, sets: SetPrescription[], rest = 180, notes?: string): ExercisePrescription => ({ exerciseId, sets, rest, notes });
const day = (id: string, name: string, exercises: ExercisePrescription[]): ProgramDay => ({ id, name, exercises });

// Starting Strength -----------------------------------------------------------

const ssA = day('ss-a', 'Workout A', [ex('squat', lp(3, 5, 2.5), 300), ex('press', lp(3, 5, 1.25), 240), ex('deadlift', lp(1, 5, 5), 300)]);
const ssB = day('ss-b', 'Workout B', [ex('squat', lp(3, 5, 2.5), 300), ex('bench-press', lp(3, 5, 1.25), 240), ex('power-clean', lp(5, 3, 2.5), 180)]);

const startingStrength: Program = {
  id: 'starting-strength',
  name: 'Starting Strength — Novice LP',
  author: 'Mark Rippetoe',
  level: 'beginner',
  builtIn: true,
  description:
    'Classic novice linear progression. Alternate workouts A and B three times per week. Add weight every session while all reps are completed; a missed session repeats the load. Use the warm-up ramp button before work sets.',
  weeks: [
    { name: 'Week 1', days: [ssA, { ...ssB, id: 'ss-b1' }, { ...ssA, id: 'ss-a2' }] },
    { name: 'Week 2', days: [{ ...ssB, id: 'ss-b2' }, { ...ssA, id: 'ss-a3' }, { ...ssB, id: 'ss-b3' }] },
  ],
};

// RPE novice (Barbell Medicine style) -----------------------------------------

const rpeNovice: Program = {
  id: 'rpe-novice',
  name: 'RPE Novice (Barbell Medicine style)',
  author: 'Inspired by Barbell Medicine',
  level: 'beginner',
  builtIn: true,
  description:
    'Autoregulated novice template: a top set at RPE 8 followed by back-off sets at ~92.5% of the top set. Loads are suggested from your recent e1RM. Inspired by the Barbell Medicine beginner approach — their official templates are available from barbellmedicine.com.',
  weeks: [
    {
      name: 'Week',
      days: [
        day('rn-1', 'Day 1', [
          ex('squat', topBack(5, 8, 2, 5, 92.5), 240),
          ex('bench-press', topBack(5, 8, 2, 5, 92.5), 210),
          ex('romanian-deadlift', atRpe(3, 8, 7), 150),
          ex('chin-up', atRpe(3, 8, 8), 120),
        ]),
        day('rn-2', 'Day 2', [
          ex('deadlift', topBack(5, 8, 2, 5, 92.5), 240),
          ex('press', topBack(5, 8, 2, 5, 92.5), 180),
          ex('front-squat', atRpe(3, 6, 7), 180),
          ex('barbell-row', atRpe(3, 8, 8), 120),
        ]),
        day('rn-3', 'Day 3', [
          ex('pause-squat', atRpe(3, 4, 7), 210),
          ex('close-grip-bench', atRpe(3, 6, 8), 180),
          ex('deadlift', atRpe(2, 3, 7), 210),
          ex('dumbbell-row', atRpe(3, 10, 8), 90),
        ]),
      ],
    },
  ],
};

// Texas Method --------------------------------------------------------------

const texas: Program = {
  id: 'texas-method',
  name: 'Texas Method',
  author: 'Glenn Pendlay / Rippetoe & Kilgore',
  level: 'intermediate',
  builtIn: true,
  description:
    'Weekly progression: Volume day (5×5 at ~90% of intensity load), Recovery day (light), Intensity day (new 5RM). Loads are % of e1RM; Intensity day top sets are autoregulated with RPE.',
  weeks: [
    {
      name: 'Week',
      days: [
        day('tm-v', 'Volume', [ex('squat', pct(5, 5, 74), 300), ex('bench-press', pct(5, 5, 74), 240), ex('deadlift', pct(1, 5, 82), 300)]),
        day('tm-r', 'Recovery', [ex('squat', pct(2, 5, 60), 180), ex('press', pct(3, 5, 72), 180), ex('chin-up', plain(3, 8), 120), ex('back-extension', plain(3, 10), 90)]),
        day('tm-i', 'Intensity', [ex('squat', atRpe(1, 5, 9, 'top'), 300), ex('bench-press', atRpe(1, 5, 9, 'top'), 240), ex('power-clean', pct(5, 3, 75), 150)]),
      ],
    },
  ],
};

// Wendler 5/3/1 Boring But Big -----------------------------------------------

// % of training max (90% of e1RM) converted to % of e1RM.
const TM = 0.9;
const w531 = (a: number, b: number, c: number, cReps: [number, number, number], amrap: boolean): SetPrescription[] => [
  { kind: 'work', reps: cReps[0], percent: a * TM },
  { kind: 'work', reps: cReps[1], percent: b * TM },
  { kind: amrap ? 'amrap' : 'work', reps: cReps[2], percent: c * TM },
];
const WEEKS_531: { name: string; p: [number, number, number]; r: [number, number, number]; amrap: boolean }[] = [
  { name: 'Week 1 (5s)', p: [65, 75, 85], r: [5, 5, 5], amrap: true },
  { name: 'Week 2 (3s)', p: [70, 80, 90], r: [3, 3, 3], amrap: true },
  { name: 'Week 3 (5/3/1)', p: [75, 85, 95], r: [5, 3, 1], amrap: true },
  { name: 'Week 4 (Deload)', p: [40, 50, 60], r: [5, 5, 5], amrap: false },
];
const bbb = pct(5, 10, 50 * TM);
const fiveThreeOne: Program = {
  id: '531-bbb',
  name: '5/3/1 Boring But Big',
  author: 'Jim Wendler',
  level: 'intermediate',
  builtIn: true,
  description:
    'Four-week waves on a training max of 90% of your e1RM. Last set of each main lift is AMRAP (except deload). Followed by 5×10 at 50% TM of the same lift plus accessories.',
  weeks: WEEKS_531.map((w, i) => {
    const main = (id: string) => ex(id, w531(w.p[0], w.p[1], w.p[2], w.r, w.amrap), 180);
    const deload = i === 3;
    return {
      name: w.name,
      days: [
        day(`531-${i}-p`, 'Press day', [main('press'), ...(deload ? [] : [ex('press', bbb, 90, 'BBB 5×10')]), ex('chin-up', plain(5, 10), 90)]),
        day(`531-${i}-d`, 'Deadlift day', [main('deadlift'), ...(deload ? [] : [ex('deadlift', bbb, 120, 'BBB 5×10')]), ex('hanging-leg-raise', plain(5, 15), 60)]),
        day(`531-${i}-b`, 'Bench day', [main('bench-press'), ...(deload ? [] : [ex('bench-press', bbb, 90, 'BBB 5×10')]), ex('dumbbell-row', plain(5, 10), 60)]),
        day(`531-${i}-s`, 'Squat day', [main('squat'), ...(deload ? [] : [ex('squat', bbb, 120, 'BBB 5×10')]), ex('lying-leg-curl', plain(5, 10), 60)]),
      ],
    };
  }),
};

// RPE powerlifting block (intermediate / advanced) ---------------------------

const PL_WEEKS = [
  { name: 'Week 1 — Accumulation', rpe: 7.5, drop: 90 },
  { name: 'Week 2 — Accumulation', rpe: 8, drop: 90 },
  { name: 'Week 3 — Intensification', rpe: 8.5, drop: 92.5 },
  { name: 'Week 4 — Overreach', rpe: 9, drop: 92.5 },
  { name: 'Week 5 — Deload', rpe: 6.5, drop: 85 },
];
const plBlock: Program = {
  id: 'rpe-powerlifting-block',
  name: 'RPE Powerlifting Block (4+1)',
  author: 'Generic RTS-style template',
  level: 'advanced',
  builtIn: true,
  description:
    'Four days, competition lifts twice a week plus specific variations. Each main lift is a top set at the week\'s RPE then load-drop back-off sets as % of the top set. RPE climbs over four weeks, then a deload. Built for intermediate/advanced lifters peaking toward a test or meet.',
  weeks: PL_WEEKS.map((w, i) => {
    const d = i === 4;
    const back = d ? 2 : 3;
    return {
      name: w.name,
      days: [
        day(`pl-${i}-1`, 'Day 1 — Squat / Bench', [
          ex('squat', topBack(d ? 3 : 2, w.rpe, back, 4, w.drop), 240),
          ex('bench-press', topBack(d ? 3 : 2, w.rpe, back, 4, w.drop), 210),
          ex('larsen-press', atRpe(3, 6, Math.min(8, w.rpe)), 150),
          ex('barbell-row', atRpe(3, 8, 8), 120),
        ]),
        day(`pl-${i}-2`, 'Day 2 — Deadlift / Press', [
          ex('deadlift', topBack(d ? 3 : 2, w.rpe, back, 3, w.drop), 300),
          ex('press', atRpe(3, 6, Math.min(8, w.rpe)), 150),
          ex('ssb-squat', atRpe(3, 6, 7), 180),
          ex('lat-pulldown', plain(3, 10), 90),
        ]),
        day(`pl-${i}-3`, 'Day 3 — Variations', [
          ex('pause-squat', atRpe(d ? 2 : 4, 3, Math.min(8, w.rpe)), 210),
          ex('spoto-press', atRpe(d ? 2 : 4, 4, Math.min(8, w.rpe)), 180),
          ex('glute-ham-raise', plain(3, 8), 90),
          ex('face-pull', plain(3, 15), 60),
        ]),
        day(`pl-${i}-4`, 'Day 4 — Bench / Deadlift variation', [
          ex('bench-press', topBack(d ? 3 : 1, Math.min(9.5, w.rpe + 0.5), back, 5, w.drop), 210),
          ex('deficit-deadlift', atRpe(d ? 2 : 3, 4, Math.min(8, w.rpe)), 240),
          ex('close-grip-bench', atRpe(3, 8, 8), 150),
          ex('dumbbell-row', plain(3, 12), 60),
        ]),
      ],
    };
  }),
};

// Meet peak -------------------------------------------------------------------

const peak: Program = {
  id: 'meet-peak',
  name: 'Meet Peak (3 weeks + meet week)',
  author: 'Generic peaking template',
  level: 'advanced',
  builtIn: true,
  description:
    'Specificity and intensity rise while volume drops: heavy singles at RPE 8 → 9, then opener practice in meet week. Pair with the opener calculator in Tools (openers ≈ 90-93% of your projected max).',
  weeks: [
    {
      name: 'Week 1 — Heavy singles',
      days: [
        day('pk-1-1', 'Squat / Bench', [ex('squat', [...atRpe(1, 1, 8, 'top'), ...rep(3, { kind: 'backoff' as SetKind, reps: 3, percentOfTop: 85 })], 300), ex('bench-press', [...atRpe(1, 1, 8, 'top'), ...rep(3, { kind: 'backoff' as SetKind, reps: 3, percentOfTop: 87 })], 240)]),
        day('pk-1-2', 'Deadlift / Bench', [ex('deadlift', [...atRpe(1, 1, 8, 'top'), ...rep(2, { kind: 'backoff' as SetKind, reps: 3, percentOfTop: 85 })], 300), ex('bench-press', atRpe(3, 3, 8), 210)]),
        day('pk-1-3', 'Squat / Bench volume', [ex('squat', atRpe(3, 3, 7.5), 240), ex('bench-press', topBack(2, 8, 3, 3, 90), 210)]),
      ],
    },
    {
      name: 'Week 2 — Heavier singles',
      days: [
        day('pk-2-1', 'Squat / Bench', [ex('squat', [...atRpe(1, 1, 9, 'top'), ...rep(2, { kind: 'backoff' as SetKind, reps: 2, percentOfTop: 87.5 })], 300), ex('bench-press', [...atRpe(1, 1, 9, 'top'), ...rep(2, { kind: 'backoff' as SetKind, reps: 2, percentOfTop: 88 })], 240)]),
        day('pk-2-2', 'Deadlift / Bench', [ex('deadlift', [...atRpe(1, 1, 9, 'top'), { kind: 'backoff', reps: 2, percentOfTop: 87.5 }], 300), ex('bench-press', atRpe(2, 2, 8), 210)]),
        day('pk-2-3', 'Squat / Bench', [ex('squat', atRpe(2, 2, 8), 240), ex('bench-press', atRpe(2, 2, 8), 210)]),
      ],
    },
    {
      name: 'Week 3 — Taper',
      days: [
        day('pk-3-1', 'Squat / Bench', [ex('squat', [...atRpe(1, 1, 8.5, 'top'), { kind: 'backoff', reps: 2, percentOfTop: 85 }], 300), ex('bench-press', [...atRpe(1, 1, 8.5, 'top'), { kind: 'backoff', reps: 2, percentOfTop: 85 }], 240)]),
        day('pk-3-2', 'Deadlift / Bench', [ex('deadlift', atRpe(1, 1, 8, 'top'), 300), ex('bench-press', atRpe(2, 2, 7), 180)]),
      ],
    },
    {
      name: 'Meet week',
      days: [
        day('pk-4-1', 'Openers (5-6 days out)', [ex('squat', pct(1, 1, 91), 300, 'Opener'), ex('bench-press', pct(1, 1, 91), 240, 'Opener'), ex('deadlift', pct(1, 1, 88), 300, 'Opener-ish, keep it fast')]),
        day('pk-4-2', 'Primer (2-3 days out)', [ex('squat', pct(2, 2, 70), 180), ex('bench-press', pct(2, 2, 72), 180)]),
      ],
    },
  ],
};

// GZCLP -------------------------------------------------------------------------

const gz = (t1: string, t2: string, t3: string, id: string, name: string): ProgramDay =>
  day(id, name, [
    ex(t1, [...lp(4, 3, 2.5), { kind: 'amrap', reps: 3, lpIncrement: 2.5 }], 240, 'T1: 5×3+, last set AMRAP'),
    ex(t2, lp(3, 10, 2.5), 150, 'T2: 3×10'),
    ex(t3, [...plain(2, 15), { kind: 'amrap', reps: 25 }], 75, 'T3: 3×15+ (add load when last set hits 25)'),
  ]);

const gzclp: Program = {
  id: 'gzclp',
  name: 'GZCLP',
  author: 'Cody Lefever',
  level: 'beginner',
  builtIn: true,
  description: 'Tiered linear progression: T1 heavy (5×3+), T2 moderate (3×10), T3 light high-rep. Four rotating days, train 3-4×/week.',
  weeks: [
    {
      name: 'Rotation',
      days: [
        gz('squat', 'bench-press', 'lat-pulldown', 'gz-1', 'Day 1'),
        gz('press', 'deadlift', 'dumbbell-row', 'gz-2', 'Day 2'),
        gz('bench-press', 'squat', 'lat-pulldown', 'gz-3', 'Day 3'),
        gz('deadlift', 'press', 'dumbbell-row', 'gz-4', 'Day 4'),
      ],
    },
  ],
};

export const BUILTIN_PROGRAMS: Program[] = [startingStrength, rpeNovice, gzclp, texas, fiveThreeOne, plBlock, peak];

/** Days of a program in training order. */
export function flattenDays(p: Program): { week: string; day: ProgramDay; index: number }[] {
  const out: { week: string; day: ProgramDay; index: number }[] = [];
  p.weeks.forEach((w) => w.days.forEach((d) => out.push({ week: w.name, day: d, index: out.length })));
  return out;
}
