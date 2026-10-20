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
const STATE_KEY = 'gdrive-oauth-state';
const RETURN_HASH_KEY = 'gdrive-oauth-return-hash';
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
  if (!raw) return;
  try {
    const { token, expiresAt, state, error } = JSON.parse(raw) as { token?: string; expiresAt?: number; state?: string; error?: string };
    let expectedState: string | null = null;
    try {
      expectedState = sessionStorage.getItem(STATE_KEY);
      sessionStorage.removeItem(STATE_KEY);
    } catch {
      /* ignore */
    }
    if (!error && token && expiresAt && expectedState && state === expectedState) {
      writeToken({ token, expiresAt });
      setConnected(true);
    }
  } catch {
    /* malformed payload — ignore, stay disconnected */
  }
  try {
    const returnHash = sessionStorage.getItem(RETURN_HASH_KEY);
    sessionStorage.removeItem(RETURN_HASH_KEY);
    if (returnHash) location.hash = returnHash;
  } catch {
    /* ignore */
  }
}

/** Interactive connect. Navigates the whole page to Google's consent screen and back. */
export function connect(): void {
  const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_HASH_KEY, location.hash);
  } catch {
    /* ignore */
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
