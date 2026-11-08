import { describe, expect, it } from 'vitest';
import { parseAuthMessage } from '../src/utils';

describe('parseAuthMessage', () => {
  it('ignores non-object payloads', () => {
    const ev = new MessageEvent('message', {
      data: 'hello',
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toBeNull();
  });

  it('parses completion', () => {
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, redirectURL: '/done', consents: ['123'] },
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'COMPLETED',
      redirectURL: '/done',
      consents: ['123'],
    });
  });

  it('parses multiple consents without a redirect URL', () => {
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, consents: ['123', '456'] },
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'COMPLETED',
      redirectURL: undefined,
      consents: ['123', '456'],
    });
  });

  it.each([
    ['empty', []],
    ['scalar', '123'],
    ['whitespace ID', ['   ']],
    ['mixed types', ['123', 456]],
    ['null', null],
    ['undefined', undefined],
    ['sparse', new Array(1)],
  ])('ignores a completion with %s consents', (_label, consents) => {
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, consents, consentID: 'legacy' },
    });
    expect(parseAuthMessage(ev)).toBeNull();
  });

  it.each([undefined, '/done'])('normalises legacy completion with redirect %s', (redirectURL) => {
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, consentID: '123', redirectURL },
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'COMPLETED', consents: ['123'], redirectURL,
    });
  });

  it.each([undefined, null, '', '  ', 123])('ignores invalid legacy ID %s', (consentID) => {
    expect(parseAuthMessage(new MessageEvent('message', {
      data: { isCompleted: true, consentID },
    }))).toBeNull();
  });

  it('prefers valid consents when both formats are present', () => {
    expect(parseAuthMessage(new MessageEvent('message', {
      data: { isCompleted: true, consents: ['new'], consentID: 'old' },
    }))).toEqual({ type: 'COMPLETED', consents: ['new'], redirectURL: undefined });
  });

  it('waits for isCompleted before returning consents', () => {
    const ev = new MessageEvent('message', {
      data: { isCompleted: false, consents: ['123'], consentID: '123' },
    });
    expect(parseAuthMessage(ev)).toBeNull();
  });

  it('keeps the error when consents are also present', () => {
    const ev = new MessageEvent('message', {
      data: {
        isCompleted: false,
        consents: ['123'],
        error: 'Cancelled',
        errorType: 'AUTH_SESSION_CANCELLED',
      },
    });
    expect(parseAuthMessage(ev)).toMatchObject({
      type: 'FAILED',
      error: 'Cancelled',
      error_type: 'AUTH_SESSION_CANCELLED',
    });
  });

  it('parses failure (flat camelCase fields)', () => {
    const ev = new MessageEvent('message', {
      data: {
        isCompleted: false,
        error: 'LINK_INVALID_SESSION',
        errorID: 'err_123',
        errorType: 'LINK_INVALID_SESSION',
        errorDescription: 'Invalid/terminal session',
        errorURI: 'https://docs/errors#LINK_INVALID_SESSION',
      },
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'FAILED',
      error: 'LINK_INVALID_SESSION',
      error_id: 'err_123',
      error_type: 'LINK_INVALID_SESSION',
      error_description: 'Invalid/terminal session',
      error_uri: 'https://docs/errors#LINK_INVALID_SESSION',
    });
  });

  it('preserves error details in a whole-URL-encoded redirect', () => {
    const params = new URLSearchParams({
      error_type: 'AUTH_SESSION_CANCELLED', error_description: 'Cancelled & retry',
    });
    const event = new MessageEvent('message', {
      data: { isCompleted: false, redirectURL: encodeURIComponent(`/cancel?${params}`) },
    });
    expect(parseAuthMessage(event)).toMatchObject({
      type: 'FAILED', error_type: 'AUTH_SESSION_CANCELLED', error_description: 'Cancelled & retry',
    });
  });

  it('parses error envelope (redirectURL with query params)', () => {
    const ev = new MessageEvent('message', {
      data: { error: 'Some error' },
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'FAILED',
      error: 'Some error',
    });
  });

  it('keeps a completion when its redirect URL only mentions an error code', () => {
    // A caller-configured callback URL; ref is not an Auth UI protocol field.
    const redirectURL = 'https://merchant.test/done?ref=CONSENT_TIMEOUT';
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, consents: ['123'], redirectURL },
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'COMPLETED',
      consents: ['123'],
      redirectURL,
    });
  });

  it('still fails an incomplete message when its redirect URL mentions an error code', () => {
    const ev = new MessageEvent('message', {
      data: { isCompleted: false, redirectURL: 'https://merchant.test/done?ref=CONSENT_TIMEOUT' },
    });
    expect(parseAuthMessage(ev)).toEqual({ type: 'FAILED', error: 'CONSENT_TIMEOUT' });
  });

  it.each([
    ['/cancel?error=access_denied&error_description=CONSENT_TIMEOUT', 'access_denied', undefined],
    ['/cancel?error_type=NEW_PROVIDER_ERROR&error_uri=https%3A%2F%2Fdocs.example.test%2FCONSENT_TIMEOUT', 'NEW_PROVIDER_ERROR', 'NEW_PROVIDER_ERROR'],
    ['https://merchant.test/cancel?error=access_denied', 'access_denied', undefined],
    ['/cancel?error_type=NEW_PROVIDER_ERROR', 'NEW_PROVIDER_ERROR', 'NEW_PROVIDER_ERROR'],
    [encodeURIComponent('/cancel?error_type=NEW_PROVIDER_ERROR'), 'NEW_PROVIDER_ERROR', 'NEW_PROVIDER_ERROR'],
  ])('preserves explicit redirect errors in %s regardless of completion', (redirectURL, error, error_type) => {
    for (const isCompleted of [false, true]) {
      expect(parseAuthMessage(new MessageEvent('message', {
        data: { isCompleted, consents: ['123'], redirectURL },
      }))).toMatchObject({ type: 'FAILED', error, error_type });
    }
  });

  it('preserves metadata-only redirect handling without introducing new failures', () => {
    for (const isCompleted of [false, true]) {
      const redirectURL = '/done?error_description=previous+attempt';
      expect(parseAuthMessage(new MessageEvent('message', {
        data: { isCompleted, consents: ['123'], redirectURL },
      }))).toEqual(isCompleted ? { type: 'COMPLETED', consents: ['123'], redirectURL } : null);
      expect(parseAuthMessage(new MessageEvent('message', {
        data: { isCompleted, consents: ['123'], redirectURL: '/cancel?error_description=CONSENT_TIMEOUT' },
      }))).toMatchObject({ type: 'FAILED', error_description: 'CONSENT_TIMEOUT' });
    }
  });

  it('does not treat empty error parameters as explicit failures', () => {
    const redirectURL = '/done?ref=CONSENT_TIMEOUT&error=&error_type=';
    expect(parseAuthMessage(new MessageEvent('message', {
      data: { isCompleted: true, consents: ['123'], redirectURL },
    }))).toEqual({ type: 'COMPLETED', consents: ['123'], redirectURL });
  });

  it('treats isCompleted=true with consent error params in redirectURL as failure', () => {
    const url =
      'https://auth.fiskil.com/cancel?error=access_denied&error_description=End-user+denied+consent+during+authorisation+inside+remote+institution.+The+end-user+should+retry+the+authorisation+and+complete+the+institution+consent+flow.&error_id=err_ce4c9fa8-4d79-4a5c-8769-8e82833bbed1&error_type=CONSENT_ENDUSER_DENIED&error_uri=https%3A%2F%2Fdata.docs.fiskil.dev%2Ferrors%23CONSENT_ENDUSER_DENIED';
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, redirectURL: url, consents: ['123'] },
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'FAILED',
      error: 'CONSENT_ENDUSER_DENIED',
      error_type: 'CONSENT_ENDUSER_DENIED',
      error_id: 'err_ce4c9fa8-4d79-4a5c-8769-8e82833bbed1',
      error_description:
        'End-user denied consent during authorisation inside remote institution. The end-user should retry the authorisation and complete the institution consent flow.',
      error_uri: 'https://data.docs.fiskil.dev/errors#CONSENT_ENDUSER_DENIED',
    });
  });
});
