import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../../data/exercises';
import { replacementScore } from '../exerciseMatch';

const byId = (id: string) => {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error(`missing fixture exercise: ${id}`);
  return ex;
};

/** The picker's ordering: best replacements first, excluding the exercise itself. */
const ranked = (sourceId: string) => {
  const source = byId(sourceId);
  return EXERCISES.filter((e) => e.id !== source.id)
    .slice()
    .sort((a, b) => replacementScore(source, b) - replacementScore(source, a) || a.name.localeCompare(b.name));
};

describe('replacementScore ranking', () => {
  it('offers deadlift variations first when swapping a sumo deadlift', () => {
    const top = ranked('sumo-deadlift').slice(0, 8);
    expect(top.every((e) => e.category === 'deadlift')).toBe(true);
    expect(top.map((e) => e.id)).toContain('deficit-sumo-deadlift');
  });

  it('puts the same competition lift above merely-similar movements', () => {
    const source = byId('sumo-deadlift');
    const sameLift = byId('deficit-sumo-deadlift'); // shares the sumoDeadlift standard
    const otherHinge = byId('romanian-deadlift');
    expect(replacementScore(source, sameLift)).toBeGreaterThan(replacementScore(source, otherHinge));
  });

  it('keeps squat swaps in the squat family, not the deadlift one', () => {
    const top = ranked('squat').slice(0, 6);
    expect(top.every((e) => e.category === 'squat')).toBe(true);
  });

  it('ranks a bench press replacement as a pressing movement', () => {
    const top = ranked('bench-press').slice(0, 5);
    expect(top.every((e) => e.category === 'bench' || e.category === 'chest')).toBe(true);
  });

  it('scores an unrelated exercise far below a same-category one', () => {
    const source = byId('bench-press');
    expect(replacementScore(source, byId('squat'))).toBeLessThan(replacementScore(source, byId('close-grip-bench')));
  });
});
