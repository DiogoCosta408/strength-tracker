// Google Identity Services (GIS) token-client wrapper, scoped to Drive's appDataFolder.
// This is a pure browser OAuth flow: there's no backend to hold a client secret, so it
// can't use a durable refresh token. Instead it re-requests a token silently
// (`prompt: ''`) when the cached one is near expiry, which works as long as this browser
// still has an active Google session and the grant hasn't been revoked. When it can't,
// getAccessToken() throws ReconnectRequiredError so the UI can ask for a fresh, explicit
// "Connect" click (required — GIS needs a user gesture to show its consent popup).

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const CONNECTED_KEY = 'gdrive-connected';
const TOKEN_SAFETY_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

export class ReconnectRequiredError extends Error {
  constructor(message = 'Reconnect to Google Drive to keep syncing.') {
    super(message);
    this.name = 'ReconnectRequiredError';
  }
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

let scriptPromise: Promise<void> | undefined;
function loadScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google Identity Services.'));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('VITE_GOOGLE_CLIENT_ID is not set. See README → Cloud sync setup.');
  return id;
}

let client: TokenClient | undefined;
let cachedToken: { token: string; expiresAt: number } | undefined;
let pending: { resolve: (token: string) => void; reject: (err: unknown) => void } | undefined;

async function ensureClient(): Promise<TokenClient> {
  await loadScript();
  if (!client) {
    client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      callback: (resp) => {
        const p = pending;
        pending = undefined;
        if (!p) return;
        if (resp.error || !resp.access_token) {
          p.reject(new ReconnectRequiredError());
          return;
        }
        cachedToken = { token: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 };
        p.resolve(resp.access_token);
      },
      error_callback: (err) => {
        const p = pending;
        pending = undefined;
        p?.reject(new ReconnectRequiredError(err?.message));
      },
    });
  }
  return client;
}

function requestToken(overrides?: { prompt?: string }): Promise<string> {
  return ensureClient().then(
    (c) =>
      new Promise<string>((resolve, reject) => {
        if (pending) {
          reject(new Error('A Google Drive sign-in is already in progress.'));
          return;
        }
        const timeout = setTimeout(() => {
          pending = undefined;
          reject(new ReconnectRequiredError());
        }, REQUEST_TIMEOUT_MS);
        pending = {
          resolve: (token) => {
            clearTimeout(timeout);
            resolve(token);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        };
        c.requestAccessToken(overrides);
      }),
  );
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

/** Interactive connect. Must run from a user gesture (e.g. a button's onClick) — shows Google's consent popup. */
export async function connect(): Promise<void> {
  await requestToken();
  setConnected(true);
}

export function disconnect(): void {
  if (cachedToken) window.google?.accounts.oauth2.revoke(cachedToken.token);
  cachedToken = undefined;
  client = undefined;
  setConnected(false);
}

/** A valid access token, refreshed silently if the cached one is near expiry. Never persisted to disk. */
export async function getAccessToken(): Promise<string> {
  if (!isConnected()) throw new ReconnectRequiredError('Not connected to Google Drive.');
  if (cachedToken && cachedToken.expiresAt - TOKEN_SAFETY_MARGIN_MS > Date.now()) return cachedToken.token;
  return requestToken({ prompt: '' });
}
