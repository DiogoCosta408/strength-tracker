import type { AppState, Goals, Sex, StandardLift } from '../types';
import { roundTo } from './calc';
import { bodyweightAt, getExercise } from './store';
import { bestE1rm, exerciseHistory } from './stats';
import { liftScore, loadForLevel } from './strength';

const DAY = 86400000;
const WEEK = 7 * DAY;
const KCAL_PER_KG = 7700;

export type Feasibility = 'achieved' | 'on-track' | 'ambitious' | 'unrealistic' | 'no-data';

export interface LiftGoalStatus {
  exerciseId: string;
  name: string;
  start: number;
  current: number;
  target: number;
  /** Required gain per week, % of current e1RM. */
  requiredPct: number;
  /** Realistic gain per week for this lifter, % (level-based, blended with observed trend). */
  realisticPct: number;
  /** Observed e1RM trend over the last 12 weeks, %/week (undefined without enough data). */
  observedPct?: number;
  projectedAtDate: number;
  /** When the target is reached at the realistic rate (ISO date), if within 3 years. */
  projectedDate?: string;
  feasibility: Feasibility;
  /** Achievable target by the goal date (rounded), offered when the goal isn't realistic. */
  adjustedTarget?: number;
}

export interface BodyweightGoalStatus {
  start?: number;
  current: number;
  target: number;
  /** Required change per week, % of bodyweight (negative = loss). */
  requiredPct: number;
  /** Observed trend over the last 4 weeks, %/week. */
  observedPct?: number;
  /** Rate the nutrition plan aims for (clamped to a sensible range), %/week. */
  plannedPct: number;
  feasibility: Feasibility;
  adjustedTarget?: number;
  adjustedDate?: string;
}

export interface MacroPlan {
  maintenance: number;
  maintenanceSource: 'logged' | 'estimated';
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Average logged intake over the last 14 days. */
  loggedKcal?: number;
  loggedProtein?: number;
  loggedDays: number;
  /** Suggested change to daily calories when weight isn't moving as planned. */
  adjustment?: { kcal: number; reason: string };
}

export interface GoalReport {
  weeksLeft: number;
  lifts: LiftGoalStatus[];
  bodyweight?: BodyweightGoalStatus;
  macros?: MacroPlan;
  warnings: string[];
  overall: Feasibility;
}

const STANDARD_OF: Record<string, StandardLift> = {
  squat: 'squat',
  'bench-press': 'bench',
  deadlift: 'deadlift',
  'sumo-deadlift': 'sumoDeadlift',
  press: 'press',
  'front-squat': 'frontSquat',
  'power-clean': 'powerClean',
};

/**
 * Typical e1RM gain per week (%) at a strength score, assuming good training and a
 * small surplus. Novices progress fast; returns diminish sharply with level.
 */
/** Typical %/week gain at each of the eight standards levels (see LEVELS in strength.ts). */
export function levelRate(score: number): number {
  if (score < 25) return 1.5; // untrained
  if (score < 37.5) return 1.0; // novice
  if (score < 50) return 0.6; // intermediate
  if (score < 62.5) return 0.45; // proficient
  if (score < 75) return 0.25; // advanced
  if (score < 87.5) return 0.15; // exceptional
  if (score < 100) return 0.1; // elite
  return 0.05; // world class
}

/**
 * How much of a young lifter's rate of gain to expect at a given age. Trainability peaks
 * into the late 20s and tapers after ~30 as recovery slows; teens still growing gain a bit
 * quicker. Approximate, and deliberately gentler than the literature's spread so a masters
 * lifter's goals aren't written off.
 *
 * Separate from strength.ts's ageFactor, which age-grades the standards (what counts as
 * strong *for your age*) rather than how fast you can add to the bar.
 */
export function ageRateFactor(age?: number): number {
  if (!age) return 1;
  if (age < 18) return 1.1;
  if (age <= 30) return 1;
  return Math.max(0.35, 1 - (age - 30) * 0.012);
}

/**
 * How far along a goal is, 0-100. Measured from where the goal started, not from zero, so
 * it answers "how much of what I set out to add have I added" rather than flattering a
 * lifter who was already most of the way there when they set it.
 */
