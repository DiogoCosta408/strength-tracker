import type { Equipment, Exercise, ExerciseCategory, Muscle } from '../types';

type Extra = Pick<Exercise, 'notes' | 'bodyweightLoaded' | 'standard'>;

function ex(
  id: string,
  name: string,
  category: ExerciseCategory,
  equipment: Equipment,
  primary: Muscle[],
  secondary: Muscle[],
  extra: Extra | string = {},
): Exercise {
  const opts: Extra = typeof extra === 'string' ? { notes: extra } : extra;
  return { id, name, category, equipment, primary, secondary, ...opts };
}

// Common muscle groupings
const SQ_P: Muscle[] = ['quads', 'glutes'];
const SQ_S: Muscle[] = ['adductors', 'hamstrings', 'lowerBack', 'abs'];
const FSQ_P: Muscle[] = ['quads'];
const FSQ_S: Muscle[] = ['glutes', 'adductors', 'upperBack', 'abs'];
const BP_P: Muscle[] = ['chest', 'triceps'];
const BP_S: Muscle[] = ['frontDelts', 'lats'];
const DL_P: Muscle[] = ['glutes', 'hamstrings', 'lowerBack'];
const DL_S: Muscle[] = ['quads', 'traps', 'upperBack', 'lats', 'forearms', 'adductors'];
const SUMO_P: Muscle[] = ['glutes', 'adductors', 'quads'];
const SUMO_S: Muscle[] = ['hamstrings', 'lowerBack', 'traps', 'upperBack', 'forearms'];
const HINGE_P: Muscle[] = ['hamstrings', 'glutes'];
const HINGE_S: Muscle[] = ['lowerBack', 'upperBack', 'forearms'];
const OHP_P: Muscle[] = ['frontDelts', 'triceps'];
const OHP_S: Muscle[] = ['sideDelts', 'upperBack', 'traps', 'abs'];
const OLY_P: Muscle[] = ['glutes', 'quads', 'hamstrings', 'traps'];
const OLY_S: Muscle[] = ['lowerBack', 'upperBack', 'calves', 'forearms'];
const VPULL_P: Muscle[] = ['lats', 'upperBack'];
const VPULL_S: Muscle[] = ['biceps', 'rearDelts', 'forearms'];
const ROW_P: Muscle[] = ['upperBack', 'lats'];
const ROW_S: Muscle[] = ['rearDelts', 'biceps', 'forearms', 'lowerBack'];
const SL_P: Muscle[] = ['quads', 'glutes'];
const SL_S: Muscle[] = ['adductors', 'hamstrings'];

const BW = { bodyweightLoaded: true } as const;

