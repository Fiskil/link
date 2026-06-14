export const fiskilErrors = [
  'CONSENT_UPSTREAM_PROCESSING_ERROR',
  'CONSENT_ENDUSER_DENIED',
  'CONSENT_OTP_FAILURE',
  'CONSENT_ENDUSER_INELIGIBLE',
  'CONSENT_TIMEOUT',
  'AUTH_SESSION_CANCELLED',
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
  consentID?: string;
};

// Options for customising the link behaviour
export type LinkOptions = {
  /**
  * Origin to allow for incoming iframe messages. Should not be changed unless
  * you are modifying \@fiskil/link itself
  */
  allowedOrigin?: string;
  /**
  * The Fiskil authorization server. Should not be changed unless you are
  * modifying \@fiskil/link itself
  */
  authServer?: string;
  /**
  * Maximum amount of time to allow for the end-user's authentication
  */
  timeoutMs?: number;
};

export type LinkFlow = Promise<LinkResult> & {
  close(): void;
};
