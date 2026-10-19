import { useRef, useState } from 'react';
import type { Exercise, ExercisePrescription, Program, ProgramDay, SetKind, SetPrescription } from '../types';
import { flattenDays } from '../data/programs';
import { allPrograms, exerciseName, getProgram, getState, update, useAppState } from '../lib/store';
import { suggestLoad } from '../lib/stats';
import { duplicateProgram, startWorkout } from '../lib/workout';
import { clone, nowISO, uid } from '../lib/util';
import { fmtKg } from '../lib/calc';
import { ExercisePicker } from '../components/ExercisePicker';
import { ask, go, Icon, NumInput, TopBar, toast } from '../components/ui';
import { targetText } from './WorkoutLogger';
import { summarizeSets } from './Train';

interface ProgramFile {
  format: 'strength-tracker-program';
  version: 1;
  program: Program;
  customExercises?: Exercise[];
}

/** Adds a program (and the custom exercises it needs) from an exported program file. */
async function importProgramFile(file: File): Promise<Program | undefined> {
  let data: ProgramFile;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('That file is not a program file');
    return;
  }
  const p = data?.program;
  if (data?.format !== 'strength-tracker-program' || !p?.name || !Array.isArray(p.weeks)) {
    toast('That file is not a program file');
    return;
  }
  const existing = getState().programs.find((x) => x.id === p.id);
  if (existing && !(await ask(`Replace your existing “${existing.name}”?`, { confirmLabel: 'Replace' }))) return;
  const program: Program = { ...p, id: p.id || 'user-' + uid(), builtIn: false, updatedAt: nowISO() };
  update((st) => {
    const known = new Set(st.customExercises.map((e) => e.id));
    const newEx = (data.customExercises ?? []).filter((e) => !known.has(e.id)).map((e) => ({ ...e, custom: true, updatedAt: nowISO() }));
    return { ...st, customExercises: [...st.customExercises, ...newEx], programs: [...st.programs.filter((x) => x.id !== program.id), program] };
  });
  toast(`Imported ${program.name}`);
  return program;
}

function exportProgram(p: Program) {
  const st = getState();
  const ids = new Set(p.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
  const file: ProgramFile = { format: 'strength-tracker-program', version: 1, program: p, customExercises: st.customExercises.filter((e) => ids.has(e.id)) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
  a.download = `${p.name.replace(/[^\w-]+/g, '-').toLowerCase()}.program.json`;
  a.click();
}

export function ProgramList() {
  const s = useAppState();
  const programs = allPrograms(s);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = () => {
    const p: Program = { id: 'user-' + uid(), name: 'My program', description: '', weeks: [{ name: 'Week 1', days: [{ id: uid(), name: 'Day 1', exercises: [] }] }], updatedAt: nowISO() };
    update((st) => ({ ...st, programs: [...st.programs, p] }));
    go(`/program-edit/${p.id}`);
  };
  const Section = ({ title, list }: { title: string; list: Program[] }) =>
    list.length ? (
      <>
        <h2>{title}</h2>
        {list.map((p) => (
          <button key={p.id} className="card list-item" style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 14, margin: '8px 0' }} onClick={() => go(`/program/${p.id}`)}>
            <div className="row between">
              <span className="bold">{p.name}</span>
              {s.activeProgram?.programId === p.id && <span className="chip on">Active</span>}
            </div>
            <div className="small muted">
              {[p.author, p.level, `${flattenDays(p).length} sessions / cycle`].filter(Boolean).join(' · ')}
            </div>
          </button>
        ))}
      </>
    ) : null;
  return (
    <div>
      <TopBar
        title="Programs"
        right={
          <>
            <button className="btn-sm" onClick={() => fileRef.current?.click()}>
              Import
            </button>
            <button className="btn-primary btn-sm" onClick={create}>
              <Icon name="plus" size={16} /> New
            </button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          const p = f && (await importProgramFile(f));
          if (p) go(`/program/${p.id}`);
        }}
      />
      <Section title="My programs" list={programs.filter((p) => !p.builtIn)} />
      <Section title="Templates" list={programs.filter((p) => p.builtIn)} />
    </div>
  );
}

