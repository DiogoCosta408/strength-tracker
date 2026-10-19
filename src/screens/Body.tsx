import { useMemo, useState } from 'react';
import { fmtKg } from '../lib/calc';
import { update, useAppState } from '../lib/store';
import { fmtDate, todayISO, uid } from '../lib/util';
import { LineChart, type Point } from '../components/Charts';
import { Icon, NumInput, Segmented, Stat, TopBar, toast } from '../components/ui';

type Range = '30' | '90' | '365' | 'all';

/** Trailing 7-day mean per entry, for a trend line that ignores daily water swings. */
export function movingAverage(entries: { date: string; weight: number }[], days = 7): Point[] {
  return entries.map((e) => {
    const t = new Date(e.date + 'T12:00:00').getTime();
    const win = entries.filter((x) => {
      const tx = new Date(x.date + 'T12:00:00').getTime();
      return tx <= t && tx > t - days * 86400000;
    });
    return { x: t, y: win.reduce((a, x) => a + x.weight, 0) / win.length };
  });
}

export function Body() {
  const s = useAppState();
  const [date, setDate] = useState(todayISO());
  const [w, setW] = useState<number | undefined>(() => [...s.bodyweight].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight);
  const [range, setRange] = useState<Range>('90');
  const [kcal, setKcal] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const sorted = useMemo(() => [...s.bodyweight].sort((a, b) => a.date.localeCompare(b.date)), [s.bodyweight]);
  const since = range === 'all' ? '' : new Date(Date.now() - parseInt(range) * 86400000).toISOString().slice(0, 10);
  const shown = sorted.filter((e) => e.date >= since);
  const avg = movingAverage(sorted).filter((p) => p.x >= (since ? new Date(since).getTime() : 0));

  const latest = sorted[sorted.length - 1];
  const weekAgo = avg.length ? avg[avg.length - 1].y : undefined;
  const monthStart = movingAverage(sorted).find((p) => p.x >= Date.now() - 30 * 86400000);
  const change30 = weekAgo !== undefined && monthStart ? weekAgo - monthStart.y : undefined;

  const save = () => {
    if (!w && !kcal) return;
    update((st) => ({
      ...st,
      bodyweight: w ? [...st.bodyweight.filter((b) => b.date !== date), { id: uid(), date, weight: w }] : st.bodyweight,
      nutrition: kcal ? [...st.nutrition.filter((n) => n.date !== date), { id: uid(), date, kcal, protein }] : st.nutrition,
    }));
    setKcal(undefined);
    setProtein(undefined);
    toast('Saved');
  };
  const intake = new Map(s.nutrition.map((n) => [n.date, n]));

  return (
    <div>
      <TopBar title="Bodyweight" backTo="/more" />
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow">
            <span>Date</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field" style={{ width: 100 }}>
            <span>kg</span>
            <NumInput value={w} onChange={setW} />
          </label>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow">
            <span>Calories eaten (optional)</span>
            <NumInput value={kcal} placeholder="kcal" onChange={(v) => setKcal(v ? Math.round(v) : undefined)} />
          </label>
          <label className="field grow">
            <span>Protein (g)</span>
            <NumInput value={protein} placeholder="g" onChange={(v) => setProtein(v ? Math.round(v) : undefined)} />
          </label>
          <button className="btn-primary" style={{ marginBottom: 8 }} onClick={save} disabled={!w && !kcal}>
            Save
          </button>
        </div>
      </div>
      <div className="grid3">
        <Stat label="Latest" value={latest ? fmtKg(latest.weight) : '–'} sub={latest ? fmtDate(latest.date, { day: 'numeric', month: 'short' }) : ''} />
        <Stat label="7-day avg" value={weekAgo ? fmtKg(weekAgo) : '–'} />
        <Stat label="30-day Δ" value={change30 !== undefined ? `${change30 > 0 ? '+' : ''}${fmtKg(change30)}` : '–'} sub="trend" />
      </div>
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Trend</h3>
          <div style={{ width: 210 }}>
            <Segmented value={range} onChange={setRange} options={[{ value: '30', label: '1M' }, { value: '90', label: '3M' }, { value: '365', label: '1Y' }, { value: 'all', label: 'All' }]} />
          </div>
        </div>
        <LineChart points={shown.map((e) => ({ x: new Date(e.date + 'T12:00:00').getTime(), y: e.weight }))} trend={shown.length > 2 ? avg : undefined} />
        {shown.length > 2 && <div className="tiny muted">Dots: daily weigh-ins · Line: 7-day average</div>}
      </div>
      <h2>Entries</h2>
      <div className="card tight">
        <div className="list">
          {[...sorted].reverse().slice(0, 60).map((e) => (
            <div key={e.id} className="list-item" style={{ minHeight: 40 }}>
              <span className="grow">{fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {intake.get(e.date) && <span className="small muted num">{intake.get(e.date)!.kcal} kcal</span>}
              <span className="bold num">{fmtKg(e.weight)} kg</span>
              <button className="btn-ghost icon-btn" aria-label="Delete entry" onClick={() => update((st) => ({ ...st, bodyweight: st.bodyweight.filter((b) => b.id !== e.id) }))}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          {!sorted.length && <div className="empty">No entries yet</div>}
        </div>
      </div>
    </div>
  );
}
