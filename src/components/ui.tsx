import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

// Hash router -----------------------------------------------------------------

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Current route as path segments, e.g. "#/exercise/squat" → ["exercise", "squat"]. */
export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function go(path: string) {
  window.location.hash = path.startsWith('/') ? path : '/' + path;
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}

// Toasts ----------------------------------------------------------------------

let toastMsg = '';
const toastListeners = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string) {
  toastMsg = msg;
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg = '';
    toastListeners.forEach((l) => l());
  }, 2600);
}

export function Toaster() {
  const msg = useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb);
      return () => toastListeners.delete(cb);
    },
    () => toastMsg,
  );
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

// Layout ----------------------------------------------------------------------

export function TopBar({ title, backTo, right }: { title: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <div className="topbar">
      {backTo !== undefined && (
        <button className="btn-ghost icon-btn" aria-label="Back" onClick={() => back(backTo)}>
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Sheet({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          {actions}
          <button className="btn-ghost icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numeric input that keeps the raw text while typing (so "82." or "" are allowed). */
export function NumInput({ value, onChange, step = 'any', placeholder, ariaLabel, min, blankZero }: { value: number | undefined; onChange: (v: number | undefined) => void; step?: string | number; placeholder?: string; ariaLabel?: string; min?: number; blankZero?: boolean }) {
  const show = (v: number | undefined) => (v === undefined || (blankZero && v === 0) ? '' : String(v));
  const [text, setText] = useState(show(value));
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'));
    const blank = value === undefined || (blankZero && value === 0);
    if (blank ? text.trim() !== '' && parsed !== value : parsed !== value) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal"
      type="text"
      step={step}
      min={min}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = parseFloat(t.replace(',', '.'));
        onChange(t.trim() === '' || isNaN(n) ? undefined : n);
      }}
    />
  );
}

// Icons -----------------------------------------------------------------------

const PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calc: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  back: 'M15 18l-6-6 6-6',
  close: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  more: 'M12 6h.01M12 12h.01M12 18h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-6',
  scale: 'M4 7h16l-2 13H6zM9 7a3 3 0 0 1 6 0',
  body: 'M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 8h12M12 8v7M9 22l3-7 3 7',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

// In-app dialogs ----------------------------------------------------------------
// Native confirm()/prompt() are unavailable in some embedded webviews and look out of
// place in an installed app, so we render our own.

interface DialogReq {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  input?: string; // present → text prompt
  resolve: (v: string | boolean | null) => void;
}
let dialog: DialogReq | null = null;
const dialogListeners = new Set<() => void>();
const setDialog = (d: DialogReq | null) => {
  dialog = d;
  dialogListeners.forEach((l) => l());
};

export function ask(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => setDialog({ message, confirmLabel: opts.confirmLabel ?? 'OK', danger: opts.danger, resolve: (v) => resolve(v === true) }));
}

export function askText(message: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => setDialog({ message, confirmLabel: 'Save', input: initial, resolve: (v) => resolve(typeof v === 'string' ? v : null) }));
}

export function DialogHost() {
  const d = useSyncExternalStore(
    (cb) => {
      dialogListeners.add(cb);
      return () => dialogListeners.delete(cb);
    },
    () => dialog,
  );
  const [text, setText] = useState('');
  useEffect(() => setText(d?.input ?? ''), [d]);
  if (!d) return null;
  const close = (v: string | boolean | null) => {
    setDialog(null);
    d.resolve(v);
  };
  return (
    <div className="sheet-backdrop" style={{ alignItems: 'center', zIndex: 70 }} onClick={() => close(null)}>
      <div className="card" role="alertdialog" aria-modal="true" style={{ width: 'min(420px, calc(100% - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: '0 0 12px' }}>{d.message}</p>
        {d.input !== undefined && <textarea id="dialog-input" autoFocus value={text} onChange={(e) => setText(e.target.value)} />}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="grow" onClick={() => close(d.input !== undefined ? null : false)}>
            Cancel
          </button>
          <button className={`grow ${d.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus={d.input === undefined} onClick={() => close(d.input !== undefined ? text : true)}>
            {d.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
