import { describe, expect, it } from 'vitest';
import type { AppState, Workout } from '../../types';
import { DEFAULT_STATE } from '../store';
import { balanceScore } from '../strength';
import { strengthScoreHistory } from '../stats';

const DAY = 86400000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();
const ymd = (daysAgo: number) => iso(daysAgo).slice(0, 10);

function squatWorkout(daysAgo: number, weight: number): Workout {
  return {
    id: `w${daysAgo}`,
    name: 'W',
    startedAt: iso(daysAgo),
    finishedAt: iso(daysAgo),
    exercises: [{ id: `e${daysAgo}`, exerciseId: 'squat', sets: [{ id: `s${daysAgo}`, kind: 'work', weight, reps: 5, rpe: 8, done: true }] }],
  };
}

function base(over: Partial<AppState> = {}): AppState {
  return {
    ...DEFAULT_STATE,
    profile: { ...DEFAULT_STATE.profile, sex: 'male', birthYear: new Date().getFullYear() - 30 },
    bodyweight: Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, date: ymd(80 - i * 7), weight: 85 })),
    ...over,
  };
}

describe('balanceScore', () => {
  it('is 100 when every lift sits at the same score', () => {
    expect(balanceScore([{ score: 50 }, { score: 50 }, { score: 50 }])).toBe(100);
  });

  it('drops as lifts spread apart', () => {
    const even = balanceScore([{ score: 45 }, { score: 55 }]);
    const uneven = balanceScore([{ score: 20 }, { score: 80 }]);
    expect(even).toBeGreaterThan(uneven);
    expect(uneven).toBeLessThan(50);
  });

  it('never goes negative, and a single lift is trivially balanced', () => {
    expect(balanceScore([{ score: 10 }, { score: 120 }])).toBeGreaterThanOrEqual(0);
    expect(balanceScore([{ score: 42 }])).toBe(100);
  });
});

describe('strengthScoreHistory', () => {
  it('is empty without bodyweight (scores are relative to it)', () => {
    expect(strengthScoreHistory(base({ bodyweight: [], workouts: [squatWorkout(10, 100)] }))).toEqual([]);
  });

  it('rises over time as the lift gets heavier', () => {
    const s = base({ workouts: [squatWorkout(60, 100), squatWorkout(30, 140), squatWorkout(5, 180)] });
    const history = strengthScoreHistory(s, 12);
    expect(history.length).toBeGreaterThan(1);
    expect(history[history.length - 1].score).toBeGreaterThan(history[0].score);
  });

  it('only counts data logged up to each point, so it never looks ahead', () => {
    const s = base({ workouts: [squatWorkout(3, 250)] });
    const history = strengthScoreHistory(s, 8);
    // A single very recent session: earlier weeks have nothing to score yet.
    expect(history.length).toBe(1);
  });
});

/**
 * Regression guard for a crash that blanked the whole app: `useEffect(() => doThing(), deps)`
 * implicitly returns whatever doThing() returns, and React calls that as the effect's cleanup
 * on the next run/unmount. A non-function there throws out of the commit phase.
 */
describe('useEffect callbacks', () => {
  const sources = import.meta.glob('../../**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

  it('never use a concise arrow body (its return value becomes the cleanup)', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (path.includes('__tests__')) continue;
      source.split('\n').forEach((line, i) => {
        // `useEffect(() => something...` where the next char isn't `{` — i.e. an expression body.
        if (/useEffect\(\s*\(\)\s*=>\s*[^{\s]/.test(line)) offenders.push(`${path}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
