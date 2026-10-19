import { useEffect, useMemo, useRef, useState } from 'react';
import { MUSCLE_LABELS } from '../data/exercises';
import { dots, fmtKg, wilks } from '../lib/calc';
import { bodyweightAt, getExercise, useAppState } from '../lib/store';
import { finishedWorkouts, isWorkSet, setE1rm } from '../lib/stats';
import { levelFor, scoreColor } from '../lib/strength';
import { fmtDate, todayISO } from '../lib/util';
import { BodyMap } from '../components/BodyMap';
import { TopBar, toast } from '../components/ui';
import { useStrengthProfile } from './Strength';

interface Best {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  rpe?: number;
  e1rm: number; // logged-weight terms
  date: string;
}

function useBests(): Best[] {
  const s = useAppState();
  return useMemo(() => {
    const map = new Map<string, Best>();
    for (const w of finishedWorkouts(s)) {
      const bw = w.bodyweight ?? bodyweightAt(s, w.startedAt);
      for (const le of w.exercises) {
        const ex = getExercise(le.exerciseId, s);
        for (const set of le.sets.filter(isWorkSet)) {
          const e1 = setE1rm(s, ex, set, bw) - (ex?.bodyweightLoaded ? bw ?? 0 : 0);
          const cur = map.get(le.exerciseId);
          if (!cur || e1 > cur.e1rm) map.set(le.exerciseId, { exerciseId: le.exerciseId, name: ex?.name ?? le.exerciseId, weight: set.weight, reps: set.reps, rpe: set.rpe, e1rm: e1, date: w.startedAt });
        }
      }
    }
    for (const [id, v] of Object.entries(s.manualMaxes)) {
      const cur = map.get(id);
      if (!cur || v > cur.e1rm) map.set(id, { exerciseId: id, name: getExercise(id, s)?.name ?? id, weight: v, reps: 1, e1rm: v, date: todayISO() });
    }
    return [...map.values()].sort((a, b) => b.e1rm - a.e1rm);
  }, [s]);
}

const DEFAULT_PICK = ['squat', 'bench-press', 'deadlift', 'press'];

