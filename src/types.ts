export const fiskilErrors = [
  'CONSENT_UPSTREAM_PROCESSING_ERROR',
  'CONSENT_ENDUSER_DENIED',
  'CONSENT_OTP_FAILURE',
  'CONSENT_ENDUSER_INELIGIBLE',
  'CONSENT_TIMEOUT',
  'CONSUMERDATA_PROCESSING_ERROR',
  'AUTH_SESSION_NOT_FOUND',
  'AUTH_SESSION_TERMINAL',
] as const;

export type ConsentErrorType = (typeof fiskilErrors)[number];

export type LinkErrorCode =
  | 'LINK_NOT_FOUND'
  | 'LINK_TIMEOUT'
  | 'LINK_USER_CANCELLED'
  | 'LINK_ORIGIN_MISMATCH'
  | 'LINK_UNKNOWN_MESSAGE'
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

export type LinkOptions = {
  containerId?: string;
  allowedOrigin?: string;
  authServer?: string;
  timeoutMs?: number;
};

export type LinkFlow = Promise<LinkResult> & {
  close(): void;
};
