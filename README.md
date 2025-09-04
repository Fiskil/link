## Fiskil Link SDK (`@fiskil/link`)

Minimal, strictly-typed SDK to embed Fiskil Link via an iframe. Promise-based API. Ships ESM and UMD builds.

## Install

```bash
npm i @fiskil/link
# or
pnpm add @fiskil/link
```

## Quick start (ESM/TypeScript)

```ts
import { link } from '@fiskil/link';

// sessionId must be created by your backend. The SDK consumes it.
const flow = link('session_123', {
  containerId: 'connect-mount',
  // authServer: 'http://localhost:5173', // optional for local/staging
  // allowedOrigin: 'https://auth.fiskil.com', // defaults to derived origin
  // set styles via your container; the iframe fills its container
});

const result = await flow;
// result.type === 'COMPLETED'
console.log(result.redirectURL, result.consentID);

// Optional: programmatic cancel
// flow.close();
```

If `containerId` is omitted, the SDK creates a full-viewport overlay (inline-styled) and mounts the iframe into it.

## API

### link(sessionId, options?): LinkFlow

Creates and mounts the Connect iframe, returns a promise-like controller (`LinkFlow`).

```ts
type LinkFlow = Promise<LinkResult> & { close(): void };

type LinkResult =
  | { type: 'COMPLETED'; redirectURL?: string; consentID?: string }
  | {
      type: 'FAILED';
      error: string;
      error_id?: string;
      error_type?: ConsentErrorType;
      error_description?: string;
      error_uri?: string;
    };

type LinkOptions = {
  containerId?: string; // existing element id to mount into
  allowedOrigin?: string; // postMessage origin; default = new URL(authUrl).origin
  authServer?: string; // default: https://auth.fiskil.com
  timeoutMs?: number; // default: 10 * 60 * 1000
};
```

URL loaded into the iframe: `${authServer}?sess_id=${encodeURIComponent(sessionId)}`.

### Errors

The promise rejects with a `LinkError`:

```ts
type LinkErrorCode =
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'IFRAME_ORIGIN_MISMATCH'
  | 'IFRAME_USER_CANCELLED'
  | 'IFRAME_UNKNOWN_MESSAGE'
  | ConsentErrorType;

interface LinkError extends Error {
  name: 'LinkError';
  code: LinkErrorCode;
  details?: unknown; // may include consent error details
}
```

Current mapping (subject to evolution):

- Programmatic cancel (calling `flow.close()`): rejects with `IFRAME_USER_CANCELLED`.
- Message from unexpected origin: rejects with `IFRAME_ORIGIN_MISMATCH` and `details = { expectedOrigin, receivedOrigin }`.
- Consent failure from embedded flow: rejects with the consent error code (e.g., `CONSENT_ENDUSER_DENIED`, `CONSENT_TIMEOUT`, …) and `details = { error_id, error_type, error_description, error_uri }` when present.
- No message within `timeoutMs`: rejects with `TIMEOUT`.
- Missing container element: throws synchronously with `NOT_FOUND`.

Example handling:

```ts
import { link, type LinkResult, type LinkError } from '@fiskil/link';

try {
  const flow = link('session_123', { containerId: 'connect' });
  const result: LinkResult = await flow;
  // COMPLETED
  console.log('Completed', result.redirectURL, result.consentID);
} catch (err) {
  const e = err as LinkError;
  if (e?.name === 'LinkError') {
    switch (e.code) {
      case 'IFRAME_USER_CANCELLED':
        // user dismissed/aborted inside the flow
        break;
      case 'TIMEOUT':
        // no message received within the guard window
        break;
      case 'IFRAME_UNKNOWN_MESSAGE':
        // unexpected payload; inspect e.details for more info
        break;
      case 'NOT_FOUND':
        // containerId did not resolve to an element
        break;
      default:
        // reserved for future consent-code mapping on e.code
        // inspect e.details: { error_id, error_type, error_description, error_uri }
        break;
    }
  } else {
    console.error(err);
  }
}
```

### Options examples

- **Overlay mount (default):**

```ts
link('sess');
```

- **Mount into existing container:**

```ts
link('sess', { containerId: 'connect-root' });
```

- **Override auth server for local/staging:**

```ts
link('sess', { authServer: 'http://localhost:5173' });
```

- **Lock down postMessage origin (recommended in production):**

```ts
link('sess', {
  allowedOrigin: 'https://auth.fiskil.com',
});
```

- **Custom timeout (e.g., 3 minutes):**

```ts
link('sess', { timeoutMs: 3 * 60 * 1000 });
```

## UMD / CDN

```html
<script src="/dist/fiskil-link.umd.js"></script>
<script>
  const flow = FiskilLink.link('session_123', { containerId: 'connect' });
  flow.then((res) => console.log('done', res)).catch(console.error);
  // flow.close();
  // res.type === 'COMPLETED'
  // res.redirectURL, res.consentID
  // on error, inspect e.code and e.details
</script>
```

## Advanced (internal)

`parseAuthMessage(event)` is available from `./src/utils` for debugging or testing the message protocol. It normalizes the embedded app messages into `LinkResult | null`. This is not part of the public API surface and may change.

## Notes

- The SDK creates a high `z-index` overlay when no `containerId` is provided.
- The iframe `src` is controlled by the SDK and cannot be overridden via `iframe` options.
- All public types are re-exported from the package entry for a single stable import surface.
