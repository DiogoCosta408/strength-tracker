// Core domain types. All weights are stored in kilograms.

export type Muscle =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'traps'
  | 'upperBack'
  | 'lats'
  | 'lowerBack'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export type ExerciseCategory =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'press'
  | 'olympic'
  | 'pull'
  | 'row'
  | 'legs'
  | 'chest'
  | 'shoulders'
  | 'arms'
  | 'back'
  | 'core'
  | 'conditioning';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'specialty-bar'
  | 'other';

/** Canonical lifts used for strength standards and the muscle map. */
/** The 14 lifts Symmetric Strength publishes standards for — see src/lib/strength.ts. */
export type StandardLift =
  | 'squat'
  | 'frontSquat'
  | 'bench'
  | 'inclineBench'
  | 'deadlift'
  | 'sumoDeadlift'
  | 'press'
  | 'pushPress'
  | 'snatchGripPress'
  | 'powerClean'
  | 'row'
  | 'chinup'
  | 'pullup'
  | 'dip';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: Equipment;
  primary: Muscle[];
  secondary: Muscle[];
  /** True when bodyweight is part of the load (pull-ups, dips): logged weight = added weight. */
  bodyweightLoaded?: boolean;
  /** If set, best e1RM for this exercise counts toward that canonical lift's strength score. */
  standard?: StandardLift;
  /** Short description of the variation (e.g. "2s pause at the bottom"). */
  notes?: string;
  custom?: boolean;
  /** For sync merge: last edited. Only set on custom exercises. */
  updatedAt?: string;
}

export type SetKind = 'warmup' | 'work' | 'top' | 'backoff' | 'amrap';

/** One prescribed set in a template. */
export interface SetPrescription {
  kind: SetKind;
  reps: number;
  /** Target RPE (6-10, step 0.5). Load is suggested from e1RM when present. */
  rpe?: number;
  /** Percent of 1RM / training max (0-100+). */
  percent?: number;
  /** Fixed load in kg. */
  weight?: number;
  /** Backoff: percent of the session's top set load (e.g. 90 = top set -10%). */
  percentOfTop?: number;
  /** Linear progression: last completed working load for this exercise + increment (kg). */
  lpIncrement?: number;
}

export interface ExercisePrescription {
  exerciseId: string;
  sets: SetPrescription[];
  notes?: string;
  /** Rest in seconds between sets. */
  rest?: number;
}

export interface ProgramDay {
  id: string;
  name: string;
  exercises: ExercisePrescription[];
}

export interface ProgramWeek {
  name: string;
  days: ProgramDay[];
}

export interface Program {
  id: string;
  name: string;
  author?: string;
  description: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  weeks: ProgramWeek[];
  builtIn?: boolean;
  /** For sync merge: last edited. Absent on built-ins (never synced). */
  updatedAt?: string;
}

export interface LoggedSet {
  id: string;
  kind: SetKind;
  weight: number;
  reps: number;
  rpe?: number;
  done: boolean;
  /** Weight was filled in by the app (not typed), so it may be re-adjusted mid-session. */
  autoWeight?: boolean;
  /** What the template asked for, kept for reference. */
  target?: SetPrescription;
}

export interface LoggedExercise {
  id: string;
  exerciseId: string;
  sets: LoggedSet[];
  notes?: string;
  rest?: number;
}

export interface Workout {
  id: string;
  name: string;
  /** ISO timestamp. */
  startedAt: string;
  finishedAt?: string;
  programId?: string;
  dayId?: string;
  bodyweight?: number;
  exercises: LoggedExercise[];
  notes?: string;
  /** For sync merge: last edited (set when finished, bumped on later edits). */
  updatedAt?: string;
}

export interface BodyweightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  /** For sync merge: last edited. */
  updatedAt?: string;
}

export type Sex = 'male' | 'female';

/** Daily intake log (optional) — lets the coach estimate real maintenance calories. */
export interface NutritionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  kcal: number;
  protein?: number;
  /** For sync merge: last edited. */
  updatedAt?: string;
}

export interface LiftGoal {
  exerciseId: string;
  /** Target e1RM in kg (total load for bodyweight exercises). */
  target: number;
}

export interface Goals {
  targetDate: string; // YYYY-MM-DD
  lifts: LiftGoal[];
  bodyweight?: number;
  createdAt: string;
  /** Values when the goal was set, for progress bars. */
  start: { lifts: Record<string, number>; bodyweight?: number };
}

export interface Profile {
  name: string;
  sex: Sex;
  birthYear?: number;
  barWeight: number;
  /** Smallest load jump available (kg) – used for rounding suggestions. */
  rounding: number;
  /** Plates available per side, kg. */
  plates: number[];
  defaultRest: number;
  heightCm?: number;
  /** Activity outside training, for the calorie estimate. */
  activity?: 'low' | 'moderate' | 'high';
  /** Which formula to use for e1RM when no RPE is logged. */
  e1rmFormula: 'epley' | 'brzycki';
  /** For sync merge: last edited. */
  updatedAt?: string;
}

export interface ActiveProgram {
  programId: string;
  /** Index into the flattened list of days across weeks. */
  nextIndex: number;
}

// Coach ---------------------------------------------------------------------

/** Answers to the coach's diagnostic questions for one lift, keyed by question id. */
export interface Diagnosis {
  exerciseId: string;
  answers: Record<string, string[]>;
  updatedAt: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  error?: boolean;
}

// Sync ------------------------------------------------------------------------

/** Collections that support an explicit delete action and so need a tombstone to merge deletions. */
export type SyncCollection = 'workouts' | 'bodyweight' | 'programs';

/** Marks a deleted record so a merge with a device that still has it doesn't resurrect it. */
export interface Tombstone {
  collection: SyncCollection;
  id: string;
  deletedAt: string;
}

export interface AppState {
  version: 1;
  profile: Profile;
  workouts: Workout[];
  activeWorkout?: Workout;
  programs: Program[]; // user-created programs (built-ins are in code)
  customExercises: Exercise[];
  bodyweight: BodyweightEntry[];
  activeProgram?: ActiveProgram;
  /** Manually entered maxes (e.g. from a meet) by exercise id, kg. */
  manualMaxes: Record<string, number>;
  /** Diagnostic interview answers by exercise id. */
  diagnoses: Record<string, Diagnosis>;
  /** Conversation with the AI coach. */
  coachChat: CoachMessage[];
  goals?: Goals;
  nutrition: NutritionEntry[];
  /** Deletions for workouts/bodyweight/programs, for sync merge. */
  tombstones?: Tombstone[];
  /** Per-exercise timestamp for `manualMaxes`, since that record has no per-entry field of its own. */
  manualMaxUpdatedAt?: Record<string, string>;
  /** Sibling timestamps for the nullable whole-object fields, so a deletion still carries a comparable time. */
  goalsUpdatedAt?: string;
  activeProgramUpdatedAt?: string;
}
