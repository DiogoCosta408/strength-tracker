import { useMemo, useState } from 'react';
import { dots, fmtKg } from '../lib/calc';
import { bodyweightAt, getExercise, useAppState } from '../lib/store';
import { bestE1rm, exerciseHistory, finishedWorkouts, trainingStreakWeeks, weeklyStats, workoutPRs } from '../lib/stats';
import { fmtDate, weekKey } from '../lib/util';
import { BarChart, LineChart, MultiLineChart, Sparkline } from '../components/Charts';
import { go, Help, Icon, Segmented, Stat } from '../components/ui';
import { flattenDays } from '../data/programs';
import { nextProgramDay, nextSessionDate } from '../lib/workout';
import { StrengthMini, StrengthProgressChart, StrengthScoreCard } from './Strength';
import { movingAverage } from './Body';
import { buildInsights } from '../lib/coach';
import { goalProgressPct, goalReport } from '../lib/goals';
import { fmtRate, rateKg, rateToneClass } from './Goals';

const WELCOME_DISMISSED_KEY = 'welcome-dismissed';

/** "Today" / "Tomorrow" / "Thu 23 Oct", for the next planned session. */
function dayLabel(date: Date): string {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - midnight.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return fmtDate(date.toISOString(), { weekday: 'short', day: 'numeric', month: 'short' });
}

const MAIN_LIFTS = [
  { id: 'squat', label: 'Squat', color: '#e0803a' },
  { id: 'bench-press', label: 'Bench', color: '#3c8ce6' },
  { id: 'deadlift', label: 'Deadlift', color: '#46b964' },
  { id: 'press', label: 'Press', color: '#a87fe0' },
];

