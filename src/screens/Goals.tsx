import { useMemo, useState } from 'react';
import type { Goals, Profile } from '../types';
import { fmtKg } from '../lib/calc';
import { bodyweightAt, exerciseName, update, useAppState } from '../lib/store';
import { bestE1rm } from '../lib/stats';
import { goalReport, targetForLevel, type Feasibility, type LiftGoalStatus } from '../lib/goals';
import { LEVELS } from '../lib/strength';
import { fmtDate, nowISO, todayISO } from '../lib/util';
import { ask, go, Help, NumInput, Segmented, Sheet, toast } from '../components/ui';

const GOAL_LIFTS = ['squat', 'bench-press', 'deadlift', 'press'];
const FEAS_LABEL: Record<Feasibility, string> = { achieved: 'Achieved', 'on-track': 'On track', ambitious: 'Ambitious', unrealistic: 'Not realistic', 'no-data': 'Needs data' };
const FEAS_CLASS: Record<Feasibility, string> = { achieved: 'good', 'on-track': 'good', ambitious: 'warn', unrealistic: 'bad', 'no-data': 'muted' };

const addWeeks = (w: number) => new Date(Date.now() + w * 7 * 86400000).toISOString().slice(0, 10);
const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`;

export function GoalsPanel({ onAsk }: { onAsk: (text: string) => void }) {
  const s = useAppState();
  const [editing, setEditing] = useState(false);
  const report = useMemo(() => goalReport(s), [s]);

  if (!s.goals || !report)
    return (
      <div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Set a goal</h3>
          <p className="small muted">Target lifts, bodyweight and a date. The coach checks feasibility and sets your calories.</p>
          <button className="btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>
            Set my goal
          </button>
        </div>
        {editing && <GoalEditor onClose={() => setEditing(false)} />}
      </div>
    );

  const g = s.goals;
  const setTarget = (exerciseId: string, target: number) => update((st) => ({ ...st, goals: st.goals && { ...st.goals, lifts: st.goals.lifts.map((l) => (l.exerciseId === exerciseId ? { ...l, target } : l)) }, goalsUpdatedAt: nowISO() }));
  const setDate = (d: string) => update((st) => ({ ...st, goals: st.goals && { ...st.goals, targetDate: d }, goalsUpdatedAt: nowISO() }));

  return (
    <div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row between">
          <div>
            <div className="small muted title-row">
              Target date
              <Help title="How goals are checked">
                <p>Each goal is projected week by week. Typical progress slows as you get stronger: ~1%/week for novices, ~0.45% intermediate, ~0.2% advanced, much less in a calorie deficit. Your own trend from the last 12 weeks is blended in.</p>
                <p>On track: the projection reaches the target in time. Ambitious: needs up to ~1.6× the typical rate. Not realistic: more than that. You can apply the suggested target or date with one tap.</p>
                <p>Calories come from an estimate (height, age, activity) until you've logged ~10 days of intake. Then your real maintenance is used and the plan adapts as your weight trend changes.</p>
              </Help>
            </div>
            <div className="bold" style={{ fontSize: 18 }}>
              {fmtDate(g.targetDate)} <span className="small muted">· {Math.max(0, Math.round(report.weeksLeft))} weeks left</span>
            </div>
          </div>
          <span className={`status ${FEAS_CLASS[report.overall]}`}>{FEAS_LABEL[report.overall]}</span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn-sm grow" onClick={() => setEditing(true)}>
            Edit goal
          </button>
          <button
            className="btn-sm grow"
            onClick={() =>
              onAsk('Review my goals: are they realistic by my target date, what should I change in training and nutrition, and should we adapt any target? Ask me what you need to know about my diet adherence, sleep and schedule.')
            }
          >
            Review with AI coach
          </button>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="card insight warn">
          <h3>Warnings</h3>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {report.lifts.map((l) => (
        <LiftGoalCard key={l.exerciseId} l={l} onSetTarget={(t) => setTarget(l.exerciseId, t)} onSetDate={setDate} />
      ))}

      {report.bodyweight && (
        <div className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>Bodyweight</h3>
            <span className={`status ${FEAS_CLASS[report.bodyweight.feasibility]}`}>{FEAS_LABEL[report.bodyweight.feasibility]}</span>
          </div>
          <Progress start={report.bodyweight.start ?? report.bodyweight.current} current={report.bodyweight.current} target={report.bodyweight.target} unit="kg" />
          <div className="small muted">
            Needs {pct(report.bodyweight.requiredPct)}/wk{report.bodyweight.observedPct !== undefined && <> · trend {pct(report.bodyweight.observedPct)}/wk</>}
          </div>
          {(report.bodyweight.adjustedTarget || report.bodyweight.adjustedDate) && (
            <div className="row wrap" style={{ marginTop: 8 }}>
              {report.bodyweight.adjustedTarget && (
                <button className="btn-sm" onClick={() => update((st) => ({ ...st, goals: st.goals && { ...st.goals, bodyweight: report.bodyweight!.adjustedTarget }, goalsUpdatedAt: nowISO() }))}>
                  Set target to {report.bodyweight.adjustedTarget} kg
                </button>
              )}
              {report.bodyweight.adjustedDate && (
                <button className="btn-sm" onClick={() => setDate(report.bodyweight!.adjustedDate!)}>
                  Move date to {fmtDate(report.bodyweight.adjustedDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {report.macros ? (
        <div className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>Daily nutrition</h3>
            <span className="small muted">{report.macros.maintenanceSource === 'logged' ? 'from your logs' : 'estimate'}</span>
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800 }} className="num">
              {report.macros.calories.toLocaleString()}
            </span>
            <span className="muted">kcal / day</span>
          </div>
          <div className="small muted">
            Maintenance {report.macros.maintenance.toLocaleString()} · {report.macros.calories >= report.macros.maintenance ? '+' : ''}
            {report.macros.calories - report.macros.maintenance}
          </div>
          <div className="grid3" style={{ marginTop: 10 }}>
            <Macro label="Protein" g={report.macros.protein} logged={report.macros.loggedProtein} />
            <Macro label="Carbs" g={report.macros.carbs} />
            <Macro label="Fat" g={report.macros.fat} />
          </div>
          {report.macros.loggedKcal !== undefined && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Logged avg ({report.macros.loggedDays} d): {Math.round(report.macros.loggedKcal).toLocaleString()} kcal
              {report.macros.loggedProtein ? <> · {Math.round(report.macros.loggedProtein)} g protein</> : null}
            </p>
          )}
          {report.macros.adjustment && (
            <p className="small" style={{ marginTop: 6 }}>
              <b>
                Adjust {report.macros.adjustment.kcal > 0 ? '+' : ''}
                {report.macros.adjustment.kcal} kcal/day
              </b>{' '}
              <span className="muted">({report.macros.adjustment.reason.replace(/^Weight is changing /, 'weight ')})</span>
            </p>
          )}
          <button className="btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => go('/body')}>
            Log weight & intake
          </button>
        </div>
      ) : (
        <div className="card small muted">Log your bodyweight to get a calorie and macro plan.</div>
      )}
      {editing && <GoalEditor onClose={() => setEditing(false)} />}
    </div>
  );
}

function Macro({ label, g, logged }: { label: string; g: number; logged?: number }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 20 }}>
        {g} g
      </div>
      {logged !== undefined && <div className={`sub ${logged < g * 0.8 ? 'bad' : ''}`}>logged {Math.round(logged)} g</div>}
    </div>
  );
}

function Progress({ start, current, target, unit }: { start: number; current: number; target: number; unit: string }) {
  const span = target - start;
  const frac = span ? Math.max(0, Math.min(1, (current - start) / span)) : current >= target ? 1 : 0;
  return (
    <div style={{ margin: '8px 0' }}>
      <div className="row between small num">
        <span className="muted">
          {fmtKg(start)} {unit}
        </span>
        <span className="bold">
          {fmtKg(current)} → {fmtKg(target)} {unit}
        </span>
      </div>
      <div className="level-bar" style={{ marginTop: 4 }}>
        <div style={{ width: `${frac * 100}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