export function goalProgressPct(start: number, current: number, target: number): number {
  const span = target - start;
  if (!span) return current >= target ? 100 : 0;
  return Math.max(0, Math.min(100, ((current - start) / span) * 100));
}

/** Bodyweight-change effect on strength progress (%/week of bodyweight). */
function dietFactor(bwPctPerWeek: number): number {
  if (bwPctPerWeek <= -0.75) return 0.15; // aggressive cut: hold strength at best
  if (bwPctPerWeek <= -0.3) return 0.4;
  if (bwPctPerWeek < 0.1) return 0.85;
  if (bwPctPerWeek < 0.4) return 1.1;
  return 1.2;
}

function weeklySlopePct(points: { t: number; y: number }[]): number | undefined {
  if (points.length < 4) return undefined;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.t, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.y - my);
    den += (p.t - mx) ** 2;
  }
  if (!den || !my) return undefined;
  return ((num / den) * WEEK * 100) / my;
}

function age(s: AppState): number | undefined {
  return s.profile.birthYear ? new Date().getFullYear() - s.profile.birthYear : undefined;
}

/** First e1RM logged on or after `since`. */
function firstE1rmSince(s: AppState, exerciseId: string, since: string): number | undefined {
  const first = exerciseHistory(s, exerciseId).find((p) => p.date >= since);
  return first?.e1rm;
}

/**
 * Where this goal started. A lift that had never been logged when the goal was set records a
 * start of 0, which would then measure progress from an empty bar — logging it for the first
 * time would read as most of the way there. In that case anchor on the first session logged
 * after the goal was set instead, so progress starts from where the lifter actually was.
 */
function goalStart(s: AppState, g: Goals, exerciseId: string, current: number): number {
  const recorded = g.start.lifts[exerciseId];
  if (recorded && recorded > 0) return recorded;
  return firstE1rmSince(s, exerciseId, g.createdAt) ?? current;
}

function liftStatus(s: AppState, g: Goals, exerciseId: string, target: number, weeksLeft: number, bw: number, bwPlanPct: number, now: number): LiftGoalStatus {
  const ex = getExercise(exerciseId, s);
  const current = bestE1rm(s, exerciseId, 42) || bestE1rm(s, exerciseId);
  const start = goalStart(s, g, exerciseId, current);
  const std = ex?.standard ?? STANDARD_OF[exerciseId];
  const sex: Sex = s.profile.sex;

  const hist = exerciseHistory(s, exerciseId).filter((p) => now - +new Date(p.date) < 12 * WEEK);
  const observedPct = hist.length >= 6 ? weeklySlopePct(hist.map((p) => ({ t: +new Date(p.date), y: p.e1rm }))) : undefined;

  // Week-by-week simulation: the rate shrinks as the lifter gets stronger.
  const df = dietFactor(bwPlanPct);
  const af = ageRateFactor(age(s));
  const rateAt = (e1: number) => {
    const base = std ? levelRate(liftScore(std, e1, bw, sex, age(s))) : 0.4;
    let r = base * df * af;
    // Blend with the lifter's own trend, but don't let a hot or cold streak dominate.
    if (observedPct !== undefined) r = Math.min(r * 1.5, Math.max(r * 0.5, (r + observedPct) / 2));
    return r;
  };
  let e1 = current;
  let projectedAtDate = current;
  let projectedDate: string | undefined;
  for (let w = 1; w <= 156 && current > 0; w++) {
    e1 *= 1 + rateAt(e1) / 100;
    if (w <= Math.round(weeksLeft)) projectedAtDate = e1;
    if (!projectedDate && e1 >= target) projectedDate = new Date(now + w * WEEK).toISOString().slice(0, 10);
    if (w >= weeksLeft && projectedDate) break;
  }
  const realisticPct = current ? rateAt(current) : 0;
  const requiredPct = current && weeksLeft > 0 ? ((target / current) ** (1 / weeksLeft) - 1) * 100 : Infinity;

  let feasibility: Feasibility;
  if (!current) feasibility = 'no-data';
  else if (current >= target) feasibility = 'achieved';
  else if (projectedAtDate >= target) feasibility = 'on-track';
  else if (requiredPct <= realisticPct * 1.6) feasibility = 'ambitious';
  else feasibility = 'unrealistic';

  const adjusted = feasibility === 'unrealistic' || feasibility === 'ambitious' ? roundTo(projectedAtDate, 2.5) : undefined;
  return {
    exerciseId,
    name: ex?.name ?? exerciseId,
    start,
    current,
    target,
    requiredPct,
    realisticPct,
    observedPct,
    projectedAtDate,
    projectedDate,
    feasibility,
    adjustedTarget: adjusted && adjusted > current ? adjusted : undefined,
  };
}

