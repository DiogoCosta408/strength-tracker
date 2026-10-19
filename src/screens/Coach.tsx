import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CoachMessage, Program } from '../types';
import { adviseFromAnswers, describeAnswers, FAMILY_LABEL, FAMILY_MAIN, QUESTIONS, RECOVERY_QUESTIONS, type LiftFamily, type Question, type Rx } from '../data/coachKnowledge';
import { flattenDays } from '../data/programs';
import { analyzeAll, buildInsights, type Insight, type Trend } from '../lib/coach';
import { askCoach, getApiKey, setApiKey } from '../lib/coachAi';
import { fmtKg } from '../lib/calc';
import { exerciseName, getProgram, getState, update, useAppState } from '../lib/store';
import { duplicateProgram } from '../lib/workout';
import { uid } from '../lib/util';
import { ask, go, Help, Segmented, Sheet, TopBar, toast, useRoute } from '../components/ui';
import { GoalsPanel } from './Goals';

type Tab = 'goals' | 'insights' | 'diagnose' | 'chat';
const FAMILIES: LiftFamily[] = ['squat', 'bench', 'deadlift', 'press'];
const RECOVERY_KEY = '_recovery';

const TREND_LABEL: Record<Trend, string> = { progressing: 'Progressing', stalled: 'Stalled', regressing: 'Regressing', insufficient: 'Not enough data' };
const TREND_CLASS: Record<Trend, string> = { progressing: 'good', stalled: 'warn', regressing: 'bad', insufficient: 'muted' };

export function Coach() {
  const route = useRoute();
  const [tab, setTab] = useState<Tab>((route[1] as Tab) || 'insights');
  const [family, setFamily] = useState<LiftFamily>('squat');
  const [draft, setDraft] = useState('');

  const openChat = (text: string) => {
    setDraft(text);
    setTab('chat');
  };

  return (
    <div>
      <TopBar title="Coach" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'goals', label: 'Goals' },
          { value: 'insights', label: 'Insights' },
          { value: 'diagnose', label: 'Diagnose' },
          { value: 'chat', label: 'Ask' },
        ]}
      />
      {tab === 'goals' && <GoalsPanel onAsk={openChat} />}
      {tab === 'insights' && (
        <Insights
          onDiagnose={(f) => {
            setFamily(f);
            setTab('diagnose');
          }}
          onAsk={openChat}
        />
      )}
      {tab === 'diagnose' && <Diagnose family={family} setFamily={setFamily} onAsk={openChat} />}
      {tab === 'chat' && <Chat draft={draft} setDraft={setDraft} />}
    </div>
  );
}

// Insights -----------------------------------------------------------------------

