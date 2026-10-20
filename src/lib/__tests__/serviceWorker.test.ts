// public/sw.js is a plain static file: it is not bundled, typechecked or imported by the app,
// so nothing else here would catch a mistake in it. It gets loaded into a fake worker global
// and its fetch handler driven directly.
import { describe, expect, it, vi } from 'vitest';

const SOURCE = Object.values(import.meta.glob('../../../public/sw.js', { query: '?raw', import: 'default', eager: true }))[0] as string;

interface FetchEvent {
  request: { method: string; url: string; mode: string };
  respondWith: (r: unknown) => void;
}

/** Loads sw.js with stubbed worker globals and returns its handlers plus the cache it wrote to. */
function loadWorker(networkFails = false) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const put = vi.fn(() => Promise.resolve());
  const match = vi.fn(() => Promise.resolve('cached-shell'));
  const self = { addEventListener: (type: string, fn: (e: unknown) => void) => void (handlers[type] = fn), skipWaiting: vi.fn(), clients: { claim: vi.fn() } };
  const caches = { open: () => Promise.resolve({ addAll: vi.fn(() => Promise.resolve()), put }), keys: () => Promise.resolve([]), delete: vi.fn(), match };
  const fetchStub = vi.fn(() => (networkFails ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, clone: () => 'body' })));
  const location = { origin: 'https://diogocosta408.github.io' };
  new Function('self', 'caches', 'fetch', 'location', SOURCE)(self, caches, fetchStub, location);
  return { handlers, put, match, fetchStub };
}

function navigateTo(url: string) {
  const event: FetchEvent & { responded: boolean } = {
    request: { method: 'GET', url, mode: 'navigate' },
    respondWith: () => void (event.responded = true),
    responded: false,
  };
  return event;
}

describe('service worker', () => {
  it('caches the app shell on navigation', async () => {
    const { handlers, put } = loadWorker();
    handlers.fetch(navigateTo('https://diogocosta408.github.io/strength-tracker/'));
    await vi.waitFor(() => expect(put).toHaveBeenCalledWith('./index.html', 'body'));
  });

  // The regression: v1 stored EVERY navigation under the shell key, so returning from Google
  // left oauth-callback.html standing in for the whole app on the next failed navigation.
  it('never caches the OAuth callback, and leaves it to the network', async () => {
    const { handlers, put, fetchStub } = loadWorker();
    const event = navigateTo('https://diogocosta408.github.io/strength-tracker/oauth-callback.html');
    handlers.fetch(event);
    expect(event.responded).toBe(false); // not intercepted at all
    expect(fetchStub).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(put).not.toHaveBeenCalled();
  });

  it('falls back to the cached shell when a navigation cannot reach the network', async () => {
    const { handlers, match } = loadWorker(true);
    handlers.fetch(navigateTo('https://diogocosta408.github.io/strength-tracker/index.html'));
    await vi.waitFor(() => expect(match).toHaveBeenCalledWith('./index.html'));
  });

  it('ignores cross-origin and non-GET requests so API calls are untouched', () => {
    const { handlers, fetchStub } = loadWorker();
    for (const request of [
      { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/x:streamGenerateContent', mode: 'cors' },
      { method: 'GET', url: 'https://www.googleapis.com/drive/v3/files', mode: 'cors' },
    ]) {
      const event = { request, respondWith: () => expect.fail(`intercepted ${request.url}`) };
      handlers.fetch(event);
    }
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('bumps the cache name past v1 so the poisoned shell is evicted on update', () => {
    expect(SOURCE).not.toMatch(/strength-tracker-v1/);
  });
});
