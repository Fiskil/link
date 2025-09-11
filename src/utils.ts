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
  error_type?: LinkErrorCode;
  error_description?: string;
  error_uri?: string;
} | null {
  try {
    const normalized = decodeUrlIfEncoded(url);
    const u = new URL(normalized);
    const err = u.searchParams.get('error') ?? undefined;
    const error_type = u.searchParams.get('error_type') as LinkErrorCode | null;
    const error_id = u.searchParams.get('error_id') ?? undefined;
    const error_description =
      u.searchParams.get('error_description') ?? undefined;
    const error_uri = u.searchParams.get('error_uri') ?? undefined;
    if (error_type || err || error_id || error_description || error_uri) {
      return {
        error: (error_type as string) || err || 'Unknown error',
        error_type: (error_type ?? undefined) as LinkErrorCode | undefined,
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
      consentID?: string;
    }
  | {
      type: 'FAILED';
      error: string;
      error_id?: string;
      error_type?: LinkErrorCode;
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
    consentID?: string;
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
        error_type: errorType as LinkErrorCode | undefined,
        error_description: errorDescription ?? undefined,
        error_uri: errorURI ?? undefined,
      };
    }

    // Check if redirect URL contains error params
    if (redirectURL) {
      const match = redirectURL.match(fiskilErrorPattern);
      if (match) {
        const details = extractErrorParams(redirectURL);
        if (details) return { type: 'FAILED', ...details };
        return { type: 'FAILED', error: match[0] };
      }
    }

    // Check if completion params are present
    if (data.isCompleted === true && consentID) {
      return {
        type: 'COMPLETED',
        redirectURL: redirectURL,
        consentID: consentID,
      };
    }
  }

  if (typeof data.error === 'string') {
    return { type: 'FAILED', error: data.error };
  }

  return null;
}