function Insights({ onDiagnose, onAsk }: { onDiagnose: (f: LiftFamily) => void; onAsk: (text: string) => void }) {
  const s = useAppState();
  const lifts = useMemo(() => analyzeAll(s), [s]);
  const insights = useMemo(() => buildInsights(s), [s]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="title-row">
          <h3>Main lifts</h3>
          <Help title="How lifts are rated">
            <p>Progressing: e1RM is trending up or you set a PR in the last 4 weeks.</p>
            <p>Stalled: no e1RM PR for 4+ weeks and a flat trend. Regressing: trending down and below your best.</p>
            <p>"/wk" counts sessions with any variation of the lift. Tap a stalled lift to diagnose it.</p>
          </Help>
        </div>
        <table className="tbl" style={{ marginTop: 6 }}>
          <tbody>
            {lifts.map((l) => (
              <tr key={l.family} onClick={() => l.trend !== 'progressing' && l.trend !== 'insufficient' && onDiagnose(l.family)} style={{ cursor: 'pointer' }}>
                <td>{FAMILY_LABEL[l.family]}</td>
                <td>
                  <span className={`status ${TREND_CLASS[l.trend]}`}>{TREND_LABEL[l.trend]}</span>
                </td>
                <td>{l.bestE1rm ? fmtKg(l.bestE1rm) : '–'}</td>
                <td className="muted">{Number.isFinite(l.weeksSincePR) && l.history.length ? `PR ${Math.round(l.weeksSincePR)}w ago` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card tight">
        {insights.map((i) => (
          <InsightRow key={i.id} insight={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} onDiagnose={onDiagnose} onAsk={onAsk} />
        ))}
      </div>
    </div>
  );
}

function InsightRow({ insight: i, open, onToggle, onDiagnose, onAsk }: { insight: Insight; open: boolean; onToggle: () => void; onDiagnose: (f: LiftFamily) => void; onAsk: (t: string) => void }) {
  return (
    <div className="insight-row">
      <button className="list-item" onClick={onToggle} aria-expanded={open}>
        <span className={`dot ${i.severity}`} />
        <div className="grow">
          <div className="bold">{i.title}</div>
          {!open && <div className="small muted clamp2">{i.actions[0]}</div>}
        </div>
        <span className="muted">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 2px 12px 19px' }}>
          <p className="small" style={{ color: 'var(--text-2)' }}>
            {i.detail}
          </p>
          <ul className="small" style={{ paddingLeft: 18, margin: '6px 0' }}>
            {i.actions.map((a, k) => (
              <li key={k}>{a}</li>
            ))}
          </ul>
          {i.family && i.severity !== 'good' && (
            <div className="row">
              <button className="btn-sm grow" onClick={() => onDiagnose(i.family!)}>
                Diagnose
              </button>
              <button className="btn-sm grow" onClick={() => onAsk(`${i.title}. ${i.detail} What should I change? Ask me anything you need to know first.`)}>
                Ask coach
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Diagnose -----------------------------------------------------------------------

function Diagnose({ family, setFamily, onAsk }: { family: LiftFamily; setFamily: (f: LiftFamily) => void; onAsk: (t: string) => void }) {
  const s = useAppState();
  const exId = FAMILY_MAIN[family];
  const answers = s.diagnoses[exId]?.answers ?? {};
  const recovery = s.diagnoses[RECOVERY_KEY]?.answers ?? {};
  const [addRx, setAddRx] = useState<Rx | null>(null);

  const setAnswer = (key: string, q: Question, optId: string) =>
    update((st) => {
      const prev = st.diagnoses[key]?.answers ?? {};
      const cur = prev[q.id] ?? [];
      let next: string[];
      if (q.multi) {
        next = cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur.filter((x) => x !== 'none'), optId];
        if (optId === 'none') next = cur.includes('none') ? [] : ['none'];
      } else next = cur[0] === optId ? [] : [optId];
      return { ...st, diagnoses: { ...st.diagnoses, [key]: { exerciseId: key, answers: { ...prev, [q.id]: next }, updatedAt: new Date().toISOString() } } };
    });

  const result = adviseFromAnswers(family, { ...recovery, ...answers });
  const answered = Object.values(answers).some((a) => a.length);

  return (
    <div>
      <div className="chips" style={{ margin: '12px 0 4px' }}>
        {FAMILIES.map((f) => (
          <button key={f} className={`chip ${f === family ? 'on' : ''}`} onClick={() => setFamily(f)}>
            {FAMILY_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="row between" style={{ margin: '4px 0' }}>
        <span className="small muted">What do you notice on heavy sets?</span>
        <Help title="Diagnose">
          <p>Answer based on heavy sets (RPE 8+). Filming from the side helps.</p>
          <p>Your answers build a plan below: variations to run for 4-6 weeks (usually as the second weekly session for the lift), technique cues and programming changes. They're saved and shared with the AI coach.</p>
        </Help>
      </div>

      {QUESTIONS[family].map((q) => (
        <QuestionCard key={q.id} q={q} selected={answers[q.id] ?? []} onPick={(o) => setAnswer(exId, q, o)} />
      ))}
      <h2>Recovery</h2>
      {RECOVERY_QUESTIONS.map((q) => (
        <QuestionCard key={q.id} q={q} selected={recovery[q.id] ?? []} onPick={(o) => setAnswer(RECOVERY_KEY, q, o)} />
      ))}

      {(result.rx.length > 0 || result.cues.length > 0 || result.programming.length > 0) && (
        <>
          <h2>Plan</h2>
          {result.rx.length > 0 && (
            <div className="card">
              <h3>Pick 1-2 variations</h3>
              {result.rx.map((r) => (
                <div key={r.exerciseId} className="rx-row">
                  <div className="grow">
                    <button className="btn-ghost bold" style={{ padding: 0, minHeight: 0 }} onClick={() => go(`/exercise/${r.exerciseId}`)}>
                      {exerciseName(r.exerciseId, s)}
                    </button>
                    <div className="small num">
                      {r.sets} × {r.reps} @ RPE {r.rpe}
                    </div>
                    <div className="tiny muted">{r.why}</div>
                  </div>
                  <button className="btn-sm" onClick={() => setAddRx(r)}>
                    + Program
                  </button>
                </div>
              ))}
            </div>
          )}
          {result.cues.length > 0 && (
            <div className="card">
              <h3>Technique cues</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                {result.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {result.programming.length > 0 && (
            <div className="card">
              <h3>Programming</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                {result.programming.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {answered && (
        <button
          className="btn-primary btn-block"
          style={{ margin: '8px 0 16px' }}
          onClick={() =>
            onAsk(
              `Help me fix my ${FAMILY_LABEL[family].toLowerCase()}. Here's what I notice:\n${describeAnswers(family, { ...recovery, ...answers })
                .map((l) => `- ${l}`)
                .join('\n')}\nWhat's the most likely limiter and what should my next 4-6 weeks look like?`,
            )
          }
        >
          Discuss with the AI coach
        </button>
      )}
      {addRx && <AddToProgramSheet rx={addRx} onClose={() => setAddRx(null)} />}
    </div>
  );
}

function QuestionCard({ q, selected, onPick }: { q: Question; selected: string[]; onPick: (optionId: string) => void }) {
  return (
    <div className="card tight">
      <div className="bold small" style={{ marginBottom: 6 }}>
        {q.text} {q.multi && <span className="muted tiny">(pick any)</span>}
      </div>
      <div className="options">
        {q.options.map((o) => (
          <button key={o.id} className={`option ${selected.includes(o.id) ? 'on' : ''}`} aria-pressed={selected.includes(o.id)} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Adds a suggested exercise to a day in the user's program (copying a built-in template first). */
function AddToProgramSheet({ rx, onClose }: { rx: Rx; onClose: () => void }) {
  const s = useAppState();
  const active = s.activeProgram && getProgram(s.activeProgram.programId, s);
  const userPrograms = s.programs;
  const [programId, setProgramId] = useState<string>(active && !active.builtIn ? active.id : userPrograms[0]?.id ?? '');
  const program = userPrograms.find((p) => p.id === programId);

  const copyActive = () => {
    if (!active) return;
    const c = duplicateProgram(active);
    c.name = active.name + ' (coached)';
    update((st) => ({ ...st, programs: [...st.programs, c], activeProgram: st.activeProgram ? { ...st.activeProgram, programId: c.id } : st.activeProgram }));
    setProgramId(c.id);
  };

  const addToDay = (dayIndexInWeek: number) => {
    update((st) => ({
      ...st,
      programs: st.programs.map((p): Program => {
        if (p.id !== programId) return p;
        return {
          ...p,
          weeks: p.weeks.map((w) => ({
            ...w,
            days: w.days.map((d, i) =>
              i !== dayIndexInWeek
                ? d
                : { ...d, exercises: [...d.exercises, { exerciseId: rx.exerciseId, rest: 180, notes: `Coach: ${rx.why}`, sets: Array.from({ length: rx.sets }, () => ({ kind: 'work' as const, reps: rx.reps, rpe: rx.rpe })) }] },
            ),
          })),
        };
      }),
    }));
    toast(`Added ${exerciseName(rx.exerciseId, getState())} to ${program?.name}`);
    onClose();
  };

  return (
    <Sheet title={`Add ${exerciseName(rx.exerciseId, s)}`} onClose={onClose}>
      <p className="small muted">
        {rx.sets} × {rx.reps} @ RPE {rx.rpe}. The exercise is added to the chosen day in every week of the program.
      </p>
      {active?.builtIn && (
        <button className="btn-block" style={{ margin: '8px 0' }} onClick={copyActive}>
          Copy “{active.name}” to customize it
        </button>
      )}
      {userPrograms.length > 0 ? (
        <>
          <label className="field">
            <span>Program</span>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {userPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {program && (
            <div className="list">
              {program.weeks[0].days.map((d, i) => (
                <button key={d.id} className="list-item" onClick={() => addToDay(i)}>
                  <div className="grow">
                    <div className="bold">{d.name}</div>
                    <div className="small muted ellipsis">{d.exercises.map((e) => exerciseName(e.exerciseId, s)).join(', ') || 'No exercises'}</div>
                  </div>
                  <span className="muted">+</span>
                </button>
              ))}
            </div>
          )}
          {program && flattenDays(program).length === 0 && <p className="small muted">This program has no days yet.</p>}
        </>
      ) : (
        !active?.builtIn && (
          <p className="small muted">
            You don't have a custom program yet. Create one in <a href="#/programs">Programs</a> or follow a template and copy it here.
          </p>
        )
      )}
    </Sheet>
  );
}

// AI chat ----------------------------------------------------------------------

const STARTERS = [
  'Are my goals realistic? What should I change in training and nutrition?',
  'Review my last 6 weeks. What is going well and what is holding me back?',
  'Which of my lifts is the biggest weak point, and why?',
  'Plan my next 4 weeks to break my stall.',
  'Am I doing too much or too little volume?',
];

function Chat({ draft, setDraft }: { draft: string; setDraft: (t: string) => void }) {
  const s = useAppState();
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const [streaming, setStreaming] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  // Latest partial reply, so a stopped answer can be kept.
  const streamingRef = useRef<string | null>(null);
  streamingRef.current = streaming;
  const chat = s.coachChat;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, streaming]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || streaming !== null) return;
    const userMsg: CoachMessage = { id: uid(), role: 'user', text: t, at: new Date().toISOString() };
    update((st) => ({ ...st, coachChat: [...st.coachChat, userMsg] }));
    setDraft('');
    setStreaming('');
    abort.current = new AbortController();
    try {
      const reply = await askCoach(getState(), getState().coachChat, (partial) => setStreaming(partial), abort.current.signal);
      update((st) => ({ ...st, coachChat: [...st.coachChat, { id: uid(), role: 'assistant', text: reply, at: new Date().toISOString() }] }));
    } catch (e) {
      const aborted = (e as Error).name === 'APIUserAbortError' || abort.current?.signal.aborted;
      const partial = streamingRef.current;
      if (aborted && partial) update((st) => ({ ...st, coachChat: [...st.coachChat, { id: uid(), role: 'assistant', text: partial + ' …', at: new Date().toISOString() }] }));
      else if (!aborted) update((st) => ({ ...st, coachChat: [...st.coachChat, { id: uid(), role: 'assistant', text: (e as Error).message, at: new Date().toISOString(), error: true }] }));
    } finally {
      setStreaming(null);
      abort.current = null;
    }
  };

  if (!hasKey) return <KeySetup onSaved={() => setHasKey(true)} />;

  return (
    <div className="chat">
      {!chat.length && streaming === null && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="title-row">
            <h3>Ask your coach</h3>
            <Help title="AI coach">
              <p>The coach reads your last 6 weeks of training, lift trends, goals, nutrition and diagnostic answers.</p>
              <p>It asks follow-up questions (like where a lift fails) before prescribing changes. Uses your Anthropic API key, billed to your account.</p>
            </Help>
          </div>
          <div className="options" style={{ marginTop: 8 }}>
            {STARTERS.map((q) => (
              <button key={q} className="option" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="messages">
        {chat.map((m) => (
          <div key={m.id} className={`bubble ${m.role} ${m.error ? 'error' : ''}`}>
            {m.role === 'assistant' ? <Markdown text={m.text} /> : m.text}
          </div>
        ))}
        {streaming !== null && <div className="bubble assistant">{streaming ? <Markdown text={streaming} /> : <span className="muted">Coach is looking at your training…</span>}</div>}
        <div ref={bottom} />
      </div>
      <div className="composer">
        <textarea
          id="coach-input"
          aria-label="Message the coach"
          placeholder="Answer the coach or ask anything…"
          value={draft}
          rows={draft.split('\n').length > 2 ? 4 : 2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(draft);
          }}
        />
        {streaming !== null ? (
          <button onClick={() => abort.current?.abort()}>Stop</button>
        ) : (
          <button className="btn-primary" onClick={() => send(draft)} disabled={!draft.trim()}>
            Send
          </button>
        )}
      </div>
      <div className="row tiny muted" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
        <span className="row" style={{ gap: 4 }}>
          <button className="btn-ghost btn-sm" onClick={async () => chat.length && (await ask('Clear the conversation?', { confirmLabel: 'Clear' })) && update((st) => ({ ...st, coachChat: [] }))}>
            Clear
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setHasKey(false)}>
            Key
          </button>
        </span>
      </div>
    </div>
  );
}

function KeySetup({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState(getApiKey());
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="title-row">
        <h3>Connect the AI coach</h3>
        <Help title="API key">
          <p>The chat coach runs on Claude with your own Anthropic API key. Create one at console.anthropic.com → API keys. A typical question costs a few cents.</p>
          <p>The key stays on this device and is never included in backups. Requests go straight from your phone to the Claude API, along with a summary of your recent training.</p>
        </Help>
      </div>
      <label className="field">
        <span>Anthropic API key</span>
        <input id="coach-api-key" type="password" autoComplete="off" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <div className="row">
        {getApiKey() && (
          <button
            className="grow btn-danger"
            onClick={() => {
              setApiKey('');
              setKey('');
              toast('Key removed');
            }}
          >
            Remove key
          </button>
        )}
        <button
          className="btn-primary grow"
          disabled={!key.trim().startsWith('sk-')}
          onClick={() => {
            setApiKey(key);
            onSaved();
          }}
        >
          Save key
        </button>
      </div>
    </div>
  );
}

/** Minimal Markdown for coach replies: headings, bullet/numbered lists, bold and italics. */
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) blocks.push(<h4 key={blocks.length}>{inline(h[1])}</h4>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="md">{blocks}</div>;
}

function inline(s: string): ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : p));
}
