import type { KeyboardEvent } from 'react';
import type { Muscle } from '../types';

export interface BodyMapProps {
  colorFor: (m: Muscle) => string;
  selected?: Muscle | null;
  onSelect?: (m: Muscle) => void;
  labelFor?: (m: Muscle) => string;
}

/*
 * Each figure is drawn in a 200 x 440 box centred on x = 100.
 * Only the viewer's LEFT half (x <= 100) is described; the right half is the
 * same path mirrored with `translate(200,0) scale(-1,1)`.
 */
const FIG_W = 200;
const MIRROR = `translate(${FIG_W},0) scale(-1,1)`;

type Part = readonly [Muscle, readonly string[]];

/* ---------- neutral silhouette (half) ---------- */
const SILHOUETTE: readonly string[] = [
  // neck (starts above the head's lower edge so the two never gap apart)
  'M100,40 L90,40 C91,52 90,62 86,68 L100,70 Z',
  // torso + hip
  'M100,64 C90,65 80,68 66,71 C52,73 42,80 40,96 C40,108 42,118 46,124 C56,124 62,128 64,134 C64,160 64,180 64,198 C61,212 60,226 61,240 L100,248 Z',
  // upper arm + forearm
  'M66,74 C50,74 40,86 40,104 C39,124 39,146 42,164 C36,182 32,204 33,230 L46,232 C50,212 56,192 60,170 C61,150 60,128 58,110 Z',
  // hand
  'M33,228 C29,236 28,248 31,258 C33,265 38,267 42,264 C46,256 48,244 46,230 Z',
  // thigh + knee + shin
  'M62,206 C57,236 57,280 64,316 C66,326 66,334 64,344 C60,362 66,388 74,406 L92,406 C92,388 97,364 96,346 C95,334 93,322 94,312 C97,292 99,268 99,246 Z',
  // foot
  'M75,402 C72,410 70,418 72,424 C78,428 88,428 94,426 C95,418 94,410 92,402 Z',
];

/* ---------- FRONT view muscles (half) ---------- */
const FRONT: readonly Part[] = [
  ['traps', ['M91,52 C90,60 86,66 68,72 C78,74 90,74 99,73 L99,66 C96,63 93,58 91,52 Z']],
  ['sideDelts', ['M64,72 C50,72 41,82 40,98 C40,108 42,116 45,121 C46,106 48,94 53,85 C56,79 60,75 64,72 Z']],
  ['frontDelts', ['M66,73 C59,75 54,80 52,88 C49,97 48,108 47,120 C52,112 58,104 64,98 C67,92 69,86 70,79 C69,76 68,74 66,73 Z']],
  ['chest', ['M99,76 C90,74 80,75 71,79 C69,88 66,97 60,106 C64,116 74,123 86,124 C92,124 96,122 99,120 Z']],
  ['biceps', ['M58,104 C61,118 61,138 58,154 C56,162 52,166 48,164 C44,150 43,134 45,122 C48,114 53,108 58,104 Z']],
  ['forearms', ['M46,166 C40,180 35,202 34,228 L46,230 C49,212 54,194 58,176 C59,168 56,160 52,162 C50,164 48,165 46,166 Z']],
  ['obliques', ['M66,124 C64,146 64,172 66,196 C71,204 76,208 82,210 C80,186 79,156 82,128 C78,128 72,126 66,124 Z']],
  ['abs', ['M99,124 L84,127 C81,150 80,180 83,208 C88,216 94,222 99,224 Z']],
  ['quads', ['M63,210 C58,238 58,276 65,308 C69,318 76,324 84,323 C89,318 90,310 90,300 C88,280 86,262 89,246 C82,232 74,220 63,210 Z']],
  ['adductors', ['M89,246 C86,264 88,284 90,300 C94,284 97,266 99,250 C96,248 92,247 89,246 Z']],
  // Two gastroc heads either side of the shin bone, tapering into the Achilles — kept well
  // inside the shin outline so they read as muscle, not as the whole lower leg.
  ['calves', [
    'M70,331 C66,341 64,353 65,365 C66,376 70,384 74,390 L78,390 L78,331 Z',
    'M88,331 C92,341 94,353 93,365 C92,376 88,384 84,390 L80,390 L80,331 Z',
  ]],
];

/* six-pack separation lines (half, decorative) */
const ABS_LINES: readonly string[] = [
  'M83,146 Q91,149 99,146',
  'M82,168 Q91,171 99,168',
  'M82,190 Q91,193 99,190',
];

