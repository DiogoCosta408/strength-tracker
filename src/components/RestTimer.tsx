import { useEffect, useState, useSyncExternalStore } from 'react';

let endAt = 0;
let total = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startRest(seconds: number) {
  if (!seconds) return;
  total = seconds;
  endAt = Date.now() + seconds * 1000;
  emit();
}

function adjust(delta: number) {
  endAt = Math.max(Date.now(), endAt + delta * 1000);
  total = Math.max(0, total + delta);
  emit();
}

function stop() {
  endAt = 0;
  emit();
}

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* audio not available */
  }
}

export function RestTimer() {
  const end = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => endAt,
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [end]);
  useEffect(() => {
    if (!end) return;
    const ms = end - Date.now();
    const t = setTimeout(() => {
      navigator.vibrate?.([200, 100, 200]);
      beep();
    }, Math.max(0, ms));
    const hide = setTimeout(stop, Math.max(0, ms) + 6000);
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
    };
  }, [end]);
  if (!end) return null;
  const left = Math.ceil((end - now) / 1000);
  const over = left <= 0;
  const m = Math.floor(Math.abs(left) / 60);
  const s = Math.abs(left) % 60;
  return (
    <div className="timer-bar">
      <div className="inner" role="timer" aria-live="off">
        <span className="bold" style={{ minWidth: 70 }}>
          {over ? 'Go! ' : 'Rest '}
          {m}:{String(s).padStart(2, '0')}
        </span>
        <span className="tiny" style={{ opacity: 0.7 }}>
          / {Math.floor(total / 60)}:{String(total % 60).padStart(2, '0')}
        </span>
        <button onClick={() => adjust(-30)}>−30</button>
        <button onClick={() => adjust(30)}>+30</button>
        <button onClick={stop}>Skip</button>
      </div>
    </div>
  );
}