function LiftGoalCard({ l, onSetTarget, onSetDate }: { l: LiftGoalStatus; onSetTarget: (t: number) => void; onSetDate: (d: string) => void }) {
  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{l.name.replace(/\s*\(.*\)/, '')}</h3>
        <span className={`status ${FEAS_CLASS[l.feasibility]}`}>{FEAS_LABEL[l.feasibility]}</span>
      </div>
      <Progress start={l.start} current={l.current} target={l.target} unit="kg" />
      {l.feasibility === 'no-data' ? (
        <p className="small muted">Log this lift to track it.</p>
      ) : l.feasibility !== 'achieved' ? (
        <div className="small muted">
          Needs {Number.isFinite(l.requiredPct) ? pct(l.requiredPct) : '—'}/wk · realistic {pct(l.realisticPct)}/wk · projected <b className="num" style={{ color: 'var(--text)' }}>{fmtKg(l.projectedAtDate)} kg</b>
        </div>
      ) : (
        <p className="small good">Target reached 🎉</p>
      )}
      {(l.adjustedTarget || (l.projectedDate && l.feasibility !== 'on-track' && l.feasibility !== 'achieved')) && (
        <div className="row wrap" style={{ marginTop: 8 }}>
          {l.adjustedTarget && (
            <button className="btn-sm" onClick={() => (onSetTarget(l.adjustedTarget!), toast('Target updated'))}>
              Set target to {fmtKg(l.adjustedTarget)} kg
            </button>
          )}
          {l.projectedDate && l.feasibility !== 'on-track' && (
            <button className="btn-sm" onClick={() => (onSetDate(l.projectedDate!), toast('Goal date moved'))}>
              Move date to {fmtDate(l.projectedDate, { day: 'numeric', month: 'short', year: 'numeric' })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GoalEditor({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const g = s.goals;
  const bwNow = bodyweightAt(s);
  const [date, setDate] = useState(g?.targetDate ?? addWeeks(16));
  const [bw, setBw] = useState<number | undefined>(g?.bodyweight);
  const [targets, setTargets] = useState<Record<string, number | undefined>>(() => Object.fromEntries(GOAL_LIFTS.map((id) => [id, g?.lifts.find((l) => l.exerciseId === id)?.target])));
  const [height, setHeight] = useState<number | undefined>(s.profile.heightCm);
  const [activity, setActivity] = useState<NonNullable<Profile['activity']>>(s.profile.activity ?? 'moderate');
  const refBw = bw ?? bwNow;

  const save = () => {
    const lifts = GOAL_LIFTS.filter((id) => targets[id]).map((id) => ({ exerciseId: id, target: targets[id]! }));
    if (!lifts.length && !bw) return toast('Set at least one target');
    const next: Goals = {
      targetDate: date,
      lifts,
      bodyweight: bw,
      createdAt: g?.createdAt ?? new Date().toISOString(),
      // Keep the original starting point when editing an existing goal.
      start: g?.start ?? { lifts: Object.fromEntries(GOAL_LIFTS.map((id) => [id, bestE1rm(s, id, 42) || bestE1rm(s, id)])), bodyweight: bwNow },
    };
    update((st) => ({ ...st, goals: next, goalsUpdatedAt: nowISO(), profile: { ...st.profile, heightCm: height, activity, updatedAt: nowISO() } }));
    toast('Goal saved');
    onClose();
  };

  return (
    <Sheet title={g ? 'Edit goal' : 'New goal'} onClose={onClose}>
      <label className="field">
        <span>Target date</span>
        <input id="goal-date" type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="chips">
        {[8, 12, 16, 24, 52].map((w) => (
          <button key={w} className={`chip ${date === addWeeks(w) ? 'on' : ''}`} onClick={() => setDate(addWeeks(w))}>
            {w < 52 ? `${w} weeks` : '1 year'}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 14 }}>Bodyweight</h3>
      <div className="row">
        <label className="field grow">
          <span>Target bodyweight (kg, optional){bwNow ? ` · now ${bwNow}` : ''}</span>
          <NumInput value={bw} onChange={setBw} />
        </label>
      </div>

      <h3 style={{ marginTop: 10 }}>Lift targets (e1RM, kg)</h3>
      <p className="tiny muted">Type a number or tap a level{refBw ? ` (at ${refBw} kg)` : ''}.</p>
      {GOAL_LIFTS.map((id) => {
        const cur = bestE1rm(s, id, 42) || bestE1rm(s, id);
        return (
          <div key={id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <div className="row">
              <div className="grow">
                <div className="bold small">{exerciseName(id, s).replace(/\s*\(.*\)/, '')}</div>
                <div className="tiny muted">now {cur ? `${fmtKg(cur)} kg` : 'not logged'}</div>
              </div>
              <div style={{ width: 100 }}>
                <NumInput ariaLabel={`${exerciseName(id, s)} target`} placeholder="kg" value={targets[id]} onChange={(v) => setTargets((t) => ({ ...t, [id]: v }))} />
              </div>
            </div>
            {refBw && (
              <div className="chips" style={{ marginTop: 6 }}>
                {[2, 3, 4, 5].map((lvl) => {
                  const t = targetForLevel(id, lvl, refBw, s);
                  return t && t > cur ? (
                    <button key={lvl} className={`chip ${targets[id] === t ? 'on' : ''}`} onClick={() => setTargets((x) => ({ ...x, [id]: t }))}>
                      {LEVELS[lvl].name} {t}
                    </button>
                  ) : null;
                })}
              </div>
            )}
          </div>
        );
      })}

      <h3 style={{ marginTop: 10 }}>For your calorie estimate</h3>
      <div className="grid2">
        <label className="field">
          <span>Height (cm)</span>
          <NumInput value={height} onChange={(v) => setHeight(v ? Math.round(v) : undefined)} />
        </label>
        <label className="field">
          <span>Birth year</span>
          <NumInput value={s.profile.birthYear} onChange={(v) => update((st) => ({ ...st, profile: { ...st.profile, birthYear: v ? Math.round(v) : undefined, updatedAt: nowISO() } }))} />
        </label>
      </div>
      <label className="field">
        <span>Daily activity outside the gym</span>
        <Segmented value={activity} onChange={setActivity} options={[{ value: 'low', label: 'Desk job' }, { value: 'moderate', label: 'On my feet' }, { value: 'high', label: 'Physical job' }]} />
      </label>

      <div className="row" style={{ marginTop: 12 }}>
        {g && (
          <button
            className="btn-danger grow"
            onClick={async () => {
              if (await ask('Delete this goal?', { confirmLabel: 'Delete', danger: true })) {
                update((st) => ({ ...st, goals: undefined, goalsUpdatedAt: nowISO() }));
                onClose();
              }
            }}
          >
            Delete
          </button>
        )}
        <button className="btn-primary grow" onClick={save}>
          Save goal
        </button>
      </div>
    </Sheet>
  );
}