/** Bodyweight trend (%/week) from a least-squares fit over the last `weeks` weeks. */
export function bodyweightTrendPct(s: AppState, weeks = 4, now = Date.now()): number | undefined {
  const pts = s.bodyweight.filter((b) => now - +new Date(b.date + 'T12:00:00') < weeks * WEEK).map((b) => ({ t: +new Date(b.date + 'T12:00:00'), y: b.weight }));
  return pts.length >= 5 ? weeklySlopePct(pts) : undefined;
}

function bodyweightStatus(s: AppState, g: Goals, weeksLeft: number, now: number): BodyweightGoalStatus | undefined {
  const current = bodyweightAt(s);
  if (!g.bodyweight || !current) return undefined;
  const target = g.bodyweight;
  const requiredPct = weeksLeft > 0 ? ((target - current) / current / weeksLeft) * 100 : 0;
  const observedPct = bodyweightTrendPct(s, 4, now);
  const losing = target < current;
  // Sensible limits: lose ≤ 0.75%/wk (1% max), gain ≤ 0.35%/wk to keep fat gain modest.
  const comfortable = losing ? 0.75 : 0.35;
  const max = losing ? 1.0 : 0.5;
  const plannedPct = Math.abs(target - current) < 0.3 ? 0 : Math.sign(requiredPct) * Math.min(Math.abs(requiredPct), comfortable);
  let feasibility: Feasibility;
  if (Math.abs(target - current) < 0.5) feasibility = 'achieved';
  else if (Math.abs(requiredPct) <= comfortable) feasibility = 'on-track';
  else if (Math.abs(requiredPct) <= max) feasibility = 'ambitious';
  else feasibility = 'unrealistic';
  let adjustedTarget: number | undefined;
  let adjustedDate: string | undefined;
  if (feasibility === 'unrealistic' || feasibility === 'ambitious') {
    adjustedTarget = Math.round((current * (1 + (Math.sign(requiredPct) * comfortable * weeksLeft) / 100)) * 2) / 2;
    const weeksNeeded = Math.abs((target - current) / current) / (comfortable / 100);
    adjustedDate = new Date(now + weeksNeeded * WEEK).toISOString().slice(0, 10);
  }
  return { start: g.start.bodyweight, current, target, requiredPct, observedPct, plannedPct, feasibility, adjustedTarget, adjustedDate };
}

const ACTIVITY: Record<NonNullable<AppState['profile']['activity']>, number> = { low: 1.45, moderate: 1.6, high: 1.75 };

/** Maintenance from the Mifflin-St Jeor equation × activity (lifting 3-5×/week included). */
export function estimatedMaintenance(s: AppState, bw: number): number {
  const p = s.profile;
  const a = age(s) ?? 30;
  const factor = ACTIVITY[p.activity ?? 'moderate'];
  if (!p.heightCm) return Math.round(bw * (p.sex === 'male' ? 34 : 31) * (factor / 1.6));
  const bmr = 10 * bw + 6.25 * p.heightCm - 5 * a + (p.sex === 'male' ? 5 : -161);
  return Math.round(bmr * factor);
}

