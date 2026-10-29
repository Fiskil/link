// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { version } from '../package.json';
import { link, type LinkErrorCode, type LinkFlow, type LinkOptions } from '../src';

const flows: LinkFlow[] = [];
const frame = () => document.querySelector<HTMLIFrameElement>('iframe[data-fiskil-link-iframe]')!;

function start(options?: LinkOptions, sessionId = 'session_123') {
  const flow = link(sessionId, options);
  flows.push(flow);
  void flow.catch(() => {});
  return flow;
}

function post(data: unknown, origin = 'https://auth.fiskil.com', source = frame().contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
}

beforeEach(() => vi.stubGlobal('__SDK_VERSION__', version));
afterEach(async () => {
  flows.forEach(flow => flow.close());
  await Promise.allSettled(flows.splice(0));
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('link', () => {
  it('includes the package version and encodes the session ID', () => {
    start(undefined, 'session &?+#');
    const url = new URL(frame().src);
    expect(url.origin).toBe('https://auth.fiskil.com');
    expect(url.searchParams.get('sess_id')).toBe('session &?+#');
    expect(url.searchParams.get('sdkVersion')).toBe(version);
  });

  it('preserves custom paths, parameters and fragments, replacing reserved parameters', () => {
    start({ authServer: 'https://auth.example.test/connect?theme=dark&sess_id=old&sess_id=older&sdkVersion=0&sdkVersion=1#start' });
    const url = new URL(frame().src);
    expect(url.origin).toBe('https://auth.example.test');
    expect(url.pathname).toBe('/connect');
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.hash).toBe('#start');
    expect(url.searchParams.getAll('sess_id')).toEqual(['session_123']);
    expect(url.searchParams.getAll('sdkVersion')).toEqual([version]);
  });

  it.each([
    { payload: { consentID: '123' }, consents: ['123'] },
    { payload: { consents: ['123'] }, consents: ['123'] },
    { payload: { consents: ['123', '456'] }, consents: ['123', '456'] },
  ])('returns a consistent result for $payload', async ({ payload, consents }) => {
    const flow = start();
    post({ isCompleted: true, redirectURL: '/done', ...payload });
    await expect(flow).resolves.toEqual({ redirectURL: '/done', consents });
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it('ignores completion messages from another window and still times out', async () => {
    vi.useFakeTimers();
    const flow = start({ timeoutMs: 100 });
    post({ isCompleted: true, consents: ['123'] }, 'https://auth.fiskil.com', window);
    await vi.advanceTimersByTimeAsync(100);
    await expect(flow).rejects.toMatchObject({ code: 'LINK_TIMEOUT' });
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it('rejects completion from an unexpected origin', async () => {
    const flow = start();
    post({ isCompleted: true, consents: ['123'] }, 'https://other.example.test');
    await expect(flow).rejects.toMatchObject({ code: 'LINK_ORIGIN_MISMATCH' });
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it('closes a pending flow', async () => {
    const flow = start();
    flow.close();
    await expect(flow).rejects.toMatchObject({ code: 'LINK_USER_CANCELLED' });
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it('rejects a relative cancellation URL with its original error code and details', async () => {
    const flow = start();
    const params = new URLSearchParams({
      error_type: 'AUTH_SESSION_CANCELLED',
      error_id: 'id+1',
      error_description: 'Cancelled & retry',
    });
    post({ isCompleted: false, redirectURL: `/cancel?${params}` });
    await expect(flow).rejects.toMatchObject({
      code: 'AUTH_SESSION_CANCELLED',
      details: { error_id: 'id+1', error_description: 'Cancelled & retry' },
    });
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it.each(['flat', 'redirect'] as const)('closes after a %s AUTH_SESSION_INVALID error', async format => {
    const code: LinkErrorCode = 'AUTH_SESSION_INVALID';
    const flow = start({ timeoutMs: 100 });
    post({
      isCompleted: false,
      ...(format === 'flat'
        ? { error: 'Invalid session', errorType: code }
        : { redirectURL: `/cancel?error_type=${code}` }),
    });
    await expect(flow).rejects.toMatchObject({ code });
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it('closes an invalid-session frame after the promise has rejected', async () => {
    const flow = start();
    const retained = frame();
    post({ isCompleted: false, error: 'Invalid session', errorType: 'LINK_INVALID_SESSION' });
    await expect(flow).rejects.toMatchObject({ code: 'LINK_INVALID_SESSION' });
    expect(retained.isConnected).toBe(true);
    flow.close();
    flow.close();
    expect(retained.isConnected).toBe(false);
    expect(document.getElementById('fiskil-link-overlay')).toBeNull();
  });

  it.each(['pending', 'rejected', 'settled'] as const)(
    'does not remove a newer flow when closing an older %s flow',
    async state => {
      const previous = start();
      if (state !== 'pending') {
        post({ isCompleted: false, error: 'Invalid session', errorType: 'LINK_INVALID_SESSION' });
        if (state === 'settled') {
          await expect(previous).rejects.toMatchObject({ code: 'LINK_INVALID_SESSION' });
        }
      }
      const next = start();
      const current = frame();
      previous.close();
      await expect(previous).rejects.toMatchObject({
        code: state === 'pending' ? 'LINK_USER_CANCELLED' : 'LINK_INVALID_SESSION',
      });
      expect(current.isConnected).toBe(true);
      post({ isCompleted: true, consents: ['456'] });
      await expect(next).resolves.toEqual({ consents: ['456'], redirectURL: undefined });
      expect(document.getElementById('fiskil-link-overlay')).toBeNull();
    }
  );
});
