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
import { link, type LinkError } from '@fiskil/link';

// Start the consent flow
const flow = link('auth_session_id');

try {
  const result = await flow;
  console.log(result.consents);
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
| `timeoutMs`     | number | Maximum duration of the entire flow, including OTP entry. Defaults to `600000` (10 minutes). |
| `authServer`    | string | Advanced development/testing override for the authorization URL. Defaults to `https://auth.fiskil.com`. |
| `allowedOrigin` | string | Advanced development/testing override for the expected message origin. Defaults to the origin of `authServer`. |

Keep the URL and origin defaults for standard integrations.

### Result

The `LinkFlow` resolves with the success payload:

```ts
type LinkResult = {
  redirectURL?: string;
  consents: string[];
};
```

- `consents` is an array of consent ID strings. A session with one consent returns one entry. `redirectURL` is optional.
- Use webhooks to check when data is ready to fetch.
- If the flow fails, the promise rejects with a `LinkError` (see Error Handling).

### Migrating to 1.0.0

**Breaking change:** replace `result.consentID` with `result.consents` and handle each returned ID.
`redirectURL` remains optional.

Legacy completion messages are still accepted and normalised to `consents: [consentID]`.
The public result always uses `consents`.

Completion requires at least one non-blank string ID. If `consents` is present but invalid,
the SDK does not fall back to `consentID`. Invalid completion messages are ignored while
waiting for a valid result or timeout.

The SDK automatically includes its package version in the iframe URL as `sdkVersion`;
no additional configuration is required.

### Error Handling

The promise rejects with a `LinkError` if any error encountered during consent flow.

```ts
interface LinkError extends Error {
  name: 'LinkError';
  code: LinkErrorCode;
  details?: unknown;
}
```

| Error Code                          | Description                                           |
| ----------------------------------- | ------------------------------------------------------|
| `LINK_NOT_FOUND`                    | Container element not found in DOM                    |
| `LINK_TIMEOUT`                      | Flow exceeded timeout duration specified in options    |
| `LINK_USER_CANCELLED`               | User cancelled or flow was closed programmatically     |
| `LINK_ORIGIN_MISMATCH`              | A recognised Link message from the iframe has an unexpected origin; this is not a page-load or navigation check |
| `LINK_INTERNAL_ERROR`               | Unrecognized error encountered during the consent flow |
| `LINK_INVALID_SESSION`              | Legacy invalid-session error                          |
| `AUTH_SESSION_INVALID`              | Auth session is invalid or has ended                  |
| `AUTH_SESSION_CANCELLED`            | Auth session was cancelled                            |
| `CONSENT_UPSTREAM_PROCESSING_ERROR` | Upstream processing error during consent flow          |
| `CONSENT_ENDUSER_DENIED`            | User denied consent during consent flow                |
| `CONSENT_OTP_FAILURE`               | OTP verification failed during consent flow             |
| `CONSENT_ENDUSER_INELIGIBLE`        | User is ineligible for data sharing                   |
| `CONSENT_TIMEOUT`                   | Consent process timed out                             |

`AUTH_SESSION_INVALID` rejects and removes the iframe. The legacy `LINK_INVALID_SESSION`
behaviour is unchanged: it rejects but leaves the iframe mounted until `.close()` is called.

## UMD / CDN Usage

```html
<script src="https://cdn.jsdelivr.net/npm/@fiskil/link@1.0.0/dist/fiskil-link.umd.js"></script>
<script>
  const flow = FiskilLink.link('session_123');
  flow.then((res) => console.log('done', res)).catch(console.error);
  // flow.close();
</script>
```
