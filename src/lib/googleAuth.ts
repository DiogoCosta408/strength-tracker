// Plain OAuth 2.0 implicit flow via a full-page redirect through a tiny static callback
// page (public/oauth-callback.html) — deliberately NOT using Google Identity Services.
// GIS loads a third-party script that sets up its own background iframe/message-channel
// activity, which was traced (via a decoded production source map) to crashing deep inside
// React-DOM's own scheduler on this app, with no application code involved at all — not a
// bug in a callback, something about the script itself destabilizing the page. A plain
// redirect avoids loading any third-party script, any popup, and any iframe/postMessage.
//
// Trade-off: no truly silent background token refresh (that needs either a backend-held
// refresh token, or an invisible iframe trick like GIS's — both ruled out above). Once the
// ~1h access token expires, the UI shows "Reconnect" and one tap redirects out and back.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const CONNECTED_KEY = 'gdrive-connected';
// In localStorage, not sessionStorage: the round trip can come back in a different tab,
// and a per-tab state would then read as a mismatch on a perfectly good sign-in.
const STATE_KEY = 'gdrive-oauth-state';
const RETURN_HASH_KEY = 'gdrive-oauth-return-hash';
/** Set when a sign-in is sent off, cleared when one comes back — lets a lost round trip be detected. */
const STARTED_KEY = 'gdrive-oauth-started';
// Must match the literal key written by public/oauth-callback.html (a plain static file,
// not built/typechecked, so it can't import this constant).
const PENDING_TOKEN_KEY = 'gdrive-pending-token';

export class ReconnectRequiredError extends Error {
  constructor(message = 'Reconnect to Google Drive to keep syncing.') {
    super(message);
    this.name = 'ReconnectRequiredError';
  }
}

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('VITE_GOOGLE_CLIENT_ID is not set. See README → Cloud sync setup.');
  return id;
}

function callbackUrl(): string {
  return new URL('oauth-callback.html', location.href).toString();
}

interface Token {
  token: string;
  expiresAt: number;
}

/**
 * The access token is persisted, not just held in memory: the app is reopened as a fresh page
 * load every time, so an in-memory-only token meant every open had nothing to sync with and
 * silently fell back to "Reconnect". It's a bearer token limited to this app's own hidden
 * Drive folder, kept in this origin's localStorage and cleared on Disconnect, and it expires
 * on its own in about an hour.
 */
const TOKEN_KEY = 'gdrive-token';

function readToken(): Token | undefined {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return undefined;
    const t = JSON.parse(raw) as Token;
    return t?.token && t?.expiresAt ? t : undefined;
  } catch {
    return undefined;
  }
}

function writeToken(t: Token | undefined): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

let lastAuthError: string | undefined;

/** Why the last sign-in round trip failed, if it did. Read once by the sync layer on start-up. */
export function takeAuthError(): string | undefined {
  const e = lastAuthError;
  lastAuthError = undefined;
  return e;
}

export function isConnected(): boolean {
  try {
    return localStorage.getItem(CONNECTED_KEY) === '1';
  } catch {
    return false;
  }
}

function setConnected(v: boolean): void {
  try {
    if (v) localStorage.setItem(CONNECTED_KEY, '1');
    else localStorage.removeItem(CONNECTED_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Call once on app start, before anything else touches auth state: picks up a token left by
 * oauth-callback.html after a round trip, and restores the hash the user was on before the
 * redirect (connect() stashed it) so they land back where they were, not on the dashboard.
 */
export function consumePendingToken(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_TOKEN_KEY);
    localStorage.removeItem(PENDING_TOKEN_KEY);
  } catch {
    return;
  }
  if (!raw) {
    // A sign-in was started but nothing came back. On an installed iOS PWA the Google page
    // can open in Safari instead, which has its own storage — so the token is written where
    // this app can't see it. Say so rather than looking like a silent no-op.
    let started = 0;
    try {
      started = Number(localStorage.getItem(STARTED_KEY) ?? 0);
      if (started) localStorage.removeItem(STARTED_KEY);
    } catch {
      /* ignore */
    }
    if (started && Date.now() - started < 10 * 60_000) {
      lastAuthError = "Google sign-in didn't come back to the app. If you added this to your home screen, try connecting from the browser tab instead.";
    }
    return;
  }
  try {
    localStorage.removeItem(STARTED_KEY);
  } catch {
    /* ignore */
  }
  try {
    const { token, expiresAt, state, error } = JSON.parse(raw) as { token?: string; expiresAt?: number; state?: string; error?: string };
    let expectedState: string | null = null;
    try {
      expectedState = localStorage.getItem(STATE_KEY);
      localStorage.removeItem(STATE_KEY);
    } catch {
      /* ignore */
    }
    if (error) {
      // access_denied is what Google returns when the account isn't on the Testing list.
      lastAuthError =
        error === 'access_denied'
          ? 'Google refused access (access_denied). While this app is in Testing, only accounts added as testers can connect.'
          : `Google refused the sign-in: ${error}`;
    } else if (!token || !expiresAt) {
      lastAuthError = 'Google returned no access token.';
    } else if (!expectedState || state !== expectedState) {
      lastAuthError = "The sign-in didn't match the request it started from. Try connecting again.";
    } else {
      writeToken({ token, expiresAt });
      setConnected(true);
    }
  } catch {
    lastAuthError = 'The sign-in response could not be read. Try connecting again.';
  }
  try {
    const returnHash = localStorage.getItem(RETURN_HASH_KEY);
    localStorage.removeItem(RETURN_HASH_KEY);
    if (returnHash) location.hash = returnHash;
  } catch {
    /* ignore */
  }
}

/** Interactive connect. Navigates the whole page to Google's consent screen and back. */
export function connect(): void {
  const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(STATE_KEY, state);
    localStorage.setItem(RETURN_HASH_KEY, location.hash);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(STARTED_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  location.href = url.toString();
}

export function disconnect(): void {
  writeToken(undefined);
  setConnected(false);
}

/** A valid access token, or throws ReconnectRequiredError if there isn't one (no silent refresh — see module docs). */
export async function getAccessToken(): Promise<string> {
  if (!isConnected()) throw new ReconnectRequiredError('Not connected to Google Drive.');
  const t = readToken();
  if (t && t.expiresAt - 60_000 > Date.now()) return t.token;
  writeToken(undefined); // expired — one tap on Reconnect gets a fresh one
  throw new ReconnectRequiredError('Google sign-in expired — tap Reconnect.');
}
