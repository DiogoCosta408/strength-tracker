import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error?: Error;
}

/**
 * Without this, a render error in one screen unmounts the whole app (React 18 default),
 * which looks like a blank page that only a hard reload fixes. Scoped to just the screen
 * area (see App.tsx) so the tab bar stays usable and switching tabs recovers on its own.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="card" style={{ margin: 16 }}>
        <h3>Something went wrong</h3>
        <p className="small muted">{error.message}</p>
        <button className="btn-block btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
