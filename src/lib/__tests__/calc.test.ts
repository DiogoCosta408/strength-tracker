import { describe, expect, it } from 'vitest';
import { dots, e1rm, ipfGl, loadForRpe, platesFor, rpePercent, warmupRamp, wilks, wilks2 } from '../calc';
import { liftScore, muscleScores } from '../strength';

describe('RPE chart', () => {
  it('matches the RTS table', () => {
    expect(rpePercent(1, 10)).toBeCloseTo(1);
    expect(rpePercent(5, 8)).toBeCloseTo(0.811);
    expect(rpePercent(3, 9)).toBeCloseTo(0.892);
    expect(rpePercent(12, 6)).toBeCloseTo(0.572);
  });
  it('round-trips e1RM and load', () => {
    const e1 = e1rm(150, 5, 8);
    expect(e1).toBeCloseTo(150 / 0.811, 1);
    expect(loadForRpe(e1, 5, 8)).toBeCloseTo(150, 5);
  });
  it('treats a single without RPE as a true 1RM', () => {
    expect(e1rm(200, 1)).toBe(200);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1); // Epley
  });
});

describe('points formulas', () => {
  // Reference values: published Wilks table (100 kg M = 0.6086, 60 kg F = 1.1149),
  // DOTS coefficient at 83 kg M ≈ 0.675, IPF GL 700 kg @ 90 kg classic M ≈ 93.06.
  it('Wilks', () => {
    expect(wilks(1, 100, 'male')).toBeCloseTo(0.6086, 3);
    expect(wilks(1, 60, 'female')).toBeCloseTo(1.1149, 3);
  });
  it('DOTS', () => expect(dots(1, 83, 'male')).toBeCloseTo(0.675, 3));
  it('Wilks 2020', () => expect(wilks2(600, 83, 'male')).toBeGreaterThan(400));
  it('IPF GL', () => expect(ipfGl(700, 90, 'male')).toBeCloseTo(93.06, 1));
  it('female formulas are positive and larger per kg', () => expect(dots(400, 63, 'female')).toBeGreaterThan(dots(400, 63, 'male')));
});

describe('plates', () => {
  it('loads 142.5 on a 20 kg bar', () => {
    const r = platesFor(142.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(r.perSide).toEqual([25, 25, 10, 1.25]);
    expect(r.remainder).toBe(0);
  });
  it('reports what cannot be loaded', () => expect(platesFor(101, 20, [25, 20, 10, 5, 2.5]).remainder).toBe(1));
  it('warm-up ramp stays below work weight', () => {
    const ramp = warmupRamp(180, 20, 2.5);
    expect(ramp[0].weight).toBe(20);
    expect(ramp.every((r) => r.weight < 180)).toBe(true);
  });
});

describe('strength standards', () => {
  it('maps thresholds to level scores', () => {
    expect(liftScore('squat', 150, 100, 'male')).toBeCloseTo(40);
    expect(liftScore('squat', 200, 100, 'male')).toBeCloseTo(60);
    expect(liftScore('bench', 0, 100, 'male')).toBe(0);
  });
  it('colours only muscles trained by scored lifts', () => {
    const m = muscleScores({ bench: 50 });
    expect(m.chest).toBeCloseTo(50);
    expect(m.calves).toBeNull();
  });
});
