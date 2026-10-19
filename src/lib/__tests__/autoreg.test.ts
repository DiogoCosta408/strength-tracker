import { describe, expect, it } from 'vitest';
import type { AppState, LoggedExercise } from '../../types';
import { DEFAULT_STATE } from '../store';
import { reflowSuggestions, topSetBase } from '../workout';

const s: AppState = { ...DEFAULT_STATE, bodyweight: [{ id: 'b', date: '2026-10-01', weight: 85 }] };
const set = (o: Partial<LoggedExercise['sets'][number]>) => ({ id: Math.random().toString(36), kind: 'work' as const, weight: 0, reps: 5, done: false, autoWeight: true, ...o });

describe('in-session autoregulation', () => {
  it('takes a smaller jump when a ramp set feels harder than planned', () => {
    // Planned 5@7, 5@8, 5@9 from a 250 kg e1RM; the 5@7 set (195) actually felt like RPE 8.
    const le: LoggedExercise = {
      id: 'e',
      exerciseId: 'squat',
      sets: [
        set({ weight: 195, rpe: 8, done: true, target: { kind: 'work', reps: 5, rpe: 7 } }),
        set({ weight: 202.5, target: { kind: 'work', reps: 5, rpe: 8 } }),
        set({ weight: 210, target: { kind: 'work', reps: 5, rpe: 9 } }),
      ],
    };
    const out = reflowSuggestions(s, le);
    // Today's e1RM = 195 / 0.811 ≈ 240 → 5@8 ≈ 195, 5@9 ≈ 201
    expect(out.sets[1].weight).toBe(195);
    expect(out.sets[2].weight).toBeLessThan(210);
    expect(out.sets[2].weight).toBeGreaterThan(195);
  });

  it('never overrides weights the lifter typed', () => {
    const le: LoggedExercise = {
      id: 'e',
      exerciseId: 'squat',
      sets: [set({ weight: 195, rpe: 9, done: true, target: { kind: 'work', reps: 5, rpe: 7 } }), set({ weight: 205, autoWeight: false, target: { kind: 'work', reps: 5, rpe: 8 } })],
    };
    expect(reflowSuggestions(s, le).sets[1].weight).toBe(205);
  });

  it('bases back-offs on the target-RPE weight after an overshoot', () => {
    // Top set 3 @ 9 planned; 200 kg felt like RPE 10 → the RPE 9 weight was ~194.
    const le: LoggedExercise = {
      id: 'e',
      exerciseId: 'squat',
      sets: [set({ kind: 'top', reps: 3, weight: 200, rpe: 10, done: true, target: { kind: 'top', reps: 3, rpe: 9 } }), set({ kind: 'backoff', reps: 3, target: { kind: 'backoff', reps: 3, percentOfTop: 95 } })],
    };
    const base = topSetBase(s, le)!;
    expect(base).toBeLessThan(200);
    expect(base).toBeGreaterThanOrEqual(192.5);
    expect(reflowSuggestions(s, le).sets[1].weight).toBe(Math.round((base * 0.95) / 2.5) * 2.5);
  });

  it('uses the top set as-is when it was on target', () => {
    const le: LoggedExercise = { id: 'e', exerciseId: 'squat', sets: [set({ kind: 'top', reps: 3, weight: 200, rpe: 9, done: true, target: { kind: 'top', reps: 3, rpe: 9 } })] };
    expect(topSetBase(s, le)).toBe(200);
  });
});
