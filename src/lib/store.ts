import { useSyncExternalStore } from 'react';
import type { AppState, Exercise } from '../types';
import { EXERCISES } from '../data/exercises';
import { BUILTIN_PROGRAMS } from '../data/programs';

const DB_NAME = 'strength-tracker';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'strength-tracker-state';

export const DEFAULT_STATE: AppState = {
  version: 1,
  profile: {
    name: '',
    sex: 'male',
    barWeight: 20,
    rounding: 2.5,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
    defaultRest: 180,
    e1rmFormula: 'epley',
  },
  workouts: [],
  programs: [],
  customExercises: [],
  bodyweight: [],
  manualMaxes: {},
};

let state: AppState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<AppState | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as AppState | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(value: AppState): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function migrate(s: Partial<AppState>): AppState {
  return { ...DEFAULT_STATE, ...s, profile: { ...DEFAULT_STATE.profile, ...(s.profile ?? {}) } } as AppState;
}

export async function loadState(): Promise<void> {
  let s: AppState | undefined;
  try {
    s = await idbGet();
  } catch {
    /* IndexedDB unavailable, fall back below */
  }
  if (!s) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) s = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  state = migrate(s ?? {});
  loaded = true;
  try {
    // Ask the browser not to evict our data under storage pressure.
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
  emit();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await idbSet(state);
    } catch {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }
  }, 250);
}

function emit() {
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

/** Immutable update helper: pass a function returning the new state. */
export function update(fn: (s: AppState) => AppState): void {
  state = fn(state);
  emit();
  scheduleSave();
}

export function replaceState(next: AppState): void {
  state = migrate(next);
  emit();
  scheduleSave();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded);
}

// ---------------------------------------------------------------------------
// Lookups

let exCache: { custom: Exercise[]; map: Map<string, Exercise> } | undefined;

export function exerciseMap(s: AppState = state): Map<string, Exercise> {
  if (exCache && exCache.custom === s.customExercises) return exCache.map;
  const map = new Map<string, Exercise>();
  for (const e of EXERCISES) map.set(e.id, e);
  for (const e of s.customExercises) map.set(e.id, e);
  exCache = { custom: s.customExercises, map };
  return map;
}

export function getExercise(id: string, s: AppState = state): Exercise | undefined {
  return exerciseMap(s).get(id);
}

export function exerciseName(id: string, s: AppState = state): string {
  return getExercise(id, s)?.name ?? id;
}

export function allExercises(s: AppState = state): Exercise[] {
  return [...exerciseMap(s).values()];
}

export function allPrograms(s: AppState = state) {
  return [...BUILTIN_PROGRAMS, ...s.programs];
}

export function getProgram(id: string, s: AppState = state) {
  return allPrograms(s).find((p) => p.id === id);
}

/** Most recent bodyweight on or before date (or latest overall). */
export function bodyweightAt(s: AppState, dateIso?: string): number | undefined {
  const entries = [...s.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return undefined;
  if (!dateIso) return entries[entries.length - 1].weight;
  const d = dateIso.slice(0, 10);
  let w = entries[0].weight;
  for (const e of entries) if (e.date <= d) w = e.weight;
  return w;
}

export function exportJson(): string {
  return JSON.stringify(state, null, 2);
}