export function Share() {
  const s = useAppState();
  const bests = useBests();
  const { muscles, avg, standings } = useStrengthProfile();
  const [picked, setPicked] = useState<string[]>(() => {
    const d = DEFAULT_PICK.filter((id) => bests.some((b) => b.exerciseId === id));
    return d.length ? d : bests.slice(0, 4).map((b) => b.exerciseId);
  });
  const [mode, setMode] = useState<'set' | 'e1rm'>('set');
  const [showBw, setShowBw] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [title, setTitle] = useState(s.profile.name ? `${s.profile.name}'s best lifts` : 'My best lifts');
  const [url, setUrl] = useState('');
  const svgHost = useRef<HTMLDivElement>(null);
  const bw = bodyweightAt(s);

  const chosen = picked.map((id) => bests.find((b) => b.exerciseId === id)).filter((x): x is Best => !!x);
  const sbd = ['squat', 'bench-press', 'deadlift'];
  // SBD total when all three are shared: actual singles count as-is, anything else uses e1RM.
  const sbdBests = sbd.map((id) => (picked.includes(id) ? bests.find((b) => b.exerciseId === id) : undefined));
  const hasTotal = sbdBests.every(Boolean);
  const totalIsActual = hasTotal && mode === 'set' && sbdBests.every((b) => b!.reps === 1);
  const total = hasTotal ? sbdBests.reduce((a, b) => a + (totalIsActual ? b!.weight : b!.e1rm), 0) : 0;

  useEffect(() => {
    let cancelled = false;
    renderCard({
      title,
      lifts: chosen,
      mode,
      bw: showBw ? bw : undefined,
      total: showTotal && total ? total : undefined,
      totalLabel: totalIsActual ? 'SBD TOTAL' : 'SBD TOTAL (e1RM)',
      dots: showTotal && total && bw ? dots(total, bw, s.profile.sex) : undefined,
      wilks: showTotal && total && bw ? wilks(total, bw, s.profile.sex) : undefined,
      level: standings.length ? levelFor(avg) : undefined,
      svg: showMap ? svgHost.current?.querySelector('svg') ?? null : null,
    }).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, picked.join(), mode, showBw, showMap, showTotal, bests, muscles]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const share = async () => {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], 'best-lifts.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title, text: shareText() });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'best-lifts.png';
    a.click();
    toast('Image downloaded');
  };

  const shareText = () =>
    [
      title,
      ...chosen.map((b) => `${b.name}: ${mode === 'set' ? `${fmtKg(b.weight)} kg × ${b.reps}${b.rpe ? ` @RPE ${b.rpe}` : ''}` : `${fmtKg(b.e1rm)} kg e1RM`}`),
      showBw && bw ? `Bodyweight: ${bw} kg` : '',
      showTotal && total ? `Total: ${fmtKg(total)} kg${bw ? ` · DOTS ${dots(total, bw, s.profile.sex).toFixed(1)}` : ''}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  return (
    <div>
      <TopBar title="Share best lifts" backTo="/" />
      {!bests.length && <div className="empty">Log some workouts first — your best sets will show up here.</div>}
      {bests.length > 0 && (
        <>
          <div className="card">
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="segmented" style={{ margin: '8px 0' }}>
              <button className={mode === 'set' ? 'on' : ''} onClick={() => setMode('set')}>
                Best set (kg × reps)
              </button>
              <button className={mode === 'e1rm' ? 'on' : ''} onClick={() => setMode('e1rm')}>
                Estimated 1RM
              </button>
            </div>
            <div className="row wrap small" style={{ gap: 14 }}>
              <label className="row">
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={showBw} onChange={(e) => setShowBw(e.target.checked)} /> Bodyweight
              </label>
              <label className="row">
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={showTotal} onChange={(e) => setShowTotal(e.target.checked)} /> Total & DOTS
              </label>
              <label className="row">
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={showMap} onChange={(e) => setShowMap(e.target.checked)} /> Muscle map
              </label>
            </div>
          </div>
          <h2>Choose lifts</h2>
          <div className="card tight">
            <div className="list">
              {bests.map((b) => (
                <label key={b.exerciseId} className="list-item" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={picked.includes(b.exerciseId)} onChange={() => toggle(b.exerciseId)} />
                  <span className="grow">{b.name}</span>
                  <span className="small num muted">
                    {fmtKg(b.weight)}×{b.reps} · e1 {fmtKg(b.e1rm)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <h2>Preview</h2>
          {url && <img src={url} alt="Share card preview" style={{ width: '100%', borderRadius: 14, border: '1px solid var(--border)' }} />}
          <div className="row" style={{ margin: '12px 0' }}>
            <button
              className="grow"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareText());
                  toast('Copied as text');
                } catch {
                  toast('Clipboard not available');
                }
              }}
            >
              Copy text
            </button>
            <button className="btn-primary grow" onClick={share} disabled={!url || !chosen.length}>
              Share image
            </button>
          </div>
        </>
      )}
      {/* Off-screen body map used as the image source for the card. */}
      <div ref={svgHost} style={{ position: 'absolute', left: -9999, width: 520 }} aria-hidden="true">
        <BodyMap colorFor={(m) => scoreColor(muscles[m])} labelFor={(m) => MUSCLE_LABELS[m]} />
      </div>
    </div>
  );
}

async function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('width', String(vb.width * 2));
  clone.setAttribute('height', String(vb.height * 2));
  // Hard-code the dark palette so the card looks the same in either theme.
  const css = `<style>*{--body-fill:#3a3f4b;--body-stroke:#15171c;--muscle-empty:#4a505c;}text{fill:#9aa0aa;font-family:system-ui,sans-serif}</style>`;
  const src = new XMLSerializer().serializeToString(clone).replace(/>/, '>' + css);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  await img.decode();
  return img;
}

async function renderCard(o: {
  title: string;
  lifts: Best[];
  mode: 'set' | 'e1rm';
  bw?: number;
  total?: number;
  totalLabel?: string;
  dots?: number;
  wilks?: number;
  level?: string;
  svg: SVGSVGElement | null;
}): Promise<string> {
  const W = 1080;
  const rowH = 118;
  const mapH = o.svg ? 560 : 0;
  const H = Math.max(1080, 260 + o.lifts.length * rowH + (o.total ? 170 : 0) + mapH + 90);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#16181e');
  grad.addColorStop(1, '#0b0c10');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffb020';
  g.fillRect(0, 0, W, 10);

  const font = (w: number, size: number) => `${w} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  g.fillStyle = '#ffffff';
  g.font = font(800, 64);
  g.fillText(o.title, 72, 140);
  g.fillStyle = '#9aa0aa';
  g.font = font(500, 30);
  const sub = [fmtDate(new Date().toISOString(), { day: 'numeric', month: 'long', year: 'numeric' }), o.bw ? `${o.bw} kg bodyweight` : '', o.level ? `${o.level} lifter` : ''].filter(Boolean).join('  ·  ');
  g.fillText(sub, 72, 192);

  let y = 260;
  for (const l of o.lifts) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(g, 56, y, W - 112, rowH - 18, 22);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = font(650, 38);
    g.fillText(truncate(g, l.name.replace(/\s*\((Competition|Conventional|Low Bar)[^)]*\)/, ''), 560), 92, y + 62);
    const main = o.mode === 'set' ? `${fmtKg(l.weight)} kg` : `${fmtKg(l.e1rm)} kg`;
    const detail = o.mode === 'set' ? `× ${l.reps}${l.rpe ? ` @ ${l.rpe}` : ''}` : 'e1RM';
    g.textAlign = 'right';
    g.fillStyle = '#9aa0aa';
    g.font = font(500, 28);
    g.fillText(detail, W - 92, y + 62);
    const dw = g.measureText(detail).width;
    g.fillStyle = '#ffb020';
    g.font = font(800, 46);
    g.fillText(main, W - 92 - dw - 18, y + 64);
    g.textAlign = 'left';
    y += rowH;
  }

  if (o.total) {
    y += 20;
    g.fillStyle = '#ffb020';
    roundRect(g, 56, y, W - 112, 130, 22);
    g.fill();
    g.fillStyle = '#1b1200';
    g.font = font(600, 30);
    g.fillText(o.totalLabel ?? 'SBD TOTAL', 92, y + 52);
    g.font = font(800, 56);
    g.fillText(`${fmtKg(o.total)} kg`, 92, y + 108);
    g.textAlign = 'right';
    g.font = font(650, 30);
    if (o.dots) g.fillText(`DOTS ${o.dots.toFixed(1)}`, W - 92, y + 58);
    if (o.wilks) g.fillText(`Wilks ${o.wilks.toFixed(1)}`, W - 92, y + 100);
    g.textAlign = 'left';
    y += 170;
  }

  if (o.svg) {
    try {
      const img = await svgToImage(o.svg);
      const h = mapH - 20;
      const w = (img.width / img.height) * h;
      g.drawImage(img, (W - w) / 2, y, w, h);
    } catch {
      /* skip map if the browser can't rasterize it */
    }
    y += mapH;
  }

  g.fillStyle = '#5c6270';
  g.font = font(500, 24);
  g.textAlign = 'center';
  g.fillText('Logged with Strength Tracker', W / 2, H - 40);
  return c.toDataURL('image/png');
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function truncate(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 3 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