export function macroPlan(s: AppState, bwGoal: BodyweightGoalStatus | undefined, hasStrengthGoals: boolean, now = Date.now()): MacroPlan | undefined {
  const bw = bodyweightAt(s);
  if (!bw) return undefined;
  const recent = s.nutrition.filter((n) => now - +new Date(n.date + 'T12:00:00') < 14 * DAY && n.kcal > 0);
  const loggedKcal = recent.length ? recent.reduce((a, n) => a + n.kcal, 0) / recent.length : undefined;
  const withProtein = recent.filter((n) => n.protein);
  const loggedProtein = withProtein.length ? withProtein.reduce((a, n) => a + (n.protein ?? 0), 0) / withProtein.length : undefined;
  const trend = bodyweightTrendPct(s, 3, now);

  // Adaptive maintenance: intake minus the energy stored/lost, once there's 10+ days of logs.
  let maintenance = estimatedMaintenance(s, bw);
  let maintenanceSource: MacroPlan['maintenanceSource'] = 'estimated';
  if (loggedKcal !== undefined && recent.length >= 10 && trend !== undefined) {
    const kgPerDay = (trend / 100) * bw / 7;
    maintenance = Math.round(loggedKcal - kgPerDay * KCAL_PER_KG);
    maintenanceSource = 'logged';
  }

  // Planned bodyweight change sets the surplus/deficit. With only strength goals, run a small surplus.
  const plannedPct = bwGoal ? bwGoal.plannedPct : hasStrengthGoals ? 0.15 : 0;
  const delta = Math.round(((plannedPct / 100) * bw * KCAL_PER_KG) / 7);
  const calories = Math.round((maintenance + delta) / 10) * 10;
  const cutting = plannedPct < -0.2;
  const protein = Math.round(bw * (cutting ? 2.2 : 1.8));
  const fat = Math.round(Math.max(bw * 0.8, (calories * 0.22) / 9));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  // Weight moving differently from plan over 3+ weeks → adjust calories.
  let adjustment: MacroPlan['adjustment'];
  if (trend !== undefined && bwGoal && maintenanceSource === 'estimated') {
    const gap = plannedPct - trend; // %/week
    if (Math.abs(gap) >= 0.2) {
      const kcal = Math.round(((gap / 100) * bw * KCAL_PER_KG) / 7 / 10) * 10;
      adjustment = { kcal, reason: `Weight is changing ${trend.toFixed(2)}%/week vs the planned ${plannedPct.toFixed(2)}%/week.` };
    }
  }
  return { maintenance, maintenanceSource, calories, protein, fat, carbs, loggedKcal, loggedProtein, loggedDays: recent.length, adjustment };
}

export function goalReport(s: AppState, now = Date.now()): GoalReport | undefined {
  const g = s.goals;
  if (!g) return undefined;
  const weeksLeft = Math.max(0, (+new Date(g.targetDate + 'T12:00:00') - now) / WEEK);
  const bwStatus = bodyweightStatus(s, g, weeksLeft, now);
  const bw = bodyweightAt(s) ?? g.bodyweight ?? 80;
  const bwPlan = bwStatus?.plannedPct ?? 0.15;
  const lifts = g.lifts.map((l) => liftStatus(s, g, l.exerciseId, l.target, weeksLeft, bw, bwPlan, now));
  const macros = macroPlan(s, bwStatus, lifts.length > 0, now);
  const warnings: string[] = [];

  if (weeksLeft < 1) warnings.push('The target date has passed or is this week: set a new date to keep tracking.');
  if (bwStatus && bwStatus.plannedPct < -0.3 && lifts.some((l) => l.feasibility !== 'achieved' && l.requiredPct > 0.2))
    warnings.push('You are aiming to lose weight and gain strength at the same time. In a deficit, expect to hold strength rather than set PRs; consider sequencing (cut first, then a strength block at maintenance or in a surplus).');
  if (bwStatus?.feasibility === 'unrealistic')
    warnings.push(`Changing bodyweight by ${Math.abs(bwStatus.requiredPct).toFixed(2)}%/week is too fast to do well${bwStatus.adjustedDate ? `; a sustainable pace reaches ${bwStatus.target} kg around ${bwStatus.adjustedDate}` : ''}.`);
  for (const l of lifts)
    if (l.feasibility === 'unrealistic')
      warnings.push(`${l.name}: the target needs +${l.requiredPct.toFixed(2)}%/week but ~${l.realisticPct.toFixed(2)}%/week is realistic at your level${l.projectedDate ? `; expect to reach it around ${l.projectedDate}` : ''}.`);
  if (macros?.loggedProtein !== undefined && macros.loggedProtein < macros.protein * 0.8)
    warnings.push(`Protein is averaging ${Math.round(macros.loggedProtein)} g/day vs a ${macros.protein} g target: low protein limits strength and muscle gain.`);
  if (macros?.loggedKcal !== undefined && macros.loggedDays >= 7 && Math.abs(macros.loggedKcal - macros.calories) > 300)
    warnings.push(`Logged intake (${Math.round(macros.loggedKcal)} kcal) is ${macros.loggedKcal > macros.calories ? 'above' : 'below'} the ${macros.calories} kcal target by ${Math.round(Math.abs(macros.loggedKcal - macros.calories))} kcal.`);

  const all = [...lifts.map((l) => l.feasibility), ...(bwStatus ? [bwStatus.feasibility] : [])].filter((f) => f !== 'no-data');
  const overall: Feasibility = all.includes('unrealistic') ? 'unrealistic' : all.includes('ambitious') ? 'ambitious' : all.every((f) => f === 'achieved') && all.length ? 'achieved' : all.length ? 'on-track' : 'no-data';
  return { weeksLeft, lifts, bodyweight: bwStatus, macros, warnings, overall };
}

