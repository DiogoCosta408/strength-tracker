import { describe, expect, it } from 'vitest';
import type { AppState, Workout } from '../../types';
import { DEFAULT_STATE } from '../store';
import { estimatedMaintenance, goalReport, levelRate, macroPlan } from '../goals';

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
