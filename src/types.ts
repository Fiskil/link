export const fiskilErrors = [
  'CONSENT_UPSTREAM_PROCESSING_ERROR',
  'CONSENT_ENDUSER_DENIED',
  'CONSENT_OTP_FAILURE',
  'CONSENT_ENDUSER_INELIGIBLE',
  'CONSENT_TIMEOUT',
  'AUTH_SESSION_CANCELLED',
  'AUTH_SESSION_INVALID',
] as const;

export type ConsentErrorType = (typeof fiskilErrors)[number];

export type LinkErrorCode =
  | 'LINK_NOT_FOUND'
  | 'LINK_TIMEOUT'
  | 'LINK_USER_CANCELLED'
  | 'LINK_ORIGIN_MISMATCH'
  | 'LINK_INTERNAL_ERROR'
  | 'LINK_INVALID_SESSION'
  | ConsentErrorType;

export interface LinkError extends Error {
  name: 'LinkError';
  code: LinkErrorCode;
  details?: unknown;
}

export type LinkResult = {
  redirectURL?: string;
  consents: string[];
};

// Options for customising the link behaviour
export type LinkOptions = {
  /**
   * Advanced SDK development/testing override for the expected message origin.
   * Defaults to the origin of authServer.
   */
  allowedOrigin?: string;
  /**
   * Advanced SDK development/testing override for the authorization URL.
   * Defaults to https://auth.fiskil.com.
   */
  authServer?: string;
  /**
   * Maximum duration of the entire flow, including OTP entry, in milliseconds.
   * Defaults to 600000 (10 minutes).
   */
  timeoutMs?: number;
};

export type LinkFlow = Promise<LinkResult> & {
  close(): void;
};
