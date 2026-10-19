import { useState } from 'react';
import type { Sex } from '../types';
import { dots, e1rm, fmtKg, FORMULAS, ipfGl, loadForRpe, platesFor, roundTo, rpePercent, RPE_VALUES, wilks, wilks2 } from '../lib/calc';
import { bodyweightAt, getState, useAppState } from '../lib/store';
import { bestE1rm } from '../lib/stats';
import { NumInput, Segmented, TopBar } from '../components/ui';
import { useRoute } from '../components/ui';

type Tab = '1rm' | 'rpe' | 'points' | 'plates' | 'attempts';

export function Tools() {
  const route = useRoute();
  const [tab, setTab] = useState<Tab>((route[1] as Tab) || '1rm');
  return (
    <div>
      <TopBar title="Calculators" backTo="/more" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: '1rm', label: '1RM' },
          { value: 'rpe', label: 'RPE' },
          { value: 'points', label: 'Wilks' },
          { value: 'plates', label: 'Plates' },
          { value: 'attempts', label: 'Meet' },
        ]}
      />
      {tab === '1rm' && <OneRmCalc />}
      {tab === 'rpe' && <RpeCalc />}
      {tab === 'points' && <PointsCalc />}
      {tab === 'plates' && <PlateCalc />}
      {tab === 'attempts' && <AttemptCalc />}
    </div>
  );
}

