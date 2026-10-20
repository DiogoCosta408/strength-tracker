import { describe, expect, it } from 'vitest';
import type { AppState, Workout } from '../../types';
import { DEFAULT_STATE } from '../store';
import { ageRateFactor, estimatedMaintenance, goalProgressPct, goalReport, levelRate, macroPlan } from '../goals';

const NOW = Date.now();
const DAY = 86400000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const ymd = (daysAgo: number) => iso(daysAgo).slice(0, 10);

function squatSessions(e1At: (daysAgo: number) => number, weeks = 12): Workout[] {
  const out: Workout[] = [];
  for (let d = weeks * 7; d >= 1; d -= 3) {
    // 5 reps @ RPE 8 → load = e1RM × 0.811
    const w = Math.round(e1At(d) * 0.811 * 2) / 2;
    out.push({ id: `w${d}`, name: 'W', startedAt: iso(d), finishedAt: iso(d), exercises: [{ id: `e${d}`, exerciseId: 'squat', sets: [{ id: `s${d}`, kind: 'work', weight: w, reps: 5, rpe: 8, done: true }] }] });
  }
  return out;
}

function base(over: Partial<AppState>): AppState {
  return {
    ...DEFAULT_STATE,
    profile: { ...DEFAULT_STATE.profile, sex: 'male', heightCm: 180, birthYear: new Date().getFullYear() - 30 },
    bodyweight: Array.from({ length: 28 }, (_, i) => ({ id: `b${i}`, date: ymd(27 - i), weight: 85 })),
    ...over,
  };
}

describe('goal feasibility', () => {
  it('rates slow down with strength level', () => {
    expect(levelRate(10)).toBeGreaterThan(levelRate(50));
    expect(levelRate(50)).toBeGreaterThan(levelRate(90));
  });

  it('calls a modest target for a progressing intermediate on track', () => {
    const s = base({ workouts: squatSessions((d) => 160 - d * 0.1), goals: { targetDate: ymd(-112), lifts: [{ exerciseId: 'squat', target: 165 }], createdAt: iso(0), start: { lifts: { squat: 155 } } } });
    const r = goalReport(s, NOW)!;
    expect(r.lifts[0].feasibility).toBe('on-track');
  });

  it('flags +40 kg in 8 weeks for an advanced squatter and offers an adjusted target', () => {
    const s = base({ workouts: squatSessions(() => 200), goals: { targetDate: ymd(-56), lifts: [{ exerciseId: 'squat', target: 240 }], createdAt: iso(0), start: { lifts: { squat: 200 } } } });
    const l = goalReport(s, NOW)!.lifts[0];
    expect(l.feasibility).toBe('unrealistic');
    expect(l.adjustedTarget).toBeGreaterThan(200);
    expect(l.adjustedTarget).toBeLessThan(240);
    // Flat for 12 weeks at an advanced level: reaching +20% takes years, if at all within the 3-year horizon.
    expect(l.projectedDate === undefined || l.projectedDate > ymd(-56)).toBe(true);
  });

  it('warns when cutting fast while chasing strength PRs', () => {
    const s = base({ workouts: squatSessions(() => 180), goals: { targetDate: ymd(-84), lifts: [{ exerciseId: 'squat', target: 195 }], bodyweight: 78, createdAt: iso(0), start: { lifts: { squat: 180 }, bodyweight: 85 } } });
    const r = goalReport(s, NOW)!;
    expect(r.warnings.join(' ')).toMatch(/lose weight and gain strength/);
    expect(r.macros!.calories).toBeLessThan(r.macros!.maintenance);
    expect(r.macros!.protein).toBeGreaterThanOrEqual(85 * 2.2 - 1);
  });
});

describe('nutrition', () => {
  it('estimates maintenance with Mifflin-St Jeor', () => {
    const s = base({});
    // BMR = 10·85 + 6.25·180 − 5·30 + 5 = 1830; × 1.6 = 2928
    expect(estimatedMaintenance(s, 85)).toBe(2928);
  });

  it('uses logged intake when weight is stable', () => {
    const s = base({ nutrition: Array.from({ length: 14 }, (_, i) => ({ id: `n${i}`, date: ymd(i), kcal: 3100, protein: 170 })) });
    const m = macroPlan(s, undefined, false, NOW)!;
    expect(m.maintenanceSource).toBe('logged');
    expect(Math.abs(m.maintenance - 3100)).toBeLessThan(60);
    expect(m.protein * 4 + m.carbs * 4 + m.fat * 9).toBeGreaterThan(m.calories - 20);
  });
});

