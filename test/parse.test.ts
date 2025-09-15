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
      data: { isCompleted: true, redirectURL: '/done', consentID: '123' },
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'COMPLETED',
      redirectURL: '/done',
      consentID: '123',
    });
  });

  it('parses failure (flat camelCase fields)', () => {
    const ev = new MessageEvent('message', {
      data: {
        isCompleted: false,
        error: 'AUTH_SESSION_INVALID',
        errorID: 'err_123',
        errorType: 'AUTH_SESSION_INVALID',
        errorDescription: 'Invalid/terminal session',
        errorURI: 'https://docs/errors#LINK_INVALID_SESSION',
      },
      origin: 'https://good.com',
    });
    expect(parseAuthMessage(ev)).toEqual({
      type: 'FAILED',
      error: 'AUTH_SESSION_INVALID',
      error_id: 'err_123',
      error_type: 'AUTH_SESSION_INVALID',
      error_description: 'Invalid/terminal session',
      error_uri: 'https://docs/errors#LINK_INVALID_SESSION',
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

  // string URL cases removed: parser now only accepts object payloads

  it('treats isCompleted=true with consent error params in redirectURL as failure', () => {
    const url =
      'https://auth.fiskil.com/cancel?error=access_denied&error_description=End-user+denied+consent+during+authorisation+inside+remote+institution.+The+end-user+should+retry+the+authorisation+and+complete+the+institution+consent+flow.&error_id=err_ce4c9fa8-4d79-4a5c-8769-8e82833bbed1&error_type=CONSENT_ENDUSER_DENIED&error_uri=https%3A%2F%2Fdata.docs.fiskil.dev%2Ferrors%23CONSENT_ENDUSER_DENIED';
    const ev = new MessageEvent('message', {
      data: { isCompleted: true, redirectURL: url, consentID: undefined },
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
