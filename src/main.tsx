import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadState } from './lib/store';
import { initSync, setSyncBackend } from './lib/sync';
import { consumePendingToken } from './lib/googleAuth';
import './styles.css';

try {
  const t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {
  /* storage blocked */
}

async function bootstrapSync() {
  // No Google Cloud project configured for local dev: fall back to an in-browser mock of
  // Drive so Settings → Cloud sync is still clickable. See README → Cloud sync setup.
  if (import.meta.env.DEV && !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    const mock = await import('./lib/googleDriveMock');
    setSyncBackend(mock, mock);
    console.warn('[sync] VITE_GOOGLE_CLIENT_ID is not set — using a local mock of Google Drive for Cloud sync.');
  } else {
    consumePendingToken(); // picks up a token left by oauth-callback.html, if we just returned from one
  }
  initSync();
}

// Sync only after local data is back from IndexedDB: the first sync merges local with the
// remote backup, and starting it against a not-yet-loaded (empty) state would upload an
// empty backup over good data.
loadState().then(bootstrapSync);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Above App, so even a crash in App's own render/effects shows a message instead of a blank page. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