/* ---------- BACK view muscles (half) ---------- */
const BACK: readonly Part[] = [
  ['traps', [
    'M91,50 C89,60 82,67 66,72 C76,78 88,84 99,96 L99,52 Z',
    'M99,128 C96,134 94,142 95,150 C96,158 98,164 99,168 Z',
  ]],
  ['sideDelts', ['M64,72 C50,72 41,82 40,98 C40,108 42,116 45,121 C46,106 48,94 53,85 C56,79 60,75 64,72 Z']],
  ['rearDelts', ['M66,73 C59,75 54,80 52,88 C49,97 48,108 47,120 C53,112 60,106 68,102 C70,94 70,86 68,78 C68,76 67,74 66,73 Z']],
  ['upperBack', [
    'M99,96 C90,88 80,82 68,78 C70,86 70,96 68,102 C72,114 78,124 86,132 C91,136 95,132 99,128 Z',
  ]],
  ['lats', ['M58,106 C58,130 61,160 68,192 C74,200 82,204 89,204 C88,186 88,168 90,152 C88,142 87,136 86,132 C78,124 72,114 68,102 C64,104 60,105 58,106 Z']],
  ['lowerBack', ['M99,168 C96,160 93,154 90,152 C88,170 88,190 90,206 C93,212 96,214 99,214 Z']],
  ['triceps', ['M47,122 C43,136 43,152 47,164 C51,166 55,164 58,158 C61,142 60,124 58,106 C53,110 50,115 47,122 Z']],
  ['forearms', ['M46,166 C40,180 35,202 34,228 L46,230 C49,212 54,194 58,176 C59,168 56,160 52,162 C50,164 48,165 46,166 Z']],
  ['glutes', ['M99,214 C90,210 76,208 65,210 C60,224 60,240 65,252 C76,262 90,262 99,256 Z']],
  ['hamstrings', ['M65,254 C61,276 62,300 68,324 C74,330 80,330 86,326 C88,306 89,284 92,262 C82,262 72,260 65,254 Z']],
  ['adductors', ['M92,262 C90,282 88,304 87,322 C92,304 96,284 98,262 C96,262 94,262 92,262 Z']],
  ['calves', [
    'M79,330 C71,334 65,345 65,359 C65,372 71,383 77,391 L79,391 Z',
    'M81,330 C89,334 95,345 95,359 C95,372 89,383 83,391 L81,391 Z',
  ]],
];

const VIEW_PARTS: Record<'front' | 'back', readonly Part[]> = { front: FRONT, back: BACK };

const DEFAULT_LABEL = (m: Muscle): string =>
  m.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function Figure({
  view,
  x,
  props,
}: {
  view: 'front' | 'back';
  x: number;
  props: BodyMapProps;
}) {
  const { colorFor, selected, onSelect, labelFor } = props;
  const label = labelFor ?? DEFAULT_LABEL;
  const stroke = 'var(--body-stroke, #1d2027)';
  const bodyFill = 'var(--body-fill, #3a3f4b)';

  return (
    <g transform={`translate(${x},0)`}>
      {/* silhouette */}
      <g fill={bodyFill} stroke={stroke} strokeWidth={1} strokeLinejoin="round">
        {SILHOUETTE.map((d, i) => (
          <g key={i}>
            <path d={d} />
            <path d={d} transform={MIRROR} />
          </g>
        ))}
        {/* ears */}
        <ellipse cx={85} cy={27} rx={3} ry={5.5} />
        <ellipse cx={115} cy={27} rx={3} ry={5.5} />
        {/* head — sized so a neck is visible between it and the traps */}
        <ellipse cx={100} cy={25} rx={16} ry={19} />
        {view === 'back' ? (
          <path d="M86,18 C87,7 113,7 114,18 C110,13 90,13 86,18 Z" fill={stroke} opacity={0.35} stroke="none" />
        ) : null}
        {/* knees */}
        <g fill="none" opacity={0.6}>
          <path d="M74,330 Q82,338 90,330" />
          <path d="M126,330 Q118,338 110,330" />
        </g>
      </g>

      {/* muscles */}
      {/* selected muscle is painted last so its accent outline is never covered */}
      {[...VIEW_PARTS[view]]
        .sort((a, b) => Number(a[0] === selected) - Number(b[0] === selected))
        .map(([m, paths]) => {
        const isSel = selected === m;
        const name = label(m);
        const activate = () => onSelect?.(m);
        return (
          <g
            key={m}
            className="bm-muscle"
            role="button"
            tabIndex={0}
            aria-label={name}
            aria-pressed={isSel}
            fill={colorFor(m)}
            stroke={isSel ? 'var(--accent, #ffb020)' : stroke}
            strokeWidth={isSel ? 2.5 : 0.9}
            strokeLinejoin="round"
            style={{ cursor: 'pointer' }}
            onClick={activate}
            onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
              }
            }}
          >
            <title>{name}</title>
            {paths.map((d, i) => (
              <g key={i}>
                <path d={d} />
                <path d={d} transform={MIRROR} />
              </g>
            ))}
            {m === 'abs' ? (
              <g fill="none" stroke={stroke} strokeWidth={0.8} opacity={0.7} pointerEvents="none">
                {ABS_LINES.map((d, i) => (
                  <g key={i}>
                    <path d={d} />
                    <path d={d} transform={MIRROR} />
                  </g>
                ))}
              </g>
            ) : null}
          </g>
        );
      })}

      <text
        x={100}
        y={452}
        textAnchor="middle"
        fontSize={13}
        fill="currentColor"
        opacity={0.7}
        style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {view === 'front' ? 'Front' : 'Back'}
      </text>
    </g>
  );
}

export function BodyMap(props: BodyMapProps): JSX.Element {
  return (
    <svg
      width="100%"
      viewBox="0 0 430 462"
      role="group"
      aria-label="Muscle map"
      style={{ display: 'block', maxWidth: 520, margin: '0 auto' }}
    >
      <style>{`
        .bm-muscle path { transition: filter .15s; }
        .bm-muscle:hover path { filter: brightness(1.15); }
        .bm-muscle:focus { outline: none; }
        .bm-muscle:focus-visible path { stroke: var(--accent, #ffb020); stroke-width: 2; }
      `}</style>
      <Figure view="front" x={5} props={props} />
      <Figure view="back" x={225} props={props} />
    </svg>
  );
}

export default BodyMap;