function OneRmCalc() {
  const [w, setW] = useState<number | undefined>(100);
  const [r, setR] = useState<number | undefined>(5);
  const [rpe, setRpe] = useState<number | undefined>();
  const st = getState();
  const est = w && r ? e1rm(w, r, rpe, st.profile.e1rmFormula) : 0;
  return (
    <div>
      <div className="card">
        <div className="grid3">
          <label className="field">
            <span>Weight (kg)</span>
            <NumInput value={w} onChange={setW} />
          </label>
          <label className="field">
            <span>Reps</span>
            <NumInput value={r} onChange={(v) => setR(v && Math.round(v))} />
          </label>
          <label className="field">
            <span>RPE (optional)</span>
            <select value={rpe ?? ''} onChange={(e) => setRpe(e.target.value ? parseFloat(e.target.value) : undefined)}>
              <option value="">–</option>
              {RPE_VALUES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="center" style={{ marginTop: 8 }}>
          <div className="small muted">Estimated 1RM {rpe ? '(RPE chart)' : `(${st.profile.e1rmFormula})`}</div>
          <div style={{ fontSize: 40, fontWeight: 800 }} className="num">
            {fmtKg(est)} <span style={{ fontSize: 18 }}>kg</span>
          </div>
        </div>
      </div>
      {w && r ? (
        <div className="card">
          <h3>By formula</h3>
          <table className="tbl">
            <tbody>
              {FORMULAS.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{fmtKg(f.fn(w, r))} kg</td>
                </tr>
              ))}
              <tr>
                <td>RPE chart (@{rpe ?? 10})</td>
                <td>{fmtKg(w / rpePercent(r, rpe ?? 10))} kg</td>
              </tr>
            </tbody>
          </table>
          <p className="tiny muted">Formulas are most accurate under ~10 reps. With RPE, reps in reserve are accounted for.</p>
        </div>
      ) : null}
      {est > 0 && (
        <div className="card">
          <h3>Rep maxes from {fmtKg(est)} kg</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Reps</th>
                <th>% 1RM</th>
                <th>Load (RPE 10)</th>
                <th>Load @ RPE 8</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td>{Math.round(rpePercent(n, 10) * 1000) / 10}%</td>
                  <td>{fmtKg(roundTo(est * rpePercent(n, 10), st.profile.rounding))}</td>
                  <td>{fmtKg(roundTo(est * rpePercent(n, 8), st.profile.rounding))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RpeCalc() {
  const s = useAppState();
  const [lift, setLift] = useState('squat');
  const [e1, setE1] = useState<number | undefined>(() => Math.round(bestE1rm(getState(), 'squat', 42) || bestE1rm(getState(), 'squat')) || 150);
  const [reps, setReps] = useState<number | undefined>(5);
  const [rpe, setRpe] = useState(8);
  // Back-off from a top set
  const [topW, setTopW] = useState<number | undefined>(160);
  const [topR, setTopR] = useState<number | undefined>(3);
  const [topRpe, setTopRpe] = useState(8);
  const [boR, setBoR] = useState<number | undefined>(5);
  const [boRpe, setBoRpe] = useState(7);
  const topE1 = topW && topR ? e1rm(topW, topR, topRpe) : 0;
  const bo = topE1 && boR ? loadForRpe(topE1, boR, boRpe) : 0;
  const pickLift = (id: string) => {
    setLift(id);
    const b = bestE1rm(s, id, 42) || bestE1rm(s, id);
    if (b) setE1(Math.round(b * 10) / 10);
  };
  const rpeSelect = (v: number, set: (n: number) => void, label: string) => (
    <select aria-label={label} value={v} onChange={(e) => set(parseFloat(e.target.value))}>
      {RPE_VALUES.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
  return (
    <div>
      <div className="card">
        <h3>Load for reps @ RPE</h3>
        <label className="field">
          <span>Fill e1RM from your log</span>
          <select value={lift} onChange={(e) => pickLift(e.target.value)}>
            {[
              ['squat', 'Squat'],
              ['bench-press', 'Bench press'],
              ['deadlift', 'Deadlift'],
              ['press', 'Overhead press'],
              ['sumo-deadlift', 'Sumo deadlift'],
              ['front-squat', 'Front squat'],
            ].map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="grid3">
          <label className="field">
            <span>e1RM (kg)</span>
            <NumInput value={e1} onChange={setE1} />
          </label>
          <label className="field">
            <span>Reps</span>
            <NumInput value={reps} onChange={(v) => setReps(v && Math.round(v))} />
          </label>
          <label className="field">
            <span>RPE</span>
            {rpeSelect(rpe, setRpe, 'Target RPE')}
          </label>
        </div>
        {e1 && reps ? (
          <div className="center num" style={{ fontSize: 32, fontWeight: 800 }}>
            {fmtKg(roundTo(loadForRpe(e1, reps, rpe), s.profile.rounding))} kg
            <div className="small muted" style={{ fontWeight: 400 }}>
              {Math.round(rpePercent(reps, rpe) * 1000) / 10}% of e1RM · exact {fmtKg(loadForRpe(e1, reps, rpe))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Back-off from today's top set</h3>
        <p className="small muted">Uses today's performance (not your all-time max) to set back-off loads — the core of RPE autoregulation.</p>
        <div className="grid3">
          <label className="field">
            <span>Top set kg</span>
            <NumInput value={topW} onChange={setTopW} />
          </label>
          <label className="field">
            <span>Reps</span>
            <NumInput value={topR} onChange={(v) => setTopR(v && Math.round(v))} />
          </label>
          <label className="field">
            <span>RPE</span>
            {rpeSelect(topRpe, setTopRpe, 'Top set RPE')}
          </label>
          <label className="field">
            <span>Back-off reps</span>
            <NumInput value={boR} onChange={(v) => setBoR(v && Math.round(v))} />
          </label>
          <label className="field">
            <span>@ RPE</span>
            {rpeSelect(boRpe, setBoRpe, 'Back-off RPE')}
          </label>
          <div className="stat">
            <div className="label">Back-off load</div>
            <div className="value" style={{ fontSize: 18 }}>
              {fmtKg(roundTo(bo, s.profile.rounding))}
            </div>
          </div>
        </div>
        {topE1 > 0 && <p className="small muted num">Today's e1RM: {fmtKg(topE1)} kg · {topW ? Math.round((bo / topW) * 1000) / 10 : 0}% of top set</p>}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>RPE chart (% of 1RM)</h3>
        <table className="tbl rpe-chart">
          <thead>
            <tr>
              <th>RPE</th>
              {Array.from({ length: 10 }, (_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...RPE_VALUES].reverse().map((r) => (
              <tr key={r}>
                <td className="bold">{r}</td>
                {Array.from({ length: 10 }, (_, i) => (
                  <td key={i} className={reps === i + 1 && rpe === r ? 'hl' : ''}>
                    {(rpePercent(i + 1, r) * 100).toFixed(1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted">RPE 10 = max effort, 9 = 1 rep left, 8 = 2 reps left, 7 = 3 reps left. Half points = maybe one more.</p>
      </div>
    </div>
  );
}

function PointsCalc() {
  const s = useAppState();
  const [sex, setSex] = useState<Sex>(s.profile.sex);
  const [bw, setBw] = useState<number | undefined>(bodyweightAt(s) ?? 83);
  const [sq, setSq] = useState<number | undefined>(200);
  const [bp, setBp] = useState<number | undefined>(130);
  const [dl, setDl] = useState<number | undefined>(240);
  const [equipped, setEquipped] = useState(false);
  const total = (sq ?? 0) + (bp ?? 0) + (dl ?? 0);
  const fill = () => {
    setSq(Math.round(bestE1rm(s, 'squat') * 2) / 2 || sq);
    setBp(Math.round(bestE1rm(s, 'bench-press') * 2) / 2 || bp);
    setDl(Math.round(Math.max(bestE1rm(s, 'deadlift'), bestE1rm(s, 'sumo-deadlift')) * 2) / 2 || dl);
    const b = bodyweightAt(s);
    if (b) setBw(b);
  };
  const rows =
    bw && total
      ? [
          { name: 'IPF GL points', v: ipfGl(total, bw, sex, equipped ? 'equipped-sbd' : 'classic-sbd'), note: 'Official IPF formula since 2020' },
          { name: 'DOTS', v: dots(total, bw, sex), note: 'Used by USAPL and many federations' },
          { name: 'Wilks (original)', v: wilks(total, bw, sex), note: 'Classic 1995 formula' },
          { name: 'Wilks 2020', v: wilks2(total, bw, sex), note: 'Updated Wilks coefficients' },
        ]
      : [];
  return (
    <div>
      <div className="card">
        <div className="row between">
          <Segmented value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          <button className="btn-sm" onClick={fill}>
            Use my bests
          </button>
        </div>
        <div className="grid2">
          <label className="field">
            <span>Bodyweight (kg)</span>
            <NumInput value={bw} onChange={setBw} />
          </label>
          <label className="field">
            <span>Squat</span>
            <NumInput value={sq} onChange={setSq} />
          </label>
          <label className="field">
            <span>Bench</span>
            <NumInput value={bp} onChange={setBp} />
          </label>
          <label className="field">
            <span>Deadlift</span>
            <NumInput value={dl} onChange={setDl} />
          </label>
        </div>
        <label className="row small">
          <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={equipped} onChange={(e) => setEquipped(e.target.checked)} /> Equipped (IPF GL)
        </label>
        <div className="center num" style={{ marginTop: 8 }}>
          <div className="small muted">Total</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{fmtKg(total)} kg</div>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="card">
          <table className="tbl">
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>
                    <div className="bold">{r.name}</div>
                    <div className="tiny muted">{r.note}</div>
                  </td>
                  <td style={{ fontSize: 20, fontWeight: 700 }}>{r.v.toFixed(2)}</td>
                </tr>
              ))}
              {bp ? (
                <tr>
                  <td>
                    <div className="bold">IPF GL (bench only)</div>
                    <div className="tiny muted">For bench-only competitions</div>
                  </td>
                  <td style={{ fontSize: 20, fontWeight: 700 }}>{ipfGl(bp, bw!, sex, equipped ? 'equipped-bench' : 'classic-bench').toFixed(2)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PLATE_COLORS: Record<string, string> = { '25': '#d93a3a', '20': '#2f6fd6', '15': '#e0b316', '10': '#2f9e57', '5': '#e8e8e8', '2.5': '#222', '1.25': '#9aa0aa', '0.5': '#9aa0aa', '0.25': '#9aa0aa' };

export function PlateDiagram({ plates }: { plates: number[] }) {
  return (
    <div className="row" style={{ gap: 3, justifyContent: 'center', alignItems: 'center', margin: '12px 0', minHeight: 110 }}>
      <div style={{ width: 40, height: 10, background: 'var(--muted)', borderRadius: 2 }} />
      <div style={{ width: 8, height: 34, background: 'var(--muted)', borderRadius: 2 }} />
      {plates.map((p, i) => {
        const h = p >= 15 ? 110 : p >= 10 ? 90 : p >= 5 ? 66 : p >= 2.5 ? 50 : 36;
        const bg = PLATE_COLORS[String(p)] ?? '#888';
        return (
          <div key={i} className="plate" style={{ height: h, background: bg, color: p === 5 ? '#111' : '#fff', width: p >= 10 ? 26 : 18, writingMode: 'vertical-rl' }}>
            {p}
          </div>
        );
      })}
      <div style={{ width: 30, height: 10, background: 'var(--muted)', borderRadius: 2 }} />
    </div>
  );
}

function PlateCalc() {
  const s = useAppState();
  const [target, setTarget] = useState<number | undefined>(140);
  const [bar, setBar] = useState<number | undefined>(s.profile.barWeight);
  const [collars, setCollars] = useState(false);
  const eff = (target ?? 0) - (collars ? 5 : 0);
  const res = platesFor(eff, bar ?? 20, s.profile.plates);
  return (
    <div className="card">
      <div className="grid2">
        <label className="field">
          <span>Target (kg)</span>
          <NumInput value={target} onChange={setTarget} />
        </label>
        <label className="field">
          <span>Bar (kg)</span>
          <NumInput value={bar} onChange={setBar} />
        </label>
      </div>
      <label className="row small">
        <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={collars} onChange={(e) => setCollars(e.target.checked)} /> Competition collars (2.5 kg each)
      </label>
      <PlateDiagram plates={res.perSide} />
      <div className="center num">
        <div className="bold">Per side: {res.perSide.length ? res.perSide.join(' + ') : 'empty bar'}</div>
        {res.remainder > 0 && <div className="bad small">Can't load the last {res.remainder} kg with your plates</div>}
      </div>
      <div className="row wrap" style={{ marginTop: 10, gap: 6, justifyContent: 'center' }}>
        {[-10, -5, -2.5, 2.5, 5, 10].map((d) => (
          <button key={d} className="btn-sm" onClick={() => setTarget((t) => Math.max(0, (t ?? 0) + d))}>
            {d > 0 ? '+' : ''}
            {d}
          </button>
        ))}
      </div>
      <p className="tiny muted center">Edit available plates in Settings.</p>
    </div>
  );
}

function AttemptCalc() {
  const s = useAppState();
  const init = (id: string) => Math.round(bestE1rm(s, id)) || undefined;
  const [maxes, setMaxes] = useState<Record<string, number | undefined>>({ Squat: init('squat') ?? 200, Bench: init('bench-press') ?? 130, Deadlift: init('deadlift') ?? 240 });
  const [style, setStyle] = useState<'conservative' | 'standard' | 'aggressive'>('standard');
  const pcts = { conservative: [0.88, 0.94, 0.99], standard: [0.91, 0.96, 1.0], aggressive: [0.93, 0.98, 1.02] }[style];
  const att = (m: number) => pcts.map((p) => roundTo(m * p, 2.5));
  const totals = [0, 1, 2].map((i) => Object.values(maxes).reduce<number>((a, m) => a + (m ? att(m)[i] : 0), 0));
  return (
    <div>
      <div className="card">
        <p className="small muted">Enter projected meet-day maxes (prefilled from your best e1RMs). Openers should be a weight you can triple on a bad day.</p>
        <Segmented value={style} onChange={setStyle} options={[{ value: 'conservative', label: 'Conservative' }, { value: 'standard', label: 'Standard' }, { value: 'aggressive', label: 'Aggressive' }]} />
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Lift</th>
              <th>Max</th>
              <th>1st</th>
              <th>2nd</th>
              <th>3rd</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(maxes).map(([k, m]) => (
              <tr key={k}>
                <td>{k}</td>
                <td style={{ width: 76 }}>
                  <NumInput value={m} onChange={(v) => setMaxes((x) => ({ ...x, [k]: v }))} />
                </td>
                {m ? att(m).map((a, i) => <td key={i} className={i === 0 ? 'hl' : ''}>{a}</td>) : <td colSpan={3} />}
              </tr>
            ))}
            <tr>
              <td className="bold">Total</td>
              <td />
              {totals.map((t, i) => (
                <td key={i} className="bold">
                  {t}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="tiny muted">Attempts use {pcts.map((p) => Math.round(p * 100) + '%').join(' / ')} of max, rounded to 2.5 kg.</p>
      </div>
    </div>
  );
}