export const EXERCISES: Exercise[] = [
  // ---------------------------------------------------------------- SQUAT
  ex('squat', 'Squat (Low Bar)', 'squat', 'barbell', SQ_P, SQ_S, {
    standard: 'squat',
    notes: 'Competition-style low-bar back squat to depth',
  }),
  ex('high-bar-squat', 'Squat (High Bar)', 'squat', 'barbell', SQ_P, SQ_S, 'Bar on upper traps, more upright torso'),
  ex('pause-squat', 'Pause Squat', 'squat', 'barbell', SQ_P, SQ_S, 'Pause in the hole (typically 2s)'),
  ex('pause-squat-1s', 'Pause Squat (1s)', 'squat', 'barbell', SQ_P, SQ_S, '1s pause in the hole'),
  ex('pause-squat-3s', 'Pause Squat (3s)', 'squat', 'barbell', SQ_P, SQ_S, '3s pause in the hole'),
  ex('high-bar-pause-squat', 'Pause Squat (High Bar)', 'squat', 'barbell', SQ_P, SQ_S, 'High bar, 2s pause in the hole'),
  ex('pin-squat', 'Pin Squat', 'squat', 'barbell', SQ_P, SQ_S, 'Start from dead stop on safety pins at/below parallel'),
  ex('box-squat', 'Box Squat', 'squat', 'barbell', SQ_P, ['hamstrings', 'adductors', 'lowerBack', 'abs'], 'Sit back to a box, brief pause, drive up'),
  ex('back-squat-tempo', 'Tempo Squat (3-0-0)', 'squat', 'barbell', SQ_P, SQ_S, '3s eccentric, no pause, normal concentric'),
  ex('tempo-squat-510', 'Tempo Squat (5-1-0)', 'squat', 'barbell', SQ_P, SQ_S, '5s eccentric, 1s pause, normal concentric'),
  ex('ssb-squat', 'Safety Squat Bar Squat', 'squat', 'specialty-bar', SQ_P, ['upperBack', 'adductors', 'lowerBack', 'abs'], 'SSB; loads upper back and quads, easy on shoulders'),
  ex('cambered-bar-squat', 'Cambered Bar Squat', 'squat', 'specialty-bar', SQ_P, ['upperBack', 'adductors', 'lowerBack', 'abs'], 'Swinging load demands bracing and position'),
  ex('front-squat', 'Front Squat', 'squat', 'barbell', FSQ_P, FSQ_S, { standard: 'frontSquat', notes: 'Bar racked on front delts' }),
  ex('pause-front-squat', 'Pause Front Squat', 'squat', 'barbell', FSQ_P, FSQ_S, '2s pause in the hole'),
  ex('zercher-squat', 'Zercher Squat', 'squat', 'barbell', FSQ_P, ['glutes', 'upperBack', 'biceps', 'abs', 'adductors'], 'Bar held in the crook of the elbows'),
  ex('anderson-squat', 'Anderson Squat', 'squat', 'barbell', SQ_P, SQ_S, 'Concentric-first from pins'),
  ex('belt-squat', 'Belt Squat', 'squat', 'machine', SQ_P, ['adductors', 'hamstrings'], 'Hip-loaded squat, spares the spine'),
  ex('beltless-squat', 'Beltless Squat', 'squat', 'barbell', SQ_P, ['abs', 'obliques', 'lowerBack', 'adductors'], 'Back squat without a belt'),
  ex('wide-stance-squat', 'Wide Stance Squat', 'squat', 'barbell', ['glutes', 'adductors', 'quads'], ['hamstrings', 'lowerBack'], 'Stance wider than competition'),
  ex('narrow-stance-squat', 'Narrow Stance Squat', 'squat', 'barbell', ['quads'], ['glutes', 'adductors', 'lowerBack'], 'Stance narrower than competition'),
  ex('one-and-a-quarter-squat', '1¼ Squat', 'squat', 'barbell', SQ_P, SQ_S, 'Down, up a quarter, back down, then stand'),
  ex('pin-squat-high', 'Half Squat (Pins)', 'squat', 'barbell', SQ_P, ['lowerBack', 'abs'], 'Partial range from pins above parallel'),
  ex('hack-squat', 'Hack Squat (Machine)', 'squat', 'machine', ['quads'], ['glutes', 'adductors']),
  ex('barbell-hack-squat', 'Barbell Hack Squat', 'squat', 'barbell', ['quads'], ['glutes', 'forearms', 'traps'], 'Bar held behind the legs'),
  ex('pendulum-squat', 'Pendulum Squat', 'squat', 'machine', ['quads'], ['glutes', 'adductors']),
  ex('goblet-squat', 'Goblet Squat', 'squat', 'dumbbell', ['quads'], ['glutes', 'adductors', 'abs', 'upperBack']),
  ex('overhead-squat', 'Overhead Squat', 'squat', 'barbell', SQ_P, ['frontDelts', 'traps', 'upperBack', 'abs'], 'Snatch-grip bar locked out overhead'),
  ex('leg-press', 'Leg Press', 'legs', 'machine', SQ_P, ['adductors', 'hamstrings']),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'legs', 'dumbbell', SL_P, SL_S, 'Rear foot elevated'),
  ex('barbell-bulgarian-split-squat', 'Bulgarian Split Squat (Barbell)', 'legs', 'barbell', SL_P, SL_S, 'Rear foot elevated, bar on back'),
  ex('split-squat', 'Split Squat', 'legs', 'dumbbell', SL_P, SL_S),
  ex('walking-lunge', 'Walking Lunge', 'legs', 'dumbbell', SL_P, SL_S),
  ex('reverse-lunge', 'Reverse Lunge', 'legs', 'dumbbell', SL_P, SL_S),
  ex('barbell-lunge', 'Barbell Lunge', 'legs', 'barbell', SL_P, SL_S),
  ex('step-up', 'Step-Up', 'legs', 'dumbbell', SL_P, SL_S),
  ex('pistol-squat', 'Pistol Squat', 'legs', 'bodyweight', SL_P, ['adductors', 'abs'], { ...BW, notes: 'Single-leg squat; log added load' }),
  ex('sissy-squat', 'Sissy Squat', 'legs', 'bodyweight', ['quads'], ['abs'], BW),

  // ---------------------------------------------------------------- BENCH
  ex('bench-press', 'Bench Press (Competition / Paused)', 'bench', 'barbell', BP_P, BP_S, {
    standard: 'bench',
    notes: 'Competition pause on the chest',
  }),
  ex('touch-and-go-bench', 'Bench Press (Touch and Go)', 'bench', 'barbell', BP_P, BP_S, 'No pause on the chest'),
  ex('bench-2ct-pause', 'Bench Press (2-Count Pause)', 'bench', 'barbell', BP_P, BP_S, '2s pause on the chest'),
  ex('bench-3ct-pause', 'Bench Press (3-Count Pause)', 'bench', 'barbell', BP_P, BP_S, '3s pause on the chest'),
  ex('close-grip-bench', 'Close Grip Bench Press', 'bench', 'barbell', ['triceps', 'chest'], ['frontDelts'], 'Grip ~shoulder width or slightly narrower'),
  ex('wide-grip-bench', 'Wide Grip Bench Press', 'bench', 'barbell', ['chest'], ['frontDelts', 'triceps'], 'Grip at or near max legal width'),
  ex('larsen-press', 'Larsen Press', 'bench', 'barbell', BP_P, ['frontDelts', 'abs'], 'Legs extended, no leg drive'),
  ex('feet-up-bench', 'Feet-Up Bench Press', 'bench', 'barbell', BP_P, ['frontDelts', 'abs'], 'Feet on bench or in the air'),
  ex('spoto-press', 'Spoto Press', 'bench', 'barbell', BP_P, BP_S, 'Pause ~1-2" above the chest'),
  ex('pin-press', 'Pin Press (Bench)', 'bench', 'barbell', ['triceps', 'chest'], ['frontDelts'], 'Dead-stop press from pins in a rack'),
  ex('board-press-1', 'Board Press (1 Board)', 'bench', 'barbell', BP_P, ['frontDelts']),
  ex('board-press-2', 'Board Press (2 Board)', 'bench', 'barbell', ['triceps', 'chest'], ['frontDelts']),
  ex('board-press-3', 'Board Press (3 Board)', 'bench', 'barbell', ['triceps'], ['chest', 'frontDelts'], 'Lockout overload'),
  ex('floor-press', 'Floor Press', 'bench', 'barbell', ['triceps', 'chest'], ['frontDelts'], 'Pressed lying on the floor'),
  ex('slingshot-bench', 'Slingshot Bench Press', 'bench', 'other', BP_P, ['frontDelts'], 'With Slingshot elastic sleeve'),
  ex('tempo-bench', 'Tempo Bench Press (3-1-0)', 'bench', 'barbell', BP_P, BP_S, '3s eccentric, 1s pause'),
  ex('tempo-bench-510', 'Tempo Bench Press (5-1-0)', 'bench', 'barbell', BP_P, BP_S, '5s eccentric, 1s pause'),
  ex('banded-bench', 'Banded Bench Press', 'bench', 'barbell', BP_P, BP_S, 'Accommodating resistance with bands'),
  ex('incline-bench-press', 'Incline Bench Press', 'bench', 'barbell', ['chest', 'frontDelts'], ['triceps'], {
    standard: 'inclineBench',
    notes: 'Barbell, ~30-45° incline',
  }),
  ex('close-grip-incline-bench', 'Close Grip Incline Bench', 'bench', 'barbell', ['chest', 'frontDelts', 'triceps'], []),
  ex('decline-bench-press', 'Decline Bench Press', 'bench', 'barbell', BP_P, ['frontDelts']),
  ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'bench', 'dumbbell', ['chest'], ['triceps', 'frontDelts']),
  ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'bench', 'dumbbell', ['chest', 'frontDelts'], ['triceps']),
  ex('decline-dumbbell-press', 'Decline Dumbbell Press', 'bench', 'dumbbell', ['chest'], ['triceps', 'frontDelts']),
  ex('dumbbell-floor-press', 'Dumbbell Floor Press', 'bench', 'dumbbell', ['chest', 'triceps'], ['frontDelts']),
  ex('ssb-bench', 'Swiss Bar Bench Press', 'bench', 'specialty-bar', ['triceps', 'chest'], ['frontDelts'], 'Neutral-grip multi-grip bar'),
  ex('machine-chest-press', 'Machine Chest Press', 'chest', 'machine', ['chest'], ['triceps', 'frontDelts']),

  // ---------------------------------------------------------------- DEADLIFT
  ex('deadlift', 'Deadlift (Conventional)', 'deadlift', 'barbell', DL_P, DL_S, { standard: 'deadlift' }),
  ex('sumo-deadlift', 'Sumo Deadlift', 'deadlift', 'barbell', SUMO_P, SUMO_S, { standard: 'sumoDeadlift' }),
  ex('deficit-deadlift', 'Deficit Deadlift', 'deadlift', 'barbell', DL_P, DL_S, 'Standing on a plate/platform (typically 2")'),
  ex('deficit-deadlift-1in', 'Deficit Deadlift (1")', 'deadlift', 'barbell', DL_P, DL_S, '1" deficit'),
  ex('deficit-deadlift-4in', 'Deficit Deadlift (4")', 'deadlift', 'barbell', DL_P, DL_S, '4" deficit'),
  ex('deficit-sumo-deadlift', 'Deficit Sumo Deadlift', 'deadlift', 'barbell', SUMO_P, SUMO_S),
  ex('paused-deadlift', 'Paused Deadlift (Below Knee)', 'deadlift', 'barbell', DL_P, DL_S, '2s pause just below the knee'),
  ex('paused-deadlift-above-knee', 'Paused Deadlift (Above Knee)', 'deadlift', 'barbell', DL_P, DL_S, '2s pause just above the knee'),
  ex('paused-deadlift-off-floor', 'Paused Deadlift (Off Floor)', 'deadlift', 'barbell', DL_P, DL_S, 'Pause ~1" off the floor'),
  ex('paused-sumo-deadlift', 'Paused Sumo Deadlift', 'deadlift', 'barbell', SUMO_P, SUMO_S, 'Pause just below the knee'),
  ex('block-pull', 'Block Pull', 'deadlift', 'barbell', ['glutes', 'lowerBack', 'traps'], ['hamstrings', 'upperBack', 'forearms'], 'Plates on blocks (typically 2-4")'),
  ex('block-pull-below-knee', 'Block Pull (Below Knee)', 'deadlift', 'barbell', ['glutes', 'lowerBack', 'traps'], ['hamstrings', 'upperBack', 'forearms']),
  ex('block-pull-knee', 'Block Pull (Knee Height)', 'deadlift', 'barbell', ['glutes', 'lowerBack', 'traps'], ['upperBack', 'forearms']),
  ex('rack-pull', 'Rack Pull (Mid-Shin)', 'deadlift', 'barbell', ['glutes', 'lowerBack', 'traps'], ['hamstrings', 'upperBack', 'forearms'], 'Bar on pins at mid-shin'),
  ex('rack-pull-above-knee', 'Rack Pull (Above Knee)', 'deadlift', 'barbell', ['traps', 'lowerBack', 'glutes'], ['upperBack', 'forearms']),
  ex('sumo-block-pull', 'Sumo Block Pull', 'deadlift', 'barbell', ['glutes', 'adductors', 'lowerBack'], ['traps', 'upperBack', 'forearms']),
  ex('romanian-deadlift', 'Romanian Deadlift', 'deadlift', 'barbell', HINGE_P, HINGE_S, 'Hinge from the top with soft knees, bar to mid-shin'),
  ex('stiff-leg-deadlift', 'Stiff-Leg Deadlift', 'deadlift', 'barbell', HINGE_P, HINGE_S, 'From the floor, minimal knee bend, each rep dead-stop'),
  ex('dumbbell-rdl', 'Dumbbell Romanian Deadlift', 'deadlift', 'dumbbell', HINGE_P, ['lowerBack', 'forearms']),
  ex('single-leg-rdl', 'Single-Leg RDL', 'deadlift', 'dumbbell', HINGE_P, ['adductors', 'lowerBack', 'forearms']),
  ex('snatch-grip-deadlift', 'Snatch-Grip Deadlift', 'deadlift', 'barbell', DL_P, ['upperBack', 'traps', 'quads', 'lats', 'forearms']),
  ex('snatch-grip-rdl', 'Snatch-Grip RDL', 'deadlift', 'barbell', HINGE_P, ['upperBack', 'traps', 'lowerBack', 'forearms']),
  ex('trap-bar-deadlift', 'Trap Bar Deadlift', 'deadlift', 'specialty-bar', ['quads', 'glutes'], ['hamstrings', 'lowerBack', 'traps', 'forearms']),
  ex('tempo-deadlift', 'Tempo Deadlift', 'deadlift', 'barbell', DL_P, DL_S, 'Slow eccentric (e.g. 3-5s)'),
  ex('banded-deadlift', 'Banded Deadlift', 'deadlift', 'barbell', DL_P, DL_S, 'Accommodating resistance with bands'),
  ex('touch-and-go-deadlift', 'Touch-and-Go Deadlift', 'deadlift', 'barbell', DL_P, DL_S, 'No reset between reps'),
  ex('good-morning', 'Good Morning', 'deadlift', 'barbell', ['hamstrings', 'lowerBack'], ['glutes', 'upperBack']),
  ex('ssb-good-morning', 'SSB Good Morning', 'deadlift', 'specialty-bar', ['hamstrings', 'lowerBack'], ['glutes', 'upperBack']),
  ex('seated-good-morning', 'Seated Good Morning', 'deadlift', 'barbell', ['lowerBack'], ['glutes', 'upperBack']),
  ex('kettlebell-swing', 'Kettlebell Swing', 'deadlift', 'kettlebell', ['glutes', 'hamstrings'], ['lowerBack', 'abs', 'forearms']),

  // ---------------------------------------------------------------- PRESS
  ex('press', 'Overhead Press', 'press', 'barbell', OHP_P, OHP_S, { standard: 'press', notes: 'Standing strict press' }),
  ex('push-press', 'Push Press', 'press', 'barbell', OHP_P, ['sideDelts', 'quads', 'glutes', 'traps', 'abs'], {
    standard: 'pushPress',
    notes: 'Dip and drive with the legs',
  }),
  ex('snatch-grip-press', 'Snatch-Grip Press', 'press', 'barbell', OHP_P, ['sideDelts', 'traps', 'upperBack'], {
    standard: 'snatchGripPress',
    notes: 'Strict press from the shoulders with a wide, snatch-width grip',
  }),
  ex('behind-the-neck-press', 'Behind-the-Neck Press', 'press', 'barbell', ['frontDelts', 'sideDelts', 'triceps'], ['traps', 'upperBack']),
  ex('z-press', 'Z Press', 'press', 'barbell', OHP_P, ['sideDelts', 'abs', 'upperBack'], 'Seated on the floor, legs extended'),
  ex('seated-press', 'Seated Barbell Press', 'press', 'barbell', OHP_P, ['sideDelts', 'upperBack']),
  ex('pin-press-overhead', 'Overhead Pin Press', 'press', 'barbell', OHP_P, ['sideDelts', 'traps'], 'Dead stop from pins'),
  ex('paused-press', 'Paused Overhead Press', 'press', 'barbell', OHP_P, OHP_S, 'Pause at the clavicles or forehead'),
  ex('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'press', 'dumbbell', OHP_P, ['sideDelts', 'upperBack']),
  ex('seated-dumbbell-press', 'Seated Dumbbell Press', 'press', 'dumbbell', OHP_P, ['sideDelts']),
  ex('arnold-press', 'Arnold Press', 'press', 'dumbbell', ['frontDelts', 'sideDelts'], ['triceps']),
  ex('landmine-press', 'Landmine Press', 'press', 'barbell', ['frontDelts', 'chest'], ['triceps', 'abs', 'obliques']),
  ex('viking-press', 'Viking Press', 'press', 'machine', OHP_P, ['sideDelts', 'traps', 'abs']),
  ex('log-press', 'Log Press', 'press', 'specialty-bar', OHP_P, ['chest', 'upperBack', 'quads', 'abs']),
  ex('axle-press', 'Axle Press', 'press', 'specialty-bar', OHP_P, ['forearms', 'upperBack', 'abs']),
  ex('machine-shoulder-press', 'Machine Shoulder Press', 'press', 'machine', OHP_P, ['sideDelts']),
  ex('kettlebell-press', 'Kettlebell Press', 'press', 'kettlebell', OHP_P, ['sideDelts', 'abs']),
  ex('handstand-push-up', 'Handstand Push-Up', 'press', 'bodyweight', OHP_P, ['traps', 'upperBack'], BW),

  // ---------------------------------------------------------------- OLYMPIC
  ex('power-clean', 'Power Clean', 'olympic', 'barbell', OLY_P, OLY_S, { standard: 'powerClean', notes: 'Caught above parallel' }),
  ex('hang-power-clean', 'Hang Power Clean', 'olympic', 'barbell', OLY_P, OLY_S, 'From the hang (above knee)'),
  ex('hang-clean', 'Hang Clean', 'olympic', 'barbell', OLY_P, OLY_S, 'From the hang, caught in a full squat'),
  ex('clean', 'Clean', 'olympic', 'barbell', OLY_P, OLY_S, 'Full squat clean'),
  ex('snatch', 'Snatch', 'olympic', 'barbell', OLY_P, ['frontDelts', 'upperBack', 'lowerBack', 'abs']),
  ex('power-snatch', 'Power Snatch', 'olympic', 'barbell', OLY_P, ['frontDelts', 'upperBack', 'lowerBack', 'abs'], 'Caught above parallel'),
  ex('hang-power-snatch', 'Hang Power Snatch', 'olympic', 'barbell', OLY_P, ['frontDelts', 'upperBack', 'lowerBack']),
  ex('clean-and-jerk', 'Clean & Jerk', 'olympic', 'barbell', OLY_P, ['frontDelts', 'triceps', 'upperBack', 'lowerBack', 'abs']),
  ex('push-jerk', 'Push Jerk', 'olympic', 'barbell', ['frontDelts', 'triceps', 'quads'], ['glutes', 'traps', 'abs']),
  ex('split-jerk', 'Split Jerk', 'olympic', 'barbell', ['frontDelts', 'triceps', 'quads'], ['glutes', 'traps', 'abs']),
  ex('clean-high-pull', 'Clean High Pull', 'olympic', 'barbell', ['traps', 'glutes', 'hamstrings'], ['upperBack', 'sideDelts', 'lowerBack']),
  ex('snatch-high-pull', 'Snatch High Pull', 'olympic', 'barbell', ['traps', 'glutes', 'hamstrings'], ['upperBack', 'sideDelts', 'rearDelts']),
  ex('clean-pull', 'Clean Pull', 'olympic', 'barbell', ['glutes', 'hamstrings', 'traps'], ['quads', 'lowerBack', 'forearms']),
  ex('snatch-pull', 'Snatch Pull', 'olympic', 'barbell', ['glutes', 'hamstrings', 'traps'], ['quads', 'lowerBack', 'upperBack']),

  // ---------------------------------------------------------------- VERTICAL PULLS
  ex('chin-up', 'Chin-Up', 'pull', 'bodyweight', ['lats', 'biceps'], ['upperBack', 'forearms', 'rearDelts'], {
    ...BW,
    standard: 'chinup',
    notes: 'Supinated grip; log added weight',
  }),
  ex('pull-up', 'Pull-Up', 'pull', 'bodyweight', VPULL_P, VPULL_S, {
    ...BW,
    standard: 'pullup',
    notes: 'Pronated grip; log added weight',
  }),
  ex('neutral-grip-pull-up', 'Neutral Grip Pull-Up', 'pull', 'bodyweight', ['lats', 'biceps'], ['upperBack', 'forearms'], BW),
  ex('wide-grip-pull-up', 'Wide Grip Pull-Up', 'pull', 'bodyweight', VPULL_P, ['biceps', 'rearDelts'], BW),
  ex('weighted-chin-up', 'Weighted Chin-Up', 'pull', 'bodyweight', ['lats', 'biceps'], ['upperBack', 'forearms'], { ...BW, notes: 'Heavy chin-ups with belt/vest' }),
  ex('weighted-pull-up', 'Weighted Pull-Up', 'pull', 'bodyweight', VPULL_P, VPULL_S, { ...BW, notes: 'Heavy pull-ups with belt/vest' }),
  ex('lat-pulldown', 'Lat Pulldown', 'pull', 'cable', VPULL_P, ['biceps', 'rearDelts']),
  ex('close-grip-lat-pulldown', 'Close Grip Lat Pulldown', 'pull', 'cable', ['lats'], ['biceps', 'upperBack']),
  ex('underhand-lat-pulldown', 'Underhand Lat Pulldown', 'pull', 'cable', ['lats', 'biceps'], ['upperBack']),
  ex('single-arm-lat-pulldown', 'Single-Arm Lat Pulldown', 'pull', 'cable', ['lats'], ['biceps', 'upperBack']),
  ex('straight-arm-pulldown', 'Straight-Arm Pulldown', 'pull', 'cable', ['lats'], ['triceps', 'abs']),

  // ---------------------------------------------------------------- ROWS
  ex('barbell-row', 'Barbell Row', 'row', 'barbell', ROW_P, ROW_S, { standard: 'row', notes: 'Bent-over row' }),
  ex('pendlay-row', 'Pendlay Row', 'row', 'barbell', ROW_P, ROW_S, 'Dead stop on the floor each rep, torso parallel'),
  ex('yates-row', 'Yates Row', 'row', 'barbell', ROW_P, ['biceps', 'rearDelts', 'traps'], 'Underhand grip, more upright torso'),
  ex('dumbbell-row', 'Dumbbell Row', 'row', 'dumbbell', ['lats', 'upperBack'], ['biceps', 'rearDelts', 'forearms']),
  ex('kroc-row', 'Kroc Row', 'row', 'dumbbell', ['lats', 'upperBack'], ['biceps', 'traps', 'forearms'], 'Heavy, high-rep DB row with some body English'),
  ex('seal-row', 'Seal Row', 'row', 'barbell', ROW_P, ['rearDelts', 'biceps'], 'Lying prone on an elevated bench'),
  ex('chest-supported-row', 'Chest-Supported Row', 'row', 'dumbbell', ROW_P, ['rearDelts', 'biceps']),
  ex('machine-row', 'Machine Row', 'row', 'machine', ROW_P, ['rearDelts', 'biceps']),
  ex('cable-row', 'Seated Cable Row', 'row', 'cable', ROW_P, ['biceps', 'rearDelts', 'lowerBack']),
  ex('t-bar-row', 'T-Bar Row', 'row', 'barbell', ROW_P, ROW_S),
  ex('meadows-row', 'Meadows Row', 'row', 'barbell', ['lats', 'upperBack'], ['rearDelts', 'biceps', 'forearms'], 'Single-arm landmine row'),
  ex('inverted-row', 'Inverted Row', 'row', 'bodyweight', ['upperBack', 'lats'], ['rearDelts', 'biceps', 'abs'], BW),
  ex('helms-row', 'Helms Row', 'row', 'dumbbell', ['upperBack'], ['lats', 'rearDelts', 'biceps'], 'Chest on incline bench, strict'),

  // ---------------------------------------------------------------- LEGS ACCESSORIES
  ex('leg-extension', 'Leg Extension', 'legs', 'machine', ['quads'], []),
  ex('seated-leg-curl', 'Seated Leg Curl', 'legs', 'machine', ['hamstrings'], ['calves']),
  ex('lying-leg-curl', 'Lying Leg Curl', 'legs', 'machine', ['hamstrings'], ['calves']),
  ex('nordic-curl', 'Nordic Hamstring Curl', 'legs', 'bodyweight', ['hamstrings'], ['glutes', 'calves'], BW),
  ex('glute-ham-raise', 'Glute-Ham Raise', 'legs', 'bodyweight', ['hamstrings', 'glutes'], ['calves', 'lowerBack'], BW),
  ex('hip-thrust', 'Hip Thrust', 'legs', 'barbell', ['glutes'], ['hamstrings', 'quads', 'adductors']),
  ex('glute-bridge', 'Glute Bridge', 'legs', 'barbell', ['glutes'], ['hamstrings']),
  ex('single-leg-hip-thrust', 'Single-Leg Hip Thrust', 'legs', 'bodyweight', ['glutes'], ['hamstrings', 'abs'], BW),
  ex('back-extension', 'Back Extension', 'back', 'bodyweight', ['lowerBack', 'glutes'], ['hamstrings'], { ...BW, notes: '45° or horizontal hyperextension' }),
  ex('reverse-hyper', 'Reverse Hyperextension', 'back', 'machine', ['glutes', 'lowerBack'], ['hamstrings']),
  ex('standing-calf-raise', 'Standing Calf Raise', 'legs', 'machine', ['calves'], []),
  ex('seated-calf-raise', 'Seated Calf Raise', 'legs', 'machine', ['calves'], []),
  ex('leg-press-calf-raise', 'Leg Press Calf Raise', 'legs', 'machine', ['calves'], []),
  ex('hip-adduction', 'Hip Adduction (Machine)', 'legs', 'machine', ['adductors'], []),
  ex('hip-abduction', 'Hip Abduction (Machine)', 'legs', 'machine', ['glutes'], []),
  ex('copenhagen-plank', 'Copenhagen Plank', 'legs', 'bodyweight', ['adductors'], ['obliques', 'abs'], BW),
  ex('sled-push', 'Sled Push', 'legs', 'other', ['quads', 'glutes'], ['calves', 'hamstrings']),
  ex('reverse-sled-drag', 'Reverse Sled Drag', 'legs', 'other', ['quads'], ['calves', 'glutes']),
  ex('cable-pull-through', 'Cable Pull-Through', 'legs', 'cable', ['glutes', 'hamstrings'], ['lowerBack']),

  // ---------------------------------------------------------------- CHEST
  ex('dip', 'Dip', 'chest', 'bodyweight', ['chest', 'triceps'], ['frontDelts'], { ...BW, standard: 'dip', notes: 'Parallel bars; log added weight' }),
  ex('push-up', 'Push-Up', 'chest', 'bodyweight', ['chest', 'triceps'], ['frontDelts', 'abs'], BW),
  ex('deficit-push-up', 'Deficit Push-Up', 'chest', 'bodyweight', ['chest', 'triceps'], ['frontDelts', 'abs'], BW),
  ex('dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbell', ['chest'], ['frontDelts']),
  ex('incline-dumbbell-fly', 'Incline Dumbbell Fly', 'chest', 'dumbbell', ['chest'], ['frontDelts']),
  ex('cable-fly', 'Cable Fly', 'chest', 'cable', ['chest'], ['frontDelts']),
  ex('pec-deck', 'Pec Deck', 'chest', 'machine', ['chest'], ['frontDelts']),

  // ---------------------------------------------------------------- SHOULDERS
  ex('lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell', ['sideDelts'], ['traps']),
  ex('cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable', ['sideDelts'], ['traps']),
  ex('front-raise', 'Front Raise', 'shoulders', 'dumbbell', ['frontDelts'], ['sideDelts']),
  ex('rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', ['rearDelts'], ['upperBack']),
  ex('reverse-pec-deck', 'Reverse Pec Deck', 'shoulders', 'machine', ['rearDelts'], ['upperBack']),
  ex('face-pull', 'Face Pull', 'shoulders', 'cable', ['rearDelts', 'upperBack'], ['traps', 'sideDelts']),
  ex('band-pull-apart', 'Band Pull-Apart', 'shoulders', 'band', ['rearDelts', 'upperBack'], ['traps']),
  ex('upright-row', 'Upright Row', 'shoulders', 'barbell', ['sideDelts', 'traps'], ['biceps', 'frontDelts']),
  ex('barbell-shrug', 'Barbell Shrug', 'shoulders', 'barbell', ['traps'], ['forearms']),
  ex('dumbbell-shrug', 'Dumbbell Shrug', 'shoulders', 'dumbbell', ['traps'], ['forearms']),
  ex('external-rotation', 'Cable External Rotation', 'shoulders', 'cable', ['rearDelts'], ['upperBack'], 'Rotator cuff work'),

  // ---------------------------------------------------------------- ARMS
  ex('barbell-curl', 'Barbell Curl', 'arms', 'barbell', ['biceps'], ['forearms']),
  ex('ez-bar-curl', 'EZ-Bar Curl', 'arms', 'barbell', ['biceps'], ['forearms']),
  ex('dumbbell-curl', 'Dumbbell Curl', 'arms', 'dumbbell', ['biceps'], ['forearms']),
  ex('hammer-curl', 'Hammer Curl', 'arms', 'dumbbell', ['biceps', 'forearms'], []),
  ex('incline-dumbbell-curl', 'Incline Dumbbell Curl', 'arms', 'dumbbell', ['biceps'], ['forearms']),
  ex('preacher-curl', 'Preacher Curl', 'arms', 'barbell', ['biceps'], ['forearms']),
  ex('cable-curl', 'Cable Curl', 'arms', 'cable', ['biceps'], ['forearms']),
  ex('triceps-pushdown', 'Triceps Pushdown', 'arms', 'cable', ['triceps'], []),
  ex('overhead-triceps-extension', 'Overhead Triceps Extension', 'arms', 'cable', ['triceps'], []),
  ex('skull-crusher', 'Skull Crusher', 'arms', 'barbell', ['triceps'], [], 'Lying EZ-bar/barbell triceps extension'),
  ex('jm-press', 'JM Press', 'arms', 'barbell', ['triceps'], ['chest']),
  ex('tate-press', 'Tate Press', 'arms', 'dumbbell', ['triceps'], []),
  ex('bench-dip', 'Bench Dip', 'arms', 'bodyweight', ['triceps'], ['chest', 'frontDelts'], BW),
  ex('wrist-curl', 'Wrist Curl', 'arms', 'dumbbell', ['forearms'], []),
  ex('reverse-curl', 'Reverse Curl', 'arms', 'barbell', ['forearms', 'biceps'], []),

  // ---------------------------------------------------------------- CORE
  ex('plank', 'Plank', 'core', 'bodyweight', ['abs'], ['obliques'], { ...BW, notes: 'Log duration as reps (seconds)' }),
  ex('side-plank', 'Side Plank', 'core', 'bodyweight', ['obliques'], ['abs'], BW),
  ex('ab-wheel', 'Ab Wheel Rollout', 'core', 'other', ['abs'], ['lats', 'obliques'], BW),
  ex('hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight', ['abs'], ['obliques', 'forearms'], BW),
  ex('hanging-knee-raise', 'Hanging Knee Raise', 'core', 'bodyweight', ['abs'], ['obliques', 'forearms'], BW),
  ex('cable-crunch', 'Cable Crunch', 'core', 'cable', ['abs'], ['obliques']),
  ex('decline-sit-up', 'Decline Sit-Up', 'core', 'bodyweight', ['abs'], ['obliques'], BW),
  ex('pallof-press', 'Pallof Press', 'core', 'cable', ['obliques', 'abs'], []),
  ex('dead-bug', 'Dead Bug', 'core', 'bodyweight', ['abs'], ['obliques'], BW),
  ex('dragon-flag', 'Dragon Flag', 'core', 'bodyweight', ['abs'], ['obliques', 'lats'], BW),
  ex('landmine-rotation', 'Landmine Rotation', 'core', 'barbell', ['obliques'], ['abs', 'frontDelts']),
  ex('suitcase-carry', 'Suitcase Carry', 'core', 'dumbbell', ['obliques', 'forearms'], ['abs', 'traps']),
  ex('farmers-walk', "Farmer's Walk", 'core', 'other', ['forearms', 'traps'], ['abs', 'obliques', 'upperBack', 'quads']),
  ex('yoke-carry', 'Yoke Carry', 'core', 'other', ['abs', 'upperBack', 'quads'], ['glutes', 'lowerBack', 'traps']),
  ex('weighted-plank', 'Weighted Plank', 'core', 'bodyweight', ['abs'], ['obliques'], BW),

  // ---------------------------------------------------------------- CONDITIONING
  ex('prowler-push', 'Prowler Push', 'conditioning', 'other', ['quads', 'glutes'], ['calves', 'triceps']),
  ex('sled-drag', 'Sled Drag', 'conditioning', 'other', ['glutes', 'hamstrings'], ['quads', 'calves']),
  ex('assault-bike', 'Air Bike', 'conditioning', 'machine', ['quads'], ['glutes', 'frontDelts', 'triceps'], 'Log calories or duration as reps'),
  ex('stationary-bike', 'Stationary Bike', 'conditioning', 'machine', ['quads'], ['glutes', 'calves']),
  ex('rowing-machine', 'Row Erg', 'conditioning', 'machine', ['upperBack', 'quads'], ['glutes', 'lats', 'biceps']),
  ex('ski-erg', 'Ski Erg', 'conditioning', 'machine', ['lats', 'triceps'], ['abs', 'upperBack']),
  ex('jump-rope', 'Jump Rope', 'conditioning', 'other', ['calves'], ['quads']),
  ex('box-jump', 'Box Jump', 'conditioning', 'bodyweight', ['quads', 'glutes'], ['calves', 'hamstrings']),
  ex('broad-jump', 'Broad Jump', 'conditioning', 'bodyweight', ['glutes', 'quads'], ['hamstrings', 'calves']),
];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
  press: 'Press',
  olympic: 'Olympic',
  pull: 'Pull',
  row: 'Row',
  legs: 'Legs',
  chest: 'Chest',
  shoulders: 'Shoulders',
  arms: 'Arms',
  back: 'Back',
  core: 'Core',
  conditioning: 'Conditioning',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  'specialty-bar': 'Specialty bar',
  other: 'Other',
};

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  frontDelts: 'Front delts',
  sideDelts: 'Side delts',
  rearDelts: 'Rear delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  traps: 'Traps',
  upperBack: 'Upper back',
  lats: 'Lats',
  lowerBack: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};
