import { describe, expect, it } from 'vitest';
import type { AppState, Workout } from '../../types';
import { DEFAULT_STATE } from '../store';
import { analyzeLift, buildInsights, trainingSummary } from '../coach';
import { adviseFromAnswers } from '../../data/coachKnowledge';

const NOW = new Date('2026-10-19T12:00:00Z').getTime();
const DAY = 86400000;

/** One session every `every` days for `weeks` weeks; `top(i, n)` returns [weight, reps, rpe]. */
function sessions(exerciseId: string, weeks: number, every: number, top: (i: number, n: number) => [number, number, number]): Workout[] {
  const n = Math.floor((weeks * 7) / every);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(NOW - (n - i) * every * DAY).toISOString();
    const [w, r, rpe] = top(i, n);
    return {
      id: `${exerciseId}-${i}`,
      name: 'W',
      startedAt: date,
      finishedAt: date,
      bodyweight: 85,
      exercises: [{ id: `e${i}`, exerciseId, sets: [1, 2, 3].map((k) => ({ id: `s${i}${k}`, kind: 'work' as const, weight: w, reps: r, rpe, done: true })) }],
    };
  });
}

const state = (workouts: Workout[]): AppState => ({ ...DEFAULT_STATE, workouts, bodyweight: [{ id: 'b', date: '2026-10-01', weight: 85 }] });

describe('lift trend analysis', () => {
  it('detects a progressing lift', () => {
    const s = state(sessions('squat', 10, 3, (i) => [140 + i * 1.25, 5, 8]));
    const a = analyzeLift(s, 'squat', NOW);
    expect(a.trend).toBe('progressing');
    expect(a.slopePct).toBeGreaterThan(0.5);
  });

  it('detects a stall and rising RPE at the same load', () => {
    // 6 weeks of progress, then 6 weeks stuck at 100 kg with RPE creeping up 8 → 9.5.
    const s = state(
      sessions('bench-press', 12, 3, (i, n) => {
        const half = n / 2;
        return i < half ? [85 + i * 1.25, 5, 8] : [100, 5, Math.min(9.5, 8 + ((i - half) / half) * 1.5)];
      }),
    );
    const a = analyzeLift(s, 'bench', NOW);
    expect(['stalled', 'regressing']).toContain(a.trend);
    expect(a.weeksSincePR).toBeGreaterThanOrEqual(4);
    expect(a.rpeDrift).toBeGreaterThan(0.5);
    const ins = buildInsights(s, NOW).find((x) => x.family === 'bench' && x.severity !== 'good');
    expect(ins?.actions.join(' ')).toMatch(/deload/i);
  });

  it('flags low frequency and no variations on a stalled lift', () => {
    const s = state(sessions('deadlift', 10, 7, () => [200, 3, 8]));
    const ins = buildInsights(s, NOW).find((x) => x.family === 'deadlift');
    expect(ins?.severity).toBe('warn');
    expect(ins?.detail).toMatch(/1×\/week|only train the competition/);
  });

  it('needs at least 3 recent sessions', () => {
    expect(analyzeLift(state(sessions('press', 1, 4, () => [60, 5, 8])), 'press', NOW).trend).toBe('insufficient');
  });

  it('summarises training for the AI coach', () => {
    const txt = trainingSummary(state(sessions('squat', 4, 3, (i) => [150 + i, 5, 8])), NOW);
    expect(txt).toContain('Squat (Low Bar)');
    expect(txt).toMatch(/150×5@8/);
  });
});

describe('diagnostic advice', () => {
  it('maps a bench lockout miss to triceps work', () => {
    const r = adviseFromAnswers('bench', { fail_point: ['lockout'] });
    expect(r.rx.map((x) => x.exerciseId)).toContain('close-grip-bench');
  });
  it('merges recovery answers and dedupes', () => {
    const r = adviseFromAnswers('squat', { fail_point: ['hole'], breakdown: ['hips_rise'], sleep: ['lt6'] });
    const ids = r.rx.map((x) => x.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.programming.join(' ')).toMatch(/sleep/i);
  });
});
