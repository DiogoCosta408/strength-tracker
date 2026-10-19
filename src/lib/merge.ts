// Pure merge logic for cloud sync. No I/O here — see sync.ts for the Drive round-trip.
import type { AppState, CoachMessage, Diagnosis, SyncCollection, Tombstone } from '../types';

type Identified = { id: string; updatedAt?: string };

/** Union two tombstone lists by (collection, id), keeping the latest deletedAt. */
export function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const byKey = new Map<string, Tombstone>();
  for (const t of [...a, ...b]) {
    const key = `${t.collection}:${t.id}`;
    const existing = byKey.get(key);
    if (!existing || t.deletedAt > existing.deletedAt) byKey.set(key, t);
  }
  return [...byKey.values()];
}

/** Union two record arrays by id. On a shared id, the one with the later (or missing-is-oldest) updatedAt wins. */
export function unionById<T extends Identified>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const rec of [...local, ...remote]) {
    const existing = byId.get(rec.id);
    if (!existing || (rec.updatedAt ?? '') > (existing.updatedAt ?? '')) byId.set(rec.id, rec);
  }
  return [...byId.values()];
}

/** Drops records whose tombstone deletion is at least as recent as the surviving record's own edit. */
export function pruneDeleted<T extends Identified>(items: T[], tombstones: Tombstone[], collection: SyncCollection): T[] {
  const deletedAt = new Map<string, string>();
  for (const t of tombstones) {
    if (t.collection !== collection) continue;
    const prev = deletedAt.get(t.id);
    if (!prev || t.deletedAt > prev) deletedAt.set(t.id, t.deletedAt);
  }
  return items.filter((rec) => {
    const del = deletedAt.get(rec.id);
    return del === undefined || del < (rec.updatedAt ?? '');
  });
}

/** Union by id, then prune anything tombstoned. For the 3 collections that have a delete action. */
export function mergeCollection<T extends Identified>(local: T[], remote: T[], tombstones: Tombstone[], collection: SyncCollection): T[] {
  return pruneDeleted(unionById(local, remote), tombstones, collection);
}

/**
 * Collapses records that share a key (used for bodyweight/nutrition, which upsert-by-date with a
 * fresh id each time — so a stale remote row and a fresh local row for the same date are different ids).
 */
export function dedupeLatestByKey<T extends { updatedAt?: string }>(items: T[], keyFn: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = byKey.get(key);
    if (!existing || (item.updatedAt ?? '') > (existing.updatedAt ?? '')) byKey.set(key, item);
  }
  return [...byKey.values()];
}

/** Per-key last-write-wins for manualMaxes, using the sibling manualMaxUpdatedAt timestamp map (so a deletion still wins on recency). */
export function mergeManualMaxes(
  localValues: Record<string, number>,
  localUpdatedAt: Record<string, string>,
  remoteValues: Record<string, number>,
  remoteUpdatedAt: Record<string, string>,
): { values: Record<string, number>; updatedAt: Record<string, string> } {
  const keys = new Set([...Object.keys(localValues), ...Object.keys(remoteValues), ...Object.keys(localUpdatedAt), ...Object.keys(remoteUpdatedAt)]);
  const values: Record<string, number> = {};
  const updatedAt: Record<string, string> = {};
  for (const k of keys) {
    const useRemote = (remoteUpdatedAt[k] ?? '') > (localUpdatedAt[k] ?? '');
    const srcValues = useRemote ? remoteValues : localValues;
    const srcUpdatedAt = useRemote ? remoteUpdatedAt : localUpdatedAt;
    if (k in srcValues) values[k] = srcValues[k];
    if (srcUpdatedAt[k]) updatedAt[k] = srcUpdatedAt[k];
  }
  return { values, updatedAt };
}

/** Per-key last-write-wins for diagnoses, using each entry's own updatedAt. No delete action exists, so no tombstones. */
export function mergeDiagnoses(local: Record<string, Diagnosis>, remote: Record<string, Diagnosis>): Record<string, Diagnosis> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, Diagnosis> = {};
  for (const k of keys) {
    const l = local[k];
    const r = remote[k];
    out[k] = !l ? r : !r ? l : r.updatedAt > l.updatedAt ? r : l;
  }
  return out;
}

/** Messages are immutable once sent and there's no delete action, so a plain union by id (ordered by time) is enough. */
export function mergeCoachChat(local: CoachMessage[], remote: CoachMessage[]): CoachMessage[] {
  const byId = new Map<string, CoachMessage>();
  for (const m of [...local, ...remote]) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** Merges two full app states. Every field is assigned explicitly (no base spread) so none can be silently dropped. */
export function mergeAppState(local: AppState, remote: AppState): AppState {
  const tombstones = mergeTombstones(local.tombstones ?? [], remote.tombstones ?? []);
  const { values: manualMaxes, updatedAt: manualMaxUpdatedAt } = mergeManualMaxes(local.manualMaxes, local.manualMaxUpdatedAt ?? {}, remote.manualMaxes, remote.manualMaxUpdatedAt ?? {});

  const useRemoteGoals = (remote.goalsUpdatedAt ?? '') > (local.goalsUpdatedAt ?? '');
  const useRemoteActiveProgram = (remote.activeProgramUpdatedAt ?? '') > (local.activeProgramUpdatedAt ?? '');
  const useRemoteProfile = (remote.profile.updatedAt ?? '') > (local.profile.updatedAt ?? '');

  return {
    version: 1,
    profile: useRemoteProfile ? remote.profile : local.profile,
    workouts: mergeCollection(local.workouts, remote.workouts, tombstones, 'workouts'),
    activeWorkout: local.activeWorkout, // per-device in-progress session, never synced
    programs: mergeCollection(local.programs, remote.programs, tombstones, 'programs'),
    customExercises: unionById(local.customExercises, remote.customExercises),
    bodyweight: dedupeLatestByKey(mergeCollection(local.bodyweight, remote.bodyweight, tombstones, 'bodyweight'), (b) => b.date),
    activeProgram: useRemoteActiveProgram ? remote.activeProgram : local.activeProgram,
    manualMaxes,
    manualMaxUpdatedAt,
    diagnoses: mergeDiagnoses(local.diagnoses, remote.diagnoses),
    coachChat: mergeCoachChat(local.coachChat, remote.coachChat),
    goals: useRemoteGoals ? remote.goals : local.goals,
    nutrition: dedupeLatestByKey(unionById(local.nutrition, remote.nutrition), (n) => n.date),
    tombstones,
    goalsUpdatedAt: useRemoteGoals ? remote.goalsUpdatedAt : local.goalsUpdatedAt,
    activeProgramUpdatedAt: useRemoteActiveProgram ? remote.activeProgramUpdatedAt : local.activeProgramUpdatedAt,
  };
}
