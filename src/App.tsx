import { useEffect } from 'react';
import { useAppState, useLoaded } from './lib/store';
import { DialogHost, go, Icon, Toaster, useRoute } from './components/ui';
import { RestTimer } from './components/RestTimer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './screens/Dashboard';
import { Train } from './screens/Train';
import { WorkoutLogger } from './screens/WorkoutLogger';
import { ProgramDetail, ProgramEditor, ProgramList } from './screens/Programs';
import { Tools } from './screens/Tools';
import { More, Settings } from './screens/Settings';
import { HistoryList, WorkoutDetail } from './screens/History';
import { Body } from './screens/Body';
import { Strength } from './screens/Strength';
import { ExerciseDetail, ExerciseLibrary } from './screens/ExerciseDetail';
import { Share } from './screens/Share';
import { Coach } from './screens/Coach';

const TABS = [
  { path: '', icon: 'home', label: 'Home', match: ['', 'strength', 'share'] },
  { path: 'train', icon: 'dumbbell', label: 'Train', match: ['train', 'workout'] },
  { path: 'coach', icon: 'coach', label: 'Coach', match: ['coach'] },
  { path: 'programs', icon: 'list', label: 'Programs', match: ['programs', 'program', 'program-edit'] },
  { path: 'more', icon: 'user', label: 'More', match: ['more', 'tools', 'history', 'body', 'exercises', 'exercise', 'settings'] },
];

function Screen({ route }: { route: string[] }) {
  const [page, id] = route;
  switch (page ?? '') {
    case '':
      return <Dashboard />;
    case 'train':
      return <Train />;
    case 'workout':
      return <WorkoutLogger />;
    case 'programs':
      return <ProgramList />;
    case 'program':
      return <ProgramDetail id={id} />;
    case 'program-edit':
      return <ProgramEditor id={id} />;
    case 'tools':
      return <Tools />;
    case 'more':
      return <More />;
    case 'settings':
      return <Settings />;
    case 'history':
      return id ? <WorkoutDetail id={id} /> : <HistoryList />;
    case 'body':
      return <Body />;
    case 'strength':
      return <Strength />;
    case 'exercises':
      return <ExerciseLibrary />;
    case 'exercise':
      return <ExerciseDetail id={id} />;
    case 'share':
      return <Share />;
    case 'coach':
      return <Coach />;
    default:
      return <Dashboard />;
  }
}

export function App() {
  const loaded = useLoaded();
  const route = useRoute();
  const s = useAppState();
  const key = route.join('/');
  useEffect(() => window.scrollTo(0, 0), [key]);
  if (!loaded) return null;
  const page = route[0] ?? '';
  return (
    // Outer boundary: a last resort for a crash outside the screen area itself (tab bar,
    // toasts, dialogs). The inner one (keyed by route) is what lets switching tabs recover
    // from a broken screen without a reload.
    <ErrorBoundary>
      <div className="app">
        <ErrorBoundary key={key}>
          <Screen route={route} />
        </ErrorBoundary>
      </div>
      <RestTimer />
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map((t) => {
            const on = t.match.includes(page);
            const href = t.path === 'train' && s.activeWorkout ? 'workout' : t.path;
            return (
              <a key={t.path} href={`#/${href}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go(href))}>
                <Icon name={t.icon} />
                {t.label}
                {t.path === 'train' && s.activeWorkout && <span className="pr-badge" style={{ position: 'absolute', marginLeft: 26, marginTop: -2 }}>●</span>}
              </a>
            );
          })}
        </div>
      </nav>
      <Toaster />
      <DialogHost />
    </ErrorBoundary>
  );
}
