import type { LinkErrorCode, ConsentErrorType, LinkError } from './types';
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
  // Preserve query escaping; decode only whole-URL encodings.
  if (hasScheme || input.includes('?')) return input;
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function extractErrorParams(url: string, allowMetadataOnly: boolean): {
  error: string;
  error_id?: string;
  error_type?: string;
  error_description?: string;
  error_uri?: string;
} | null {
  try {
    const normalized = decodeUrlIfEncoded(url);
    const u = new URL(normalized, 'https://auth.fiskil.com');
    const err = u.searchParams.get('error') ?? undefined;
    const error_type = u.searchParams.get('error_type');
    const error_id = u.searchParams.get('error_id') ?? undefined;
    const error_description =
      u.searchParams.get('error_description') ?? undefined;
    const error_uri = u.searchParams.get('error_uri') ?? undefined;
    if (error_type || err || (allowMetadataOnly && (error_id || error_description || error_uri))) {
      return {
        error: error_type || err || 'Unknown error',
        error_type: error_type ?? undefined,
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

export type ParsedAuthMessage =
  | {
      type: 'COMPLETED';
      redirectURL?: string;
      consents: string[];
    }
  | {
      type: 'FAILED';
      error: string;
      error_id?: string;
      error_type?: string;
      error_description?: string;
      error_uri?: string;
    };

export function parseAuthMessage(
  event: MessageEvent
): ParsedAuthMessage | null {
  const data: {
    error?: string;
    errorID?: string;
    errorType?: string;
    errorDescription?: string;
    errorURI?: string;
    redirectURL?: string;
    consents?: unknown;
    consentID?: unknown;
    isCompleted: boolean;
  } = event.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('isCompleted' in data) {
    const {
      error,
      errorID,
      errorType,
      errorDescription,
      errorURI,
      redirectURL,
      consents,
      consentID,
    } = data;

    // Check if flattened error params are present
    if (
      data.isCompleted === false &&
      (error || errorID || errorType || errorDescription || errorURI)
    ) {
      return {
        type: 'FAILED',
        error: error ?? 'internal error',
        error_id: errorID ?? undefined,
        error_type: errorType,
        error_description: errorDescription ?? undefined,
        error_uri: errorURI ?? undefined,
      };
    }

    // Check if redirect URL contains error params
    if (redirectURL) {
      const match = redirectURL.match(fiskilErrorPattern);
      // Explicit error/error_type values take precedence, even if unknown.
      // Preserve legacy metadata-only detection without broadening it.
      const details = extractErrorParams(redirectURL, Boolean(match));
      if (details) return { type: 'FAILED', ...details };
      // Incidental code text must not override a valid completion.
      if (match && data.isCompleted !== true) {
        return { type: 'FAILED', error: match[0] };
      }
    }

    // A present but malformed new-format field must never fall back to legacy.
    if (data.isCompleted === true) {
      if ('consents' in data) {
        if (
          Array.isArray(consents) &&
          consents.length > 0 &&
          Array.from(consents).every(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        ) {
          return { type: 'COMPLETED', redirectURL, consents };
        }
      } else if (typeof consentID === 'string' && consentID.trim().length > 0) {
        return { type: 'COMPLETED', redirectURL, consents: [consentID] };
      }
      // The consent page sends this message once, so waiting could never succeed.
      if (typeof data.error !== 'string') {
        return {
          type: 'FAILED',
          error: 'invalid_completion',
          error_description: 'Completion message had no valid consent IDs',
        };
      }
    }
  }

  if (typeof data.error === 'string') {
    return { type: 'FAILED', error: data.error };
  }

  return null;
}
