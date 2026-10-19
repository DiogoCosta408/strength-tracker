import { describe, expect, it } from 'vitest';
import type { AppState, Workout } from '../../types';
import { DEFAULT_STATE } from '../store';
import { dedupeLatestByKey, mergeAppState, mergeCollection, mergeDiagnoses, mergeManualMaxes, mergeTombstones, unionById } from '../merge';

const NOW = Date.now();
const DAY = 86400000;
const t = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

function base(over: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, ...over };
}

function workout(id: string, updatedAt: string, extra: Partial<Workout> = {}): Workout {
  return { id, name: 'W', startedAt: updatedAt, finishedAt: updatedAt, updatedAt, exercises: [], ...extra };
}

describe('mergeCollection (union + tombstones)', () => {
  it('unions new records from both sides', () => {
    const a = [workout('a', t(2))];
    const b = [workout('b', t(1))];
    const out = mergeCollection(a, b, [], 'workouts');
    expect(out.map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('same record edited on both sides: the newer updatedAt wins', () => {
    const local = [workout('a', t(2), { name: 'older edit' })];
    const remote = [workout('a', t(1), { name: 'newer edit' })];
    const out = mergeCollection(local, remote, [], 'workouts');
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('newer edit');
  });

  it('a delete after the other side\'s edit wins (record stays gone)', () => {
    const local = [workout('a', t(5))]; // edited 5 days ago
    const remote: Workout[] = []; // remote deleted it
    const tombstones = [{ collection: 'workouts' as const, id: 'a', deletedAt: t(1) }]; // deleted 1 day ago, after the edit
    const out = mergeCollection(local, remote, tombstones, 'workouts');
    expect(out).toEqual([]);
  });

  it('an edit after the other side\'s delete wins (record survives)', () => {
    const local = [workout('a', t(1))]; // edited 1 day ago
    const remote: Workout[] = [];
    const tombstones = [{ collection: 'workouts' as const, id: 'a', deletedAt: t(5) }]; // deleted 5 days ago, before the edit
    const out = mergeCollection(local, remote, tombstones, 'workouts');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });
});

describe('mergeTombstones', () => {
  it('unions by (collection, id), keeping the latest deletedAt', () => {
    const a = [{ collection: 'workouts' as const, id: 'x', deletedAt: t(5) }];
    const b = [{ collection: 'workouts' as const, id: 'x', deletedAt: t(1) }];
    expect(mergeTombstones(a, b)).toEqual([{ collection: 'workouts', id: 'x', deletedAt: t(1) }]);
  });
});

describe('dedupeLatestByKey (bodyweight/nutrition same-date collisions)', () => {
  it('keeps the newer entry for a shared date', () => {
    const items = [
      { id: 'old', date: '2026-01-01', weight: 80, updatedAt: t(5) },
      { id: 'new', date: '2026-01-01', weight: 81, updatedAt: t(1) },
    ];
    const out = dedupeLatestByKey(items, (x) => x.date);
    expect(out).toEqual([{ id: 'new', date: '2026-01-01', weight: 81, updatedAt: t(1) }]);
  });
});

describe('unionById', () => {
  it('keeps both when ids differ (e.g. custom exercises added on each device)', () => {
    const out = unionById([{ id: 'a', updatedAt: t(2) }], [{ id: 'b', updatedAt: t(1) }]);
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
});

describe('mergeManualMaxes', () => {
  it('a later set beats an earlier set', () => {
    const r = mergeManualMaxes({ squat: 180 }, { squat: t(5) }, { squat: 185 }, { squat: t(1) });
    expect(r.values).toEqual({ squat: 185 });
    expect(r.updatedAt).toEqual({ squat: t(1) });
  });

  it('a later delete beats an earlier set (value stays removed)', () => {
    // local deleted squat at t(1); remote still has an older value from t(5)
    const r = mergeManualMaxes({}, { squat: t(1) }, { squat: 180 }, { squat: t(5) });
    expect(r.values).toEqual({});
    expect(r.updatedAt).toEqual({ squat: t(1) });
  });
});

describe('mergeDiagnoses', () => {
  it('keeps the newer answers per exercise', () => {
    const local = { squat: { exerciseId: 'squat', answers: { a: ['old'] }, updatedAt: t(5) } };
    const remote = { squat: { exerciseId: 'squat', answers: { a: ['new'] }, updatedAt: t(1) }, bench: { exerciseId: 'bench', answers: {}, updatedAt: t(3) } };
    const out = mergeDiagnoses(local, remote);
    expect(out.squat.answers).toEqual({ a: ['new'] });
    expect(out.bench).toBeDefined();
  });
});

describe('mergeAppState', () => {
  it('unions new workouts logged on both devices', () => {
    const local = base({ workouts: [workout('local-1', t(1))] });
    const remote = base({ workouts: [workout('remote-1', t(2))] });
    const merged = mergeAppState(local, remote);
    expect(merged.workouts.map((w) => w.id).sort()).toEqual(['local-1', 'remote-1']);
  });

  it('a deleted workout does not come back from the other device', () => {
    const shared = workout('w1', t(10));
    const local = base({ workouts: [], tombstones: [{ collection: 'workouts', id: 'w1', deletedAt: t(1) }] });
    const remote = base({ workouts: [shared] });
    const merged = mergeAppState(local, remote);
    expect(merged.workouts).toEqual([]);
    expect(merged.tombstones).toEqual([{ collection: 'workouts', id: 'w1', deletedAt: t(1) }]);
  });

  it('goals deleted on one device stay deleted even if the other still has them', () => {
    const goal = { targetDate: '2026-06-01', lifts: [], createdAt: t(20), start: { lifts: {} } };
    const local = base({ goals: undefined, goalsUpdatedAt: t(1) }); // deleted most recently
    const remote = base({ goals: goal, goalsUpdatedAt: t(10) });
    expect(mergeAppState(local, remote).goals).toBeUndefined();
    expect(mergeAppState(remote, local).goals).toBeUndefined(); // order-independent
  });

  it('activeWorkout always stays local and is never pulled from remote', () => {
    const active = workout('in-progress', t(0));
    const local = base({ activeWorkout: active });
    const remote = base({ activeWorkout: undefined });
    expect(mergeAppState(local, remote).activeWorkout).toBe(active);
  });

  it('the newer profile wins as a whole object', () => {
    const local = base({ profile: { ...DEFAULT_STATE.profile, name: 'Old name', updatedAt: t(5) } });
    const remote = base({ profile: { ...DEFAULT_STATE.profile, name: 'New name', updatedAt: t(1) } });
    expect(mergeAppState(local, remote).profile.name).toBe('New name');
  });

  it('coachChat messages from both devices are unioned and time-ordered', () => {
    const local = base({ coachChat: [{ id: 'm2', role: 'assistant' as const, text: 'b', at: t(1) }] });
    const remote = base({ coachChat: [{ id: 'm1', role: 'user' as const, text: 'a', at: t(2) }] });
    expect(mergeAppState(local, remote).coachChat.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('is idempotent: merging a state with itself changes nothing', () => {
    const s = base({
      workouts: [workout('w1', t(3))],
      bodyweight: [{ id: 'b1', date: '2026-01-01', weight: 80, updatedAt: t(3) }],
      manualMaxes: { squat: 180 },
      manualMaxUpdatedAt: { squat: t(3) },
      goals: { targetDate: '2026-06-01', lifts: [], createdAt: t(20), start: { lifts: {} } },
      goalsUpdatedAt: t(3),
    });
    expect(mergeAppState(s, s)).toEqual(s);
  });
});
