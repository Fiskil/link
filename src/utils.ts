import type {
  LinkErrorCode,
  ConsentErrorType,
  LinkError,
  LinkResult,
} from './types';
import { fiskilErrors } from './types';

export function flError(
  code: LinkErrorCode,
  message: string,
  extra?: Partial<LinkError>
): LinkError {
  const err = new Error(message) as LinkError;
  err.name = 'LinkError';
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

// Precompiled matcher for faster detection in redirect URLs
const fiskilErrorPattern = new RegExp(fiskilErrors.join('|'));

function decodeUrlIfEncoded(input: string): string {
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(input);
  if (hasScheme) return input;
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function extractErrorParams(url: string): {
  error: string;
  error_id?: string;
  error_type?: ConsentErrorType;
  error_description?: string;
  error_uri?: string;
} | null {
  try {
    const normalized = decodeUrlIfEncoded(url);
    const u = new URL(normalized);
    const err = u.searchParams.get('error') ?? undefined;
    const error_type = u.searchParams.get(
      'error_type'
    ) as ConsentErrorType | null;
    const error_id = u.searchParams.get('error_id') ?? undefined;
    const error_description =
      u.searchParams.get('error_description') ?? undefined;
    const error_uri = u.searchParams.get('error_uri') ?? undefined;
    if (error_type || err || error_id || error_description || error_uri) {
      return {
        error: (error_type as string) || err || 'Unknown error',
        error_type: (error_type ?? undefined) as ConsentErrorType | undefined,
        error_id,
        error_description,
        error_uri,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseAuthMessage(event: MessageEvent): LinkResult | null {
  const data: any = event.data;

  if (!data || typeof data !== 'object') return null;

  if ('isCompleted' in data) {
    const redirect: string | undefined = data.redirectURL;
    console.log('redirect', redirect);
    if (redirect) {
      const match = redirect.match(fiskilErrorPattern);
      if (match) {
        const details = extractErrorParams(redirect);
        if (details) return { type: 'FAILED', ...details };
        return { type: 'FAILED', error: match[0] };
      }
    }

    if (data.isCompleted === true) {
      return {
        type: 'COMPLETED',
        redirectURL: data.redirectURL,
        consentID: data.arrangementID,
      };
    }

    if (data.isCompleted === false) {
      return {
        type: 'FAILED',
        error: typeof data.error === 'string' ? data.error : 'User cancelled',
      };
    }
  }

  if (typeof data.error === 'string')
    return { type: 'FAILED', error: data.error };

  return null;
}