export function Dashboard() {
  const s = useAppState();
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [lift, setLift] = useState<string | null>(null); // null = all four overlaid
  const [volMetric, setVolMetric] = useState<'tonnage' | 'hardSets'>('tonnage');
  const workouts = finishedWorkouts(s);
  const bw = bodyweightAt(s);
  const next = nextProgramDay(s);
  const dueDate = useMemo(() => nextSessionDate(s), [s]);
  const perWeek = next ? Math.round((flattenDays(next.program).length / Math.max(1, next.program.weeks.length)) * 10) / 10 : 0;

  const lifts = useMemo(
    () =>
      MAIN_LIFTS.map((l) => {
        const hist = exerciseHistory(s, l.id);
        const best = bestE1rm(s, l.id);
        const old = hist.filter((p) => new Date(p.date).getTime() < Date.now() - 90 * 86400000);
        const oldBest = old.length ? Math.max(...old.map((p) => p.e1rm)) : undefined;
        return { ...l, hist, best, delta: oldBest ? best - oldBest : undefined };
      }),
    [s],
  );
  const total = lifts.slice(0, 3).every((l) => l.best) ? lifts.slice(0, 3).reduce((a, l) => a + l.best, 0) : 0;

  const weeks = useMemo(() => weeklyStats(s, 12), [s]);
  const thisWeek = weeks[weeks.length - 1];
  const streak = trainingStreakWeeks(s);

  const recentPRs = useMemo(() => {
    const out: { date: string; text: string; id: string }[] = [];
    for (const w of workouts.slice(-12).reverse()) {
      for (const p of workoutPRs(s, w)) {
        if (p.type !== 'e1rm') continue;
        const ex = getExercise(p.exerciseId, s);
        const adj = ex?.bodyweightLoaded ? w.bodyweight ?? bw ?? 0 : 0;
        out.push({ id: w.id + p.exerciseId, date: w.startedAt, text: `${ex?.name}: e1RM ${fmtKg(p.value - adj)} kg (+${fmtKg(p.value - (p.previous ?? 0))})` });
      }
    }
    return out.slice(0, 6);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = lifts.find((l) => l.id === lift);
  const goal = useMemo(() => goalReport(s), [s]);
  const coachNote = useMemo(() => buildInsights(s).find((i) => i.severity !== 'info') ?? null, [s]);
  const bwSorted = [...s.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const bwTrend = movingAverage(bwSorted.slice(-30)).map((p) => p.y);

  return (
    <div>
      <div className="topbar">
        <h1>{s.profile.name ? `Hi, ${s.profile.name}` : 'Dashboard'}</h1>
        <button className="btn-ghost icon-btn" aria-label="Share best lifts" onClick={() => go('/share')}>
          <Icon name="share" />
        </button>
        <button className="btn-ghost icon-btn" aria-label="Settings" onClick={() => go('/settings')}>
          <Icon name="settings" />
        </button>
      </div>

      {s.activeWorkout ? (
        <button className="btn-primary btn-block" onClick={() => go('/workout')}>
          Resume: {s.activeWorkout.name}
        </button>
      ) : (
        <button className="btn-primary btn-block" onClick={() => go('/train')}>
          {next ? `Start ${next.day.name} · ${next.program.name}` : 'Start a workout'}
        </button>
      )}

      {!s.activeWorkout && next && dueDate && (
        <div className="title-row small muted" style={{ justifyContent: 'center', marginTop: 6 }}>
          <span>
            Next session <b style={{ color: 'var(--text)' }}>{dayLabel(dueDate)}</b>
          </span>
          <Help title="Next session">
            <p>Programs are a list of sessions in order, not fixed calendar dates — so this spaces them by how often {next.program.name} trains ({perWeek}× a week), counting from your last logged session.</p>
            <p>Train earlier or later whenever you like; it just shows when you're next due, and says today once you are.</p>
          </Help>
        </div>
      )}

      {!workouts.length && !welcomeDismissed && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>Welcome 👋</h3>
            <button
              className="btn-ghost icon-btn"
              aria-label="Dismiss"
              onClick={() => {
                try {
                  localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
                } catch {
                  /* storage unavailable */
                }
                setWelcomeDismissed(true);
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="small">Quick setup to get the most out of the app:</p>
          <ol className="small" style={{ paddingLeft: 18, margin: '6px 0' }}>
            <li>
              <a href="#/settings">Set your profile</a> (sex, birth year, bar & plates).
            </li>
            <li>
              <a href="#/body">Log your bodyweight</a> — needed for strength standards & Wilks/DOTS.
            </li>
            <li>
              <a href="#/strength">Enter known maxes</a> so RPE/% loads are suggested from day one.
            </li>
            <li>
              <a href="#/programs">Pick a program</a> (Starting Strength, 5/3/1, RPE blocks…) or log freely.
            </li>
          </ol>
        </div>
      )}

      {goal && s.goals && (
        <button className="card list-item" style={{ display: 'block', borderRadius: 14, border: '1px solid var(--border)', marginTop: 12 }} onClick={() => go('/coach/goals')}>
          <div className="row between">
            <span className="small muted">Goal · {Math.max(0, Math.round(goal.weeksLeft))} weeks left</span>
            <span className={`status ${goal.overall === 'unrealistic' ? 'bad' : goal.overall === 'ambitious' ? 'warn' : goal.overall === 'no-data' ? 'muted' : 'good'}`}>
              {{ achieved: 'Achieved', 'on-track': 'On track', ambitious: 'Ambitious', unrealistic: 'Not realistic', 'no-data': 'Needs data' }[goal.overall]}
            </span>
          </div>
          {goal.lifts.map((l) => {
            const done = goalProgressPct(l.start, l.current, l.target);
            const needed = Number.isFinite(l.requiredPct) ? rateKg(l.requiredPct, l.current) : undefined;
            const actual = l.observedPct !== undefined ? rateKg(l.observedPct, l.current) : undefined;
            return (
              <div key={l.exerciseId} style={{ marginTop: 8 }}>
                <div className="row between small num">
                  <span className="grow ellipsis">{l.name.replace(/\s*\(.*\)/, '')}</span>
                  <span>
                    {fmtKg(l.current)} / <b>{fmtKg(l.target)}</b> kg
                  </span>
                </div>
                <div className="level-bar" style={{ height: 5, marginTop: 3 }}>
                  <div style={{ width: `${done}%`, background: 'var(--accent)' }} />
                </div>
                <div className="row between tiny muted num" style={{ marginTop: 2 }}>
                  <span>{Math.round(done)}%</span>
                  <span>
                    needs {needed !== undefined ? fmtRate(needed) : '—'} · now{' '}
                    <span className={rateToneClass(actual, needed)}>{actual !== undefined ? fmtRate(actual) : '—'}</span> /wk
                  </span>
                </div>
              </div>
            );
          })}
          {goal.bodyweight && (
            <div className="row between small num" style={{ marginTop: 4 }}>
              <span className="grow">Bodyweight</span>
              <span>
                {fmtKg(goal.bodyweight.current)} / <b>{fmtKg(goal.bodyweight.target)}</b> kg
              </span>
            </div>
          )}
          {goal.macros && (
            <div className="small muted" style={{ marginTop: 6 }}>
              Today: {goal.macros.calories.toLocaleString()} kcal · P {goal.macros.protein} g · C {goal.macros.carbs} g · F {goal.macros.fat} g
            </div>
          )}
        </button>
      )}

      {coachNote && workouts.length > 0 && (
        <button className={`card insight ${coachNote.severity} list-item`} style={{ display: 'block', borderRadius: 14, border: '1px solid var(--border)', marginTop: 12 }} onClick={() => go('/coach')}>
          <div className="row between">
            <span className="small muted">Coach</span>
            <span className="small muted">Details ›</span>
          </div>
          <div className="bold">{coachNote.title}</div>
          <div className="small" style={{ color: 'var(--text-2)' }}>
            {coachNote.actions[0]}
          </div>
        </button>
      )}

      <div className="grid2" style={{ marginTop: 12 }}>
        <Stat label="SBD total (e1RM)" value={total ? `${fmtKg(total, 0)} kg` : '–'} sub={total && bw ? `DOTS ${dots(total, bw, s.profile.sex).toFixed(1)}` : 'log S, B & D'} />
        <div className="stat" onClick={() => go('/body')} style={{ cursor: 'pointer' }}>
          <div className="label">Bodyweight</div>
          <div className="row between">
            <div className="value">{bw ? fmtKg(bw) : '–'}</div>
            <Sparkline values={bwTrend} />
          </div>
          <div className="sub">{bw ? 'kg · tap to log' : 'tap to log'}</div>
        </div>
        <Stat label="This week" value={`${thisWeek?.sessions ?? 0} sessions`} sub={`${thisWeek?.hardSets ?? 0} hard sets · ${Math.round((thisWeek?.tonnage ?? 0) / 100) / 10} t`} />
        <Stat label="Streak" value={`${streak} wk`} sub={`${workouts.length} workouts total`} />
      </div>

      <h2>Main lifts</h2>
      <div className="grid2">
        {lifts.map((l) => (
          <button key={l.id} className="stat" style={{ textAlign: 'left', display: 'block', minHeight: 0 }} onClick={() => setLift(lift === l.id ? null : l.id)} aria-pressed={lift === l.id}>
            <div className="row between">
              <span className="label">{l.label}</span>
              <Sparkline values={l.hist.slice(-12).map((p) => p.e1rm)} width={60} height={20} color={l.color} />
            </div>
            <div className="value" style={{ color: lift === l.id ? l.color : undefined }}>
              {l.best ? fmtKg(l.best) : '–'}
            </div>
            <div className="sub">{l.delta !== undefined ? <span className={l.delta >= 0 ? 'good' : 'bad'}>{l.delta >= 0 ? '+' : ''}{fmtKg(l.delta)} kg vs 3 mo ago</span> : 'e1RM kg'}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>{sel ? `${sel.label} e1RM` : 'e1RM trend'}</h3>
          {sel ? (
            <button className="btn-sm btn-ghost" onClick={() => go(`/exercise/${sel.id}`)}>
              Details ›
            </button>
          ) : (
            <span className="tiny muted">tap a lift above to focus</span>
          )}
        </div>
        {sel ? (
          <LineChart
            color={sel.color}
            points={sel.hist.map((p) => ({ x: new Date(p.date).getTime(), y: p.e1rm, label: `${fmtKg(p.topWeight)}×${p.topReps}${p.topRpe ? ` @${p.topRpe}` : ''}` }))}
          />
        ) : (
          <>
            <MultiLineChart series={lifts.map((l) => ({ key: l.id, label: l.label, color: l.color, points: l.hist.map((p) => ({ x: new Date(p.date).getTime(), y: p.e1rm })) }))} />
            <div className="row wrap" style={{ gap: '4px 12px', justifyContent: 'center', marginTop: 6 }}>
              {lifts
                .filter((l) => l.hist.length)
                .map((l) => (
                  <span key={l.id} className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, display: 'inline-block', flexShrink: 0 }} />
                    {l.label}
                  </span>
                ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        {/* stacked: the heading and the toggle collide side by side at phone width */}
        <div style={{ marginBottom: 8 }}>
          <div className="title-row" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Weekly training</h3>
            <Help title="Weekly training">
              <p>Tonnage = kg × reps of all work sets. Hard sets = work sets at RPE 7+ (or without an RPE). Last 12 weeks.</p>
            </Help>
          </div>
          <div>
            <Segmented value={volMetric} onChange={setVolMetric} options={[{ value: 'tonnage', label: 'Tonnage' }, { value: 'hardSets', label: 'Hard sets' }]} />
          </div>
        </div>
        <BarChart
          unit={volMetric === 'tonnage' ? 'kg' : 'sets'}
          bars={weeks.map((w) => ({
            key: w.week,
            label: fmtDate(w.week, { day: 'numeric', month: 'short' }),
            value: w[volMetric],
            tip: `week of ${fmtDate(w.week, { day: 'numeric', month: 'short' })} · ${w.sessions} sessions`,
          }))}
        />
      </div>

      <StrengthScoreCard onClick={() => go('/strength')} />
      <StrengthProgressChart />

      <div className="card" onClick={() => go('/strength')} style={{ cursor: 'pointer' }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Strength profile</h3>
          <span className="small muted">Details ›</span>
        </div>
        <StrengthMini />
      </div>

      {recentPRs.length > 0 && (
        <div className="card">
          <h3>🏆 Recent PRs</h3>
          {recentPRs.map((p) => (
            <div key={p.id} className="row between small" style={{ padding: '4px 0' }}>
              <span className="grow">{p.text}</span>
              <span className="muted">{fmtDate(p.date, { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
        </div>
      )}

      {workouts.length > 0 && (
        <div className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>Recent sessions</h3>
            <button className="btn-sm btn-ghost" onClick={() => go('/history')}>
              All ›
            </button>
          </div>
          {workouts
            .slice(-4)
            .reverse()
            .map((w) => (
              <button key={w.id} className="list-item" onClick={() => go(`/history/${w.id}`)}>
                <span className="grow ellipsis">{w.name}</span>
                <span className="small muted">{weekKey(w.startedAt) === weekKey(new Date().toISOString()) ? fmtDate(w.startedAt, { weekday: 'short' }) : fmtDate(w.startedAt, { day: 'numeric', month: 'short' })}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