describe('age in projections', () => {
  it('peaks in the 20s and tapers after 30', () => {
    expect(ageRateFactor(25)).toBe(1);
    expect(ageRateFactor(30)).toBe(1);
    expect(ageRateFactor(45)).toBeLessThan(ageRateFactor(30));
    expect(ageRateFactor(60)).toBeLessThan(ageRateFactor(45));
  });

  it('assumes a lifter in their prime when birth year is unknown', () => {
    expect(ageRateFactor(undefined)).toBe(1);
  });

  it('never taper below a third of peak, however old', () => {
    expect(ageRateFactor(95)).toBeGreaterThanOrEqual(0.35);
  });

  it('projects a slower, less feasible climb for a masters lifter than a 25-year-old', () => {
    const goals = { targetDate: ymd(-84), lifts: [{ exerciseId: 'squat', target: 200 }], createdAt: iso(0), start: { lifts: { squat: 160 } } };
    const workouts = squatSessions((d) => 160 - d * 0.05);
    const young = goalReport(base({ workouts, goals, profile: { ...DEFAULT_STATE.profile, sex: 'male', heightCm: 180, birthYear: new Date().getFullYear() - 25 } }), NOW)!;
    const masters = goalReport(base({ workouts, goals, profile: { ...DEFAULT_STATE.profile, sex: 'male', heightCm: 180, birthYear: new Date().getFullYear() - 60 } }), NOW)!;
    expect(masters.lifts[0].projectedAtDate).toBeLessThan(young.lifts[0].projectedAtDate);
  });
});

describe('goalProgressPct', () => {
  it('measures from where the goal started, not from zero', () => {
    expect(goalProgressPct(100, 150, 200)).toBe(50);
    expect(goalProgressPct(100, 100, 200)).toBe(0);
    expect(goalProgressPct(100, 200, 200)).toBe(100);
  });

  it('clamps outside the range', () => {
    expect(goalProgressPct(100, 90, 200)).toBe(0); // went backwards
    expect(goalProgressPct(100, 250, 200)).toBe(100); // overshot
  });

  it('handles a goal already met when it was set', () => {
    expect(goalProgressPct(200, 200, 200)).toBe(100);
    expect(goalProgressPct(200, 150, 200)).toBe(0);
  });

  it('works for a cut, where the target is below the start', () => {
    expect(goalProgressPct(90, 85, 80)).toBe(50);
  });
});

describe('goal start for a lift that was never logged', () => {
  const goal = (createdDaysAgo: number) => ({
    targetDate: ymd(-56),
    lifts: [{ exerciseId: 'squat', target: 200 }],
    createdAt: iso(createdDaysAgo),
    start: { lifts: { squat: 0 } }, // never logged when the goal was set
  });

  it('does not count an unlogged lift as most of the way there', () => {
    // Goal set 30 days ago with no squat history; first session logged 20 days ago at ~140.
    const s = base({ workouts: squatSessions(() => 140, 3), goals: goal(30) });
    const l = goalReport(s, NOW)!.lifts[0];
    expect(l.start).toBeGreaterThan(100); // anchored on the first logged session, not 0
    expect(goalProgressPct(l.start, l.current, l.target)).toBeLessThan(20);
  });

  it('keeps a real recorded start when there was one', () => {
    const g = { ...goal(30), start: { lifts: { squat: 150 } } };
    const s = base({ workouts: squatSessions(() => 170, 3), goals: g });
    expect(goalReport(s, NOW)!.lifts[0].start).toBe(150);
  });

  it('falls back to current when nothing has been logged since the goal was set', () => {
    const s = base({ workouts: [], goals: goal(30) });
    const l = goalReport(s, NOW)!.lifts[0];
    expect(l.start).toBe(l.current);
  });
});
