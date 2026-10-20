import { useMemo, useRef, useState } from 'react';

export interface Point {
  x: number; // timestamp ms
  y: number;
  label?: string; // tooltip line
}

const W = 340;
const H = 170;
const PAD = { l: 34, r: 10, t: 12, b: 22 };

/**
 * Gridline values covering [min, max]. The range is rounded *outwards*: the last tick is
 * never below max. Charts scale to the top tick, so a top tick under the data's own maximum
 * puts bars and lines above the plot area — and since .chart is overflow:visible, they then
 * draw over whatever sits above the chart (this is what covered the card headings).
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  const end = Math.ceil(max / step) * step;
  for (let v = Math.floor(min / step) * step; v <= end + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const fmtShortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Time-series line chart. `points` is the main series (dots + line unless `trend`
 * is given, in which case points are shown as faint dots and `trend` is the line).
 */
export function LineChart({ points, trend, unit = 'kg', height = H, color = 'var(--accent)' }: { points: Point[]; trend?: Point[]; unit?: string; height?: number; color?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const h = height;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const all = [...points, ...(trend ?? [])];
    let x0 = Math.min(...all.map((p) => p.x));
    let x1 = Math.max(...all.map((p) => p.x));
    if (x0 === x1) {
      x0 -= 86400000 * 3;
      x1 += 86400000 * 3;
    }
    const ys = all.map((p) => p.y);
    const pad = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 2;
    const ticks = niceTicks(Math.min(...ys) - pad, Math.max(...ys) + pad);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const sy = (y: number) => h - PAD.b - ((y - y0) / (y1 - y0 || 1)) * (h - PAD.t - PAD.b);
    return { sx, sy, ticks, x0, x1 };
  }, [points, trend, h]);

  if (!geo) return <div className="empty small">No data yet</div>;
  const { sx, sy, ticks, x0, x1 } = geo;
  const line = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const main = trend ?? points;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  const xTicks = [x0, x0 + (x1 - x0) / 2, x1];

  return (
    <div className="chart-wrap">
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${h}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Line chart">
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">
            {t}
          </text>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={sx(t)} y={h - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
            {fmtShortDate(t)}
          </text>
        ))}
        {trend &&
          points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={color} opacity={0.35} />)}
        <path d={line(main)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {!trend && points.length < 40 && points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />)}
        {hp && (
          <g>
            <line x1={sx(hp.x)} x2={sx(hp.x)} y1={PAD.t} y2={h - PAD.b} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={sx(hp.x)} cy={sy(hp.y)} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div className="tooltip" style={{ left: `${(sx(hp.x) / W) * 100}%`, top: `${(sy(hp.y) / h) * 100}%`, marginTop: -8 }}>
          <b>
            {Math.round(hp.y * 10) / 10} {unit}
          </b>{' '}
          · {fmtShortDate(hp.x)}
          {hp.label && <div>{hp.label}</div>}
        </div>
      )}
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  tip?: string;
}

export function BarChart({ bars, unit = '', height = 150 }: { bars: Bar[]; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const h = height;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = niceTicks(0, max, 3);
  const top = Math.max(ticks[ticks.length - 1], max); // belt and braces: never scale below the tallest bar
  const sy = (v: number) => h - PAD.b - (v / top) * (h - PAD.t - PAD.b);
  const bw = (W - PAD.l - PAD.r) / bars.length;
  const fmt = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
  const hb = hover !== null ? bars[hover] : null;
  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Bar chart" onPointerLeave={() => setHover(null)}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">
            {fmt(t)}
          </text>
        ))}
        {bars.map((b, i) => {
          const x = PAD.l + i * bw + 2;
          const y = sy(b.value);
          const bh = Math.max(0, h - PAD.b - y);
          const w = Math.max(2, bw - 4);
          const r = Math.min(4, w / 2, bh);
          return (
            <g key={b.key} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={h - PAD.t - PAD.b} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${h - PAD.b} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${h - PAD.b} Z`}
                  fill={hover === i ? 'var(--accent)' : 'var(--accent-dim)'}
                  opacity={hover === null || hover === i ? 1 : 0.5}
                />
              )}
              {i % Math.ceil(bars.length / 6) === 0 && (
                <text x={x + w / 2} y={h - 6} textAnchor="middle">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hb && hover !== null && (
        <div className="tooltip" style={{ left: `${((PAD.l + hover * bw + bw / 2) / W) * 100}%`, top: `${(sy(hb.value) / h) * 100}%`, marginTop: -6 }}>
          <b>
            {Math.round(hb.value).toLocaleString()} {unit}
          </b>{' '}
          · {hb.tip ?? hb.label}
        </div>
      )}
    </div>
  );
}

/** Tiny inline trend line for stat tiles. */
export function Sparkline({ values, width = 80, height = 24, color = 'var(--accent)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - ((v - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`)
    .join('');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
  points: Point[];
}

/**
 * Several time series on one shared axis, for comparing lifts at a glance. Hovering snaps a
 * crosshair to the nearest point of each series, since lifts are rarely logged on the same days.
 */
export function MultiLineChart({ series, unit = 'kg', height = H }: { series: Series[]; unit?: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const h = height;
  const shown = series.filter((s) => s.points.length);

  const geo = useMemo(() => {
    const all = shown.flatMap((s) => s.points);
    if (!all.length) return null;
    let x0 = Math.min(...all.map((p) => p.x));
    let x1 = Math.max(...all.map((p) => p.x));
    if (x0 === x1) {
      x0 -= 86400000 * 3;
      x1 += 86400000 * 3;
    }
    const ys = all.map((p) => p.y);
    const pad = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 2;
    const ticks = niceTicks(Math.min(...ys) - pad, Math.max(...ys) + pad);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    return {
      ticks,
      x0,
      x1,
      sx: (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r),
      sy: (y: number) => h - PAD.b - ((y - y0) / (y1 - y0 || 1)) * (h - PAD.t - PAD.b),
    };
  }, [shown, h]);

  if (!geo) return <div className="empty small">No data yet</div>;
  const { sx, sy, ticks, x0, x1 } = geo;
  const line = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    setHoverX(((e.clientX - r.left) / r.width) * W);
  };
  const nearest = (pts: Point[]) => pts.reduce((best, p) => (Math.abs(sx(p.x) - hoverX!) < Math.abs(sx(best.x) - hoverX!) ? p : best), pts[0]);
  const marks = hoverX === null ? [] : shown.map((s) => ({ s, p: nearest(s.points) }));
  const xTicks = [x0, x0 + (x1 - x0) / 2, x1];

  return (
    <div className="chart-wrap">
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${h}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHoverX(null)} role="img" aria-label="Line chart">
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">
            {t}
          </text>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={sx(t)} y={h - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
            {fmtShortDate(t)}
          </text>
        ))}
        {shown.map((s) => (
          <path key={s.key} d={line(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hoverX !== null && marks.length > 0 && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={h - PAD.b} stroke="var(--muted)" strokeDasharray="3 3" />
            {marks.map(({ s, p }) => (
              <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />
            ))}
          </g>
        )}
      </svg>
      {marks.length > 0 && (
        <div className="tooltip" style={{ left: `${(Math.min(Math.max(hoverX!, 70), W - 60) / W) * 100}%`, top: 0, marginTop: -4 }}>
          {marks.map(({ s, p }) => (
            <div key={s.key}>
              <span style={{ color: s.color }}>●</span> {s.label} <b>{Math.round(p.y * 10) / 10}</b> {unit}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
