import { describe, expect, it } from 'vitest';
import type { AppState, Program, Workout } from '../../types';
import { DEFAULT_STATE } from '../store';
import { nextSessionDate } from '../workout';

const NOW = new Date(2026, 9, 20, 10, 0, 0); // 20 Oct 2026, local time
const daysAgo = (n: number) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 18, 0, 0).toISOString();
const midnight = (offsetDays = 0) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + offsetDays);

/** A program with `perWeek` days in a single week. */
function program(perWeek: number, weeks = 1): Program {
  return {
    id: 'p1',
    name: 'Test program',
    description: '',
    weeks: Array.from({ length: weeks }, (_, w) => ({
      name: `Week ${w + 1}`,
      days: Array.from({ length: perWeek }, (_, d) => ({ id: `w${w}d${d}`, name: `Day ${d + 1}`, exercises: [] })),
    })),
  };
}

function workout(n: number): Workout {
  return { id: `w${n}`, name: 'W', startedAt: daysAgo(n), finishedAt: daysAgo(n), exercises: [] };
}

function base(over: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, programs: [program(3)], activeProgram: { programId: 'p1', nextIndex: 0 }, ...over };
}

describe('nextSessionDate', () => {
  it('is undefined when not following a program', () => {
    expect(nextSessionDate(base({ activeProgram: undefined }), NOW)).toBeUndefined();
  });

  it('is today when the program has never been trained', () => {
    expect(nextSessionDate(base({ workouts: [] }), NOW)).toEqual(midnight(0));
  });

  it('spaces sessions by the program frequency: 3×/week trains every ~2 days', () => {
    expect(nextSessionDate(base({ workouts: [workout(0)] }), NOW)).toEqual(midnight(2));
    expect(nextSessionDate(base({ workouts: [workout(1)] }), NOW)).toEqual(midnight(1));
  });

  it('a 6×/week program comes due the next day', () => {
    const s = base({ programs: [program(6)], workouts: [workout(0)] });
    expect(nextSessionDate(s, NOW)).toEqual(midnight(1));
  });

  it('a 2×/week program spaces sessions further out', () => {
    const s = base({ programs: [program(2)], workouts: [workout(0)] });
    expect(nextSessionDate(s, NOW)).toEqual(midnight(4));
  });

  it('averages frequency across a multi-week program', () => {
    // 8 days over 2 weeks = 4/week -> every ~2 days
    const s = base({ programs: [program(4, 2)], workouts: [workout(0)] });
    expect(nextSessionDate(s, NOW)).toEqual(midnight(2));
  });

  it('never points at the past — overdue reads as today', () => {
    expect(nextSessionDate(base({ workouts: [workout(30)] }), NOW)).toEqual(midnight(0));
  });

  it('counts from the most recent session, not the first', () => {
    const s = base({ workouts: [workout(30), workout(20), workout(1)] });
    expect(nextSessionDate(s, NOW)).toEqual(midnight(1));
  });

  it('ignores unfinished workouts', () => {
    const unfinished: Workout = { id: 'live', name: 'W', startedAt: daysAgo(0), exercises: [] };
    const s = base({ workouts: [workout(5), unfinished] });
    expect(nextSessionDate(s, NOW)).toEqual(midnight(0)); // last finished was 5 days ago -> overdue
  });
});
