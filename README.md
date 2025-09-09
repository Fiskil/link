## Fiskil Link SDK (`@fiskil/link`)

[![Tests](https://github.com/fiskil/link-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/fiskil/link-sdk/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@fiskil/link.svg)](https://www.npmjs.com/package/@fiskil/link)

The Fiskil Link SDK (@fiskil/link) makes it easy to embed a [Fiskil Auth Session](https://docs.fiskil.com/auth-session) inside your web application. An *Auth Session* is how end-users connect their bank or financial institution to share Consumer Data Right (CDR) data through the Fiskil platform.

This SDK handles the complete consent process and returns the outcome of the data sharing process - and you only need to provide a Fiskil `auth_session_id` to initiate and handle the result in your app. Once the user approves CDR sharing, your backend can listen for [Fiskil webhooks](https://docs.fiskil.com/guide/core-concepts/webhooks) and then begin fetching CDR data through Fiskil’s [Banking](https://docs.fiskil.com/banking/introduction) or [Energy](https://docs.fiskil.com/energy/introduction) APIs.

## Installation

Install the package with your preferred package manager:

```bash
npm i @fiskil/link
# or
pnpm add @fiskil/link
```

## Quick start (ESM/TypeScript)

Note that to use this SDK, you’ll need a Fiskil team account. If you don't have an account, you can [get in touch](https://www.fiskil.com/contact) for a quick demo. If you’re new to Fiskil platform, start with the [Quick Start Guide](https://docs.fiskil.com/guide/getting-started/quick-start).

Before launching the consent flow, your backend must [create an Auth Session](https://docs.fiskil.com/auth-session#create-auth-session) through the Fiskil API. Pass the resulting `auth_session_id` into the SDK to start the flow in your application.

```ts
import { link } from '@fiskil/link';

// Start the consent flow
const flow = link('auth_session_id', {
  containerId: 'link-container',
});

try {
  const result = await flow;
  console.log(result.consentID);
} catch (err) {
  const linkError = err as LinkError;
  console.log('Link Error code:', linkError.code);
} 

// to cancel the consent flow programmatically
// flow.close();
```

## API Reference

### `link(sessionId, options?)`

Creates and mounts the consent UI element. Returns a **`LinkFlow`** object, which is both:

- a `Promise` that resolves with the flow result, and
- a controller with `.close()` to cancel the flow programmatically.

| Option          | Type   | Description  |
| --------------- | ------ | --------------------------- |
| `containerId`   | string | DOM element ID to mount Fiskil auth UI into. If omitted, the SDK creates a full-viewport overlay. |
| `allowedOrigin` | string | Restrict postMessage origin (recommended in production).                                          |                      |
| `timeoutMs`     | number | Rejects if no message received within this time. defaults to `600000` (10 min)                    |

### Result

The `LinkFlow` resolves with the success payload:

```ts
type LinkResult = {
  redirectURL?: string;
  consentID?: string;
};
```

- Resolved result includes `redirectURL` (as configured) and a `consentID` which can be used to fetch user data from fiskil platform.
- On failure, the promise rejects with a `LinkError` (see Error Handling).

### Error Handling

The promise rejects with a `LinkError` if any error encountered during consent flow.

```ts
interface LinkError extends Error {
  name: 'LinkError';
  code: LinkErrorCode;
  details?: unknown;
}
```

| Error Code                          | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `LINK_NOT_FOUND`                    | Container element not found in DOM                  |
| `LINK_TIMEOUT`                      | Flow exceeded timeout duration specified in options  |
| `LINK_USER_CANCELLED`               | User cancelled or flow was closed programmatically   |
| `LINK_ORIGIN_MISMATCH`              | Message received from unexpected origin             |
| `LINK_UNKNOWN_MESSAGE`              | Received unrecognized message format                |
| `CONSENT_UPSTREAM_PROCESSING_ERROR` | Upstream processing error during consent flow        |
| `CONSENT_ENDUSER_DENIED`            | User denied consent during consent flow              |
| `CONSENT_OTP_FAILURE`               | OTP verification failed during consent flow           |
| `CONSENT_ENDUSER_INELIGIBLE`        | User is ineligible for data sharing                 |
| `CONSENT_TIMEOUT`                   | Consent process timed out                           |
| `CONSUMERDATA_PROCESSING_ERROR`     | Error processing consumer data                      |
| `AUTH_SESSION_NOT_FOUND`            | Specified auth session not found                     |
| `AUTH_SESSION_TERMINAL`             | Specified auth session has already ended             |

Note: For `AUTH_SESSION_NOT_FOUND` and `AUTH_SESSION_TERMINAL`, the iframe remains mounted. You can close it programmatically with `.close()`.

## UMD / CDN Usage

```html
<script src="https://cdn.jsdelivr.net/npm/@fiskil/link@0.1.5-beta/dist/fiskil-link.umd.js"></script>
<script>
  const flow = FiskilLink.link('session_123', { containerId: 'connect' });
  flow.then((res) => console.log('done', res)).catch(console.error);
  // flow.close();
</script>
```

## Additional Notes

- The SDK creates a high `z-index` overlay when no `containerId` is provided.
- The iframe `src` is controlled by the SDK and cannot be overridden via `iframe` options.
- All public types are re-exported from the package entry for a single stable import surface.