/** Target e1RM for reaching a strength level at a given bodyweight. */
export function targetForLevel(exerciseId: string, levelIndex: number, bw: number, s: AppState): number | undefined {
  const std = getExercise(exerciseId, s)?.standard ?? STANDARD_OF[exerciseId];
  if (!std) return undefined;
  return roundTo(loadForLevel(std, levelIndex, bw, s.profile.sex, age(s)), 2.5);
}

/** Text block for the AI coach's context. */
export function goalSummary(s: AppState): string {
  const r = goalReport(s);
  if (!r || !s.goals) return 'Goals: none set.';
  const lines = [`Goals (target date ${s.goals.targetDate}, ${r.weeksLeft.toFixed(1)} weeks left; overall: ${r.overall}):`];
  for (const l of r.lifts)
    lines.push(
      `- ${l.name}: start ${l.start.toFixed(1)} → now ${l.current.toFixed(1)} → target ${l.target} kg e1RM; needs ${Number.isFinite(l.requiredPct) ? l.requiredPct.toFixed(2) : '∞'}%/wk, realistic ${l.realisticPct.toFixed(2)}%/wk` +
        `${l.observedPct !== undefined ? `, observed ${l.observedPct.toFixed(2)}%/wk` : ''}; projected ${l.projectedAtDate.toFixed(1)} by target date; ${l.feasibility}${l.projectedDate ? `; target reached ~${l.projectedDate}` : ''}.`,
    );
  if (r.bodyweight)
    lines.push(`- Bodyweight: now ${r.bodyweight.current} → target ${r.bodyweight.target} kg; needs ${r.bodyweight.requiredPct.toFixed(2)}%/wk, observed ${r.bodyweight.observedPct?.toFixed(2) ?? 'n/a'}%/wk, plan ${r.bodyweight.plannedPct.toFixed(2)}%/wk; ${r.bodyweight.feasibility}.`);
  if (r.macros)
    lines.push(
      `Nutrition plan: ${r.macros.calories} kcal (maintenance ${r.macros.maintenance}, ${r.macros.maintenanceSource}), protein ${r.macros.protein} g, fat ${r.macros.fat} g, carbs ${r.macros.carbs} g. ` +
        `Logged last 14 days: ${r.macros.loggedDays} days${r.macros.loggedKcal ? `, avg ${Math.round(r.macros.loggedKcal)} kcal` : ''}${r.macros.loggedProtein ? `, ${Math.round(r.macros.loggedProtein)} g protein` : ''}.`,
    );
  const p = s.profile;
  lines.push(`Profile: height ${p.heightCm ?? 'unknown'} cm, activity ${p.activity ?? 'moderate'}.`);
  if (r.warnings.length) lines.push('Warnings: ' + r.warnings.join(' '));
  return lines.join('\n');
}
