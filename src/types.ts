export const fiskilErrors = [
  'CONSENT_UPSTREAM_PROCESSING_ERROR',
  'CONSENT_ENDUSER_DENIED',
  'CONSENT_OTP_FAILURE',
  'CONSENT_ENDUSER_INELIGIBLE',
  'CONSENT_TIMEOUT',
  'CONSUMERDATA_PROCESSING_ERROR',
] as const;

export type ConsentErrorType = (typeof fiskilErrors)[number];

export type LinkErrorCode =
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'IFRAME_USER_CANCELLED'
  | 'IFRAME_ORIGIN_MISMATCH'
  | 'IFRAME_UNKNOWN_MESSAGE'
  | ConsentErrorType;

export interface LinkError extends Error {
  name: 'LinkError';
  code: LinkErrorCode;
  details?: unknown;
}

export type LinkResult =
  | { type: 'COMPLETED'; redirectURL?: string; consentID?: string }
  | {
      type: 'FAILED';
      error: string;
      error_id?: string;
      error_type?: ConsentErrorType;
      error_description?: string;
      error_uri?: string;
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