export function ProgramDetail({ id }: { id: string }) {
  const s = useAppState();
  const p = getProgram(id, s);
  const [week, setWeek] = useState(0);
  if (!p) return <div className="empty">Program not found</div>;
  const active = s.activeProgram?.programId === p.id;
  const w = p.weeks[Math.min(week, p.weeks.length - 1)];

  const startDay = (d: ProgramDay) => {
    if (s.activeWorkout) return toast('Finish your current workout first');
    startWorkout({ program: p, day: d });
    go('/workout');
  };

  return (
    <div>
      <TopBar
        title={p.name}
        backTo="/programs"
        right={
          !p.builtIn ? (
            <>
              <button className="btn-sm" onClick={() => exportProgram(p)}>
                Export
              </button>
              <button className="btn-sm" onClick={() => go(`/program-edit/${p.id}`)}>
                <Icon name="edit" size={16} /> Edit
              </button>
            </>
          ) : undefined
        }
      />
      <p className="small" style={{ color: 'var(--text-2)' }}>
        {p.description}
      </p>
      <div className="row" style={{ margin: '10px 0' }}>
        <button
          className={`grow ${active ? '' : 'btn-primary'}`}
          onClick={() =>
            update((st) => ({ ...st, activeProgram: active ? undefined : { programId: p.id, nextIndex: 0 }, activeProgramUpdatedAt: nowISO() }))
          }
        >
          {active ? 'Stop following' : 'Follow this program'}
        </button>
        <button
          className="grow"
          onClick={() => {
            const c = { ...duplicateProgram(p), updatedAt: nowISO() };
            update((st) => ({ ...st, programs: [...st.programs, c] }));
            go(`/program-edit/${c.id}`);
          }}
        >
          <Icon name="copy" size={16} /> Copy & customize
        </button>
      </div>
      {p.weeks.length > 1 && (
        <div className="chips">
          {p.weeks.map((wk, i) => (
            <button key={i} className={`chip ${i === week ? 'on' : ''}`} onClick={() => setWeek(i)}>
              {wk.name}
            </button>
          ))}
        </div>
      )}
      {w.days.map((d) => (
        <div className="card" key={d.id}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{d.name}</h3>
            <button className="btn-sm" onClick={() => startDay(d)}>
              Start
            </button>
          </div>
          {d.exercises.map((e, i) => (
            <div key={i} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row between">
                <span className="bold">{exerciseName(e.exerciseId, s)}</span>
                <span className="muted num">{previewLoad(e)}</span>
              </div>
              <div className="muted num">{summarizeSets(e.sets.map(kindText))}</div>
              {e.notes && <div className="tiny muted">{e.notes}</div>}
            </div>
          ))}
          {!d.exercises.length && <div className="small muted">No exercises</div>}
        </div>
      ))}
    </div>
  );
}

function kindText(sp: SetPrescription): string {
  const t = targetText(sp);
  return sp.kind === 'top' ? `top ${t}` : sp.kind === 'backoff' ? `back-off ${t}` : sp.kind === 'warmup' ? `warm-up ${t}` : t;
}

/** Shows today's suggested load for the first loaded set, so templates feel concrete. */
function previewLoad(e: ExercisePrescription): string {
  const sp = e.sets.find((x) => x.kind !== 'warmup' && x.percentOfTop === undefined);
  if (!sp) return '';
  const v = suggestLoad(getState(), e.exerciseId, sp);
  return v !== undefined ? `≈ ${fmtKg(v)} kg` : '';
}

// Editor ----------------------------------------------------------------------

type LoadMode = 'none' | 'rpe' | 'percent' | 'weight' | 'percentOfTop' | 'lpIncrement';
const MODE_LABEL: Record<LoadMode, string> = { none: 'No load rule', rpe: '@ RPE', percent: '% of e1RM', weight: 'Fixed kg', percentOfTop: '% of top set', lpIncrement: 'Linear +kg' };

function modeOf(sp: SetPrescription): LoadMode {
  if (sp.rpe !== undefined) return 'rpe';
  if (sp.percent !== undefined) return 'percent';
  if (sp.weight !== undefined) return 'weight';
  if (sp.percentOfTop !== undefined) return 'percentOfTop';
  if (sp.lpIncrement !== undefined) return 'lpIncrement';
  return 'none';
}

