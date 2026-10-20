import { describe, expect, it } from 'vitest';
import { niceTicks } from '../../components/Charts';

/**
 * Charts scale to the last tick, so ticks must always bracket the data. When they didn't,
 * bars taller than the top tick were drawn above the plot area and (overflow: visible)
 * painted over the card heading above the chart.
 */
describe('niceTicks', () => {
  const cases: [number, number][] = [
    [0, 17700], // weekly tonnage — the case that broke the dashboard
    [0, 1],
    [0, 9435],
    [0, 12000],
    [0, 999],
    [0, 0.42],
    [120, 137.5], // e1RM window
    [-30, 45],
    [54, 58],
  ];

  it('always covers the full range', () => {
    for (const [min, max] of cases) {
      const ticks = niceTicks(min, max);
      expect(ticks.length).toBeGreaterThan(1);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBeLessThanOrEqual(min);
    }
  });

  it('covers the range at the bar chart tick count too', () => {
    for (const [min, max] of cases) {
      const ticks = niceTicks(min, max, 3);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it('is ascending and evenly spaced', () => {
    const ticks = niceTicks(0, 17700, 3);
    const step = ticks[1] - ticks[0];
    ticks.forEach((t, i) => i && expect(t - ticks[i - 1]).toBeCloseTo(step, 6));
  });

  it('handles a flat series without collapsing', () => {
    const ticks = niceTicks(100, 100);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
  });
});
