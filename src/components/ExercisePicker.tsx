import { useMemo, useState } from 'react';
import type { Equipment, Exercise, ExerciseCategory, Muscle } from '../types';
import { CATEGORY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/exercises';
import { allExercises, update, useAppState } from '../lib/store';
import { uid } from '../lib/util';
import { Sheet } from './ui';

export function useExerciseSearch(query: string, category: ExerciseCategory | 'all') {
  const s = useAppState();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    return allExercises(s)
      .filter((e) => category === 'all' || e.category === category)
      .filter((e) => {
        if (!terms.length) return true;
        const hay = `${e.name} ${e.notes ?? ''} ${e.primary.map((m) => MUSCLE_LABELS[m]).join(' ')} ${EQUIPMENT_LABELS[e.equipment]}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .sort((a, b) => Number(!!b.standard) - Number(!!a.standard) || a.name.localeCompare(b.name));
  }, [s, query, category]);
}

export function ExerciseList({ onPick, picked }: { onPick: (e: Exercise) => void; picked?: Set<string> }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ExerciseCategory | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const list = useExerciseSearch(query, cat);

  return (
    <div>
      <input type="search" placeholder="Search 200+ exercises, muscles, equipment…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={false} />
      <div className="chips" style={{ margin: '8px 0' }}>
        <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          All
        </button>
        {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="list">
        {list.map((e) => (
          <button key={e.id} className="list-item" onClick={() => onPick(e)}>
            <div className="grow">
              <div className="bold">
                {e.name} {picked?.has(e.id) && <span className="chip on">added</span>}
              </div>
              <div className="small muted ellipsis">
                {CATEGORY_LABELS[e.category]} · {EQUIPMENT_LABELS[e.equipment]} · {e.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
            </div>
          </button>
        ))}
        {!list.length && <div className="empty">No exercise matches “{query}”.</div>}
      </div>
      {creating ? (
        <CustomExerciseForm
          initialName={query}
          onDone={(e) => {
            setCreating(false);
            if (e) onPick(e);
          }}
        />
      ) : (
        <button className="btn-block" style={{ marginTop: 10 }} onClick={() => setCreating(true)}>
          + Create custom exercise
        </button>
      )}
    </div>
  );
}

export function ExercisePicker({ onPick, onClose, title = 'Add exercise' }: { onPick: (e: Exercise) => void; onClose: () => void; title?: string }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <ExerciseList onPick={onPick} />
    </Sheet>
  );
}

function CustomExerciseForm({ initialName, onDone }: { initialName: string; onDone: (e?: Exercise) => void }) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ExerciseCategory>('legs');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [bwLoaded, setBwLoaded] = useState(false);
  const toggle = (m: Muscle) => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const save = () => {
    if (!name.trim()) return;
    const e: Exercise = { id: 'custom-' + uid(), name: name.trim(), category, equipment, primary, secondary: [], custom: true, bodyweightLoaded: bwLoaded || undefined };
    update((s) => ({ ...s, customExercises: [...s.customExercises, e] }));
    onDone(e);
  };
  return (
    <div className="card">
      <h3>New exercise</h3>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Equipment</span>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="small muted" style={{ margin: '6px 0' }}>
        Main muscles
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => (
          <button key={m} className={`chip ${primary.includes(m) ? 'on' : ''}`} onClick={() => toggle(m)}>
            {MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>
      <label className="row small" style={{ margin: '10px 0' }}>
        <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={bwLoaded} onChange={(e) => setBwLoaded(e.target.checked)} />
        Bodyweight exercise (log added weight)
      </label>
      <div className="row">
        <button className="grow" onClick={() => onDone()}>
          Cancel
        </button>
        <button className="btn-primary grow" onClick={save} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </div>
  );
}
