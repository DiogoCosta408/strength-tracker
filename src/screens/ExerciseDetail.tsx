import { useState } from 'react';
import { CATEGORY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/exercises';
import { fmtKg } from '../lib/calc';
import { bodyweightAt, getExercise, update, useAppState } from '../lib/store';
import { bestE1rm, exerciseHistory, repMaxes } from '../lib/stats';
import { fmtDate } from '../lib/util';
import { LineChart } from '../components/Charts';
import { ExerciseList } from '../components/ExercisePicker';
import { go, Help, NumInput, Segmented, Stat, TopBar } from '../components/ui';

type Metric = 'e1rm' | 'top' | 'volume';

export function ExerciseDetail({ id }: { id: string }) {
  const s = useAppState();
  const ex = getExercise(id, s);
  const [metric, setMetric] = useState<Metric>('e1rm');
  if (!ex) return <div className="empty">Exercise not found</div>;
  const hist = exerciseHistory(s, id);
  const bw = bodyweightAt(s) ?? 0;
  const adj = ex.bodyweightLoaded ? bw : 0;
  const best = bestE1rm(s, id);
  const recent = bestE1rm(s, id, 42);
  const rms = repMaxes(s, id);

  const points = hist.map((p) => ({
    x: new Date(p.date).getTime(),
    y: metric === 'e1rm' ? p.e1rm - adj : metric === 'top' ? p.topWeight : p.volume,
    label: `${fmtKg(p.topWeight)}×${p.topReps}${p.topRpe ? ` @${p.topRpe}` : ''} · ${p.sets} sets`,
  }));

  return (
    <div>
      <TopBar title={ex.name} backTo="/exercises" />
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip">{CATEGORY_LABELS[ex.category]}</span>
        <span className="chip">{EQUIPMENT_LABELS[ex.equipment]}</span>
        {ex.primary.map((m) => (
          <span key={m} className="chip on">
            {MUSCLE_LABELS[m]}
          </span>
        ))}
        {ex.secondary.map((m) => (
          <span key={m} className="chip">
            {MUSCLE_LABELS[m]}
          </span>
        ))}
      </div>
      {ex.notes && <p className="small muted" style={{ marginTop: 8 }}>{ex.notes}</p>}

      <div className="grid3" style={{ marginTop: 10 }}>
        <Stat label="Best e1RM" value={best ? fmtKg(best - adj) : '–'} sub={ex.bodyweightLoaded ? 'added kg' : 'kg'} />
        <Stat label="6-week e1RM" value={recent ? fmtKg(recent - adj) : '–'} sub={best && recent ? `${Math.round((recent / best) * 100)}% of best` : ''} />
        <Stat label="Sessions" value={hist.length} sub={hist.length ? `since ${fmtDate(hist[0].date, { month: 'short', year: '2-digit' })}` : ''} />
      </div>

      <div className="card">
        <Segmented value={metric} onChange={setMetric} options={[{ value: 'e1rm', label: 'e1RM' }, { value: 'top', label: 'Top set' }, { value: 'volume', label: 'Volume' }]} />
        <div style={{ marginTop: 8 }}>
          <LineChart points={points} unit={metric === 'volume' ? 'kg·reps' : 'kg'} />
        </div>
      </div>

      <div className="card">
        <div className="title-row" style={{ marginBottom: 6 }}>
          <h3>Known max</h3>
          <Help title="Known max">
            <p>A tested 1RM, e.g. from a meet. It's used for % prescriptions and strength standards when it's higher than your logged e1RM.</p>
          </Help>
        </div>
        <div style={{ width: 140 }}>
          <NumInput
            value={s.manualMaxes[id]}
            placeholder="kg"
            onChange={(v) =>
              update((st) => {
                const m = { ...st.manualMaxes };
                if (v) m[id] = v;
                else delete m[id];
                return { ...st, manualMaxes: m };
              })
            }
          />
        </div>
      </div>

      {rms.length > 0 && (
        <div className="card">
          <h3>Rep records</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Reps</th>
                <th>Best kg</th>
                <th>RPE</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rms.map((r) => (
                <tr key={r.reps}>
                  <td>{r.reps === 12 ? '12+' : r.reps}RM</td>
                  <td className="bold">{fmtKg(r.weight)}</td>
                  <td>{r.rpe ?? ''}</td>
                  <td>{fmtDate(r.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hist.length > 0 && (
        <>
          <h2>Sessions</h2>
          <div className="card tight">
            <div className="list">
              {[...hist].reverse().slice(0, 50).map((p) => (
                <button key={p.workoutId} className="list-item" onClick={() => go(`/history/${p.workoutId}`)}>
                  <span className="grow">{fmtDate(p.date)}</span>
                  <span className="small num">
                    {fmtKg(p.topWeight)}×{p.topReps}
                    {p.topRpe ? ` @${p.topRpe}` : ''} · {p.sets} sets
                  </span>
                  <span className="small muted num" style={{ width: 70, textAlign: 'right' }}>
                    e1 {fmtKg(p.e1rm - adj)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ExerciseLibrary() {
  return (
    <div>
      <TopBar title="Exercises" backTo="/more" />
      <ExerciseList onPick={(e) => go(`/exercise/${e.id}`)} />
    </div>
  );
}