function withMode(sp: SetPrescription, mode: LoadMode, value?: number): SetPrescription {
  const base: SetPrescription = { kind: sp.kind, reps: sp.reps };
  if (mode === 'none') return base;
  const defaults: Record<Exclude<LoadMode, 'none'>, number> = { rpe: 8, percent: 75, weight: 60, percentOfTop: 90, lpIncrement: 2.5 };
  return { ...base, [mode]: value ?? defaults[mode] };
}

export function ProgramEditor({ id }: { id: string }) {
  const s = useAppState();
  const p = s.programs.find((x) => x.id === id);
  const [week, setWeek] = useState(0);
  const [picker, setPicker] = useState<string | null>(null); // day id
  if (!p) return <div className="empty">Program not found (built-in templates must be copied before editing).</div>;
  const wi = Math.min(week, p.weeks.length - 1);

  const save = (fn: (p: Program) => void) =>
    update((st) => ({
      ...st,
      programs: st.programs.map((x) => {
        if (x.id !== id) return x;
        const c = clone(x);
        fn(c);
        c.updatedAt = nowISO();
        return c;
      }),
    }));

  const updateEx = (dayId: string, idx: number, fn: (e: ExercisePrescription) => void) =>
    save((c) => {
      const d = c.weeks[wi].days.find((x) => x.id === dayId)!;
      fn(d.exercises[idx]);
    });

  return (
    <div>
      <TopBar
        title="Edit program"
        backTo={`/program/${id}`}
        right={
          <button className="btn-primary btn-sm" onClick={() => go(`/program/${id}`)}>
            Done
          </button>
        }
      />
      <label className="field">
        <span>Name</span>
        <input value={p.name} onChange={(e) => save((c) => (c.name = e.target.value))} />
      </label>
      <label className="field">
        <span>Description / notes</span>
        <textarea value={p.description} onChange={(e) => save((c) => (c.description = e.target.value))} />
      </label>

      <div className="row" style={{ marginTop: 10 }}>
        <div className="chips grow">
          {p.weeks.map((w, i) => (
            <button key={i} className={`chip ${i === wi ? 'on' : ''}`} onClick={() => setWeek(i)}>
              {w.name}
            </button>
          ))}
        </div>
        <button
          className="btn-sm"
          onClick={() => {
            save((c) => {
              const copy = clone(c.weeks[wi]);
              copy.name = `Week ${c.weeks.length + 1}`;
              copy.days.forEach((d) => (d.id = uid()));
              c.weeks.push(copy);
            });
            setWeek(p.weeks.length);
          }}
        >
          + Week
        </button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <input className="grow" aria-label="Week name" value={p.weeks[wi].name} onChange={(e) => save((c) => (c.weeks[wi].name = e.target.value))} />
        <button
          className="btn-sm btn-danger"
          disabled={p.weeks.length < 2}
          onClick={() => {
            save((c) => c.weeks.splice(wi, 1));
            setWeek(Math.max(0, wi - 1));
          }}
        >
          Delete week
        </button>
      </div>

      {p.weeks[wi].days.map((d, di) => (
        <div className="card" key={d.id}>
          <div className="row">
            <input className="grow bold" aria-label="Day name" value={d.name} onChange={(e) => save((c) => (c.weeks[wi].days[di].name = e.target.value))} />
            <button className="btn-ghost icon-btn btn-danger" aria-label="Delete day" onClick={async () => (await ask(`Delete ${d.name}?`, { confirmLabel: 'Delete', danger: true })) && save((c) => c.weeks[wi].days.splice(di, 1))}>
              <Icon name="trash" size={18} />
            </button>
          </div>
          {d.exercises.map((e, ei) => (
            <div key={ei} style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8 }}>
              <div className="row">
                <span className="bold grow">{exerciseName(e.exerciseId, s)}</span>
                <button className="btn-ghost icon-btn" aria-label="Move up" disabled={ei === 0} onClick={() => save((c) => swap(c.weeks[wi].days[di].exercises, ei, ei - 1))}>
                  <Icon name="up" size={18} />
                </button>
                <button className="btn-ghost icon-btn" aria-label="Remove exercise" onClick={() => save((c) => c.weeks[wi].days[di].exercises.splice(ei, 1))}>
                  <Icon name="close" size={18} />
                </button>
              </div>
              {e.sets.map((sp, si) => {
                const mode = modeOf(sp);
                return (
                  <div key={si} className="row" style={{ gap: 4, marginTop: 4 }}>
                    <select style={{ width: 82, padding: '6px 2px' }} aria-label="Set type" value={sp.kind} onChange={(ev) => updateEx(d.id, ei, (x) => (x.sets[si].kind = ev.target.value as SetKind))}>
                      <option value="work">Work</option>
                      <option value="top">Top</option>
                      <option value="backoff">Back-off</option>
                      <option value="amrap">AMRAP</option>
                      <option value="warmup">Warm-up</option>
                    </select>
                    <div style={{ width: 48 }}>
                      <NumInput ariaLabel="Reps" value={sp.reps} onChange={(v) => updateEx(d.id, ei, (x) => (x.sets[si].reps = Math.max(1, Math.round(v ?? 1))))} />
                    </div>
                    <select className="grow" style={{ padding: '6px 2px', minWidth: 0 }} aria-label="Load rule" value={mode} onChange={(ev) => updateEx(d.id, ei, (x) => (x.sets[si] = withMode(x.sets[si], ev.target.value as LoadMode)))}>
                      {(Object.keys(MODE_LABEL) as LoadMode[]).map((m) => (
                        <option key={m} value={m}>
                          {MODE_LABEL[m]}
                        </option>
                      ))}
                    </select>
                    {mode !== 'none' && (
                      <div style={{ width: 58 }}>
                        <NumInput ariaLabel="Load value" value={sp[mode]} onChange={(v) => v !== undefined && updateEx(d.id, ei, (x) => (x.sets[si] = withMode(x.sets[si], mode, v)))} />
                      </div>
                    )}
                    <button className="btn-ghost icon-btn" aria-label="Remove set" onClick={() => updateEx(d.id, ei, (x) => x.sets.splice(si, 1))}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                );
              })}
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn-sm" onClick={() => updateEx(d.id, ei, (x) => x.sets.push({ ...(x.sets[x.sets.length - 1] ?? { kind: 'work', reps: 5, rpe: 8 }) }))}>
                  + Set
                </button>
                <span className="small muted">Rest</span>
                <div style={{ width: 64 }}>
                  <NumInput ariaLabel="Rest seconds" value={e.rest} placeholder="s" onChange={(v) => updateEx(d.id, ei, (x) => (x.rest = v))} />
                </div>
                <input className="grow" placeholder="Notes" value={e.notes ?? ''} onChange={(ev) => updateEx(d.id, ei, (x) => (x.notes = ev.target.value || undefined))} />
              </div>
            </div>
          ))}
          <button className="btn-block btn-sm" style={{ marginTop: 10 }} onClick={() => setPicker(d.id)}>
            + Add exercise
          </button>
        </div>
      ))}
      <button className="btn-block" onClick={() => save((c) => c.weeks[wi].days.push({ id: uid(), name: `Day ${c.weeks[wi].days.length + 1}`, exercises: [] }))}>
        + Add day
      </button>
      <button
        className="btn-block btn-danger"
        style={{ marginTop: 20 }}
        onClick={async () => {
          if (!(await ask('Delete this program?', { confirmLabel: 'Delete', danger: true }))) return;
          update((st) => ({
            ...st,
            programs: st.programs.filter((x) => x.id !== id),
            tombstones: [...(st.tombstones ?? []), { collection: 'programs', id, deletedAt: nowISO() }],
            activeProgram: st.activeProgram?.programId === id ? undefined : st.activeProgram,
            activeProgramUpdatedAt: st.activeProgram?.programId === id ? nowISO() : st.activeProgramUpdatedAt,
          }));
          go('/programs');
        }}
      >
        Delete program
      </button>

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(null)}
          onPick={(ex) => {
            save((c) => c.weeks[wi].days.find((x) => x.id === picker)!.exercises.push({ exerciseId: ex.id, sets: [{ kind: 'work', reps: 5, rpe: 8 }, { kind: 'work', reps: 5, rpe: 8 }, { kind: 'work', reps: 5, rpe: 8 }], rest: 180 }));
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number) {
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
