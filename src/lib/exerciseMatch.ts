import type { Exercise } from '../types';

/**
 * How well `candidate` works as a stand-in for `source`, for the swap/replace picker:
 * the same competition lift first, then the same movement category, then overlapping
 * muscles. Used to rank alternatives so swapping a sumo deadlift offers the other
 * deadlift variations before anything else.
 */
export function replacementScore(source: Exercise, candidate: Exercise): number {
  let score = 0;
  if (source.standard && source.standard === candidate.standard) score += 100;
  if (source.category === candidate.category) score += 20;
  const primary = new Set(source.primary);
  const secondary = new Set(source.secondary);
  score += candidate.primary.filter((m) => primary.has(m)).length * 10;
  score += candidate.secondary.filter((m) => secondary.has(m)).length * 2;
  if (source.equipment === candidate.equipment) score += 3;
  return score;
}
