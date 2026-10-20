import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveModel } from '../coachAi';

/**
 * The model isn't pinned: Google renames and retires these, so it's resolved against what
 * the key can actually reach. These cover the picking rules and the offline fallback.
 */
const listing = (...names: string[]) => ({
  ok: true,
  json: async () => ({ models: names.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) }),
});

describe('resolveModel', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* no storage in this environment — resolveModel re-resolves each time */
    }
  });

  afterEach(() => vi.unstubAllGlobals());

  it('prefers the newest listed model from the preference order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => listing('gemini-2.0-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash')));
    expect(await resolveModel('k')).toBe('gemini-3.5-flash-lite');
  });

  it('falls back to any flash model when none of the preferred ones exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => listing('gemini-9-pro', 'gemini-9-flash')));
    expect(await resolveModel('k')).toBe('gemini-9-flash');
  });

  it('skips models that cannot hold a conversation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => listing('text-embedding-004', 'gemini-tts-1', 'gemini-9-pro')));
    expect(await resolveModel('k')).toBe('gemini-9-pro');
  });

  it('ignores models that do not support generateContent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          models: [
            { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['embedContent'] },
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          ],
        }),
      })),
    );
    expect(await resolveModel('k')).toBe('gemini-2.5-flash');
  });

  it('falls back to the first preferred id when the listing fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await resolveModel('k')).toBe('gemini-3.5-flash-lite');
  });

  it('falls back when the network is unavailable entirely', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    expect(await resolveModel('k')).toBe('gemini-3.5-flash-lite');
  });

  it('sends the key to the models endpoint', async () => {
    const fetchMock = vi.fn(async (url: string) => listing('gemini-2.5-flash') && { ...listing('gemini-2.5-flash'), url });
    vi.stubGlobal('fetch', fetchMock);
    await resolveModel('secret-key');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('key=secret-key');
  });
});
