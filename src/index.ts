// ---------- Public Types ----------
import type {
  LinkOptions,
  LinkResult,
  LinkFlow,
  ConsentErrorType,
  LinkErrorCode,
  LinkError,
} from './types';
export type {
  LinkOptions,
  LinkResult,
  LinkFlow,
  ConsentErrorType,
  LinkErrorCode,
  LinkError,
};

// ---------- Utilities ----------
import { flError, parseAuthMessage } from './utils';

// ---------- Internal Helpers ----------
function mountContainer(containerId?: string): {
  container: HTMLElement;
  overlayContainer: HTMLElement | null;
} {
  if (containerId) {
    const el = document.getElementById(containerId);
    if (!el) throw flError('NOT_FOUND', `Container not found: #${containerId}`);
    return { container: el, overlayContainer: null };
  }
  const existing = document.getElementById('fiskil-link-overlay');
  if (existing) return { container: existing, overlayContainer: existing };
  const div = document.createElement('div');
  div.id = 'fiskil-link-overlay';
  // Inline styles for a full-viewport overlay, independent of any CSS framework
  div.style.position = 'fixed';
  div.style.top = '0';
  div.style.right = '0';
  div.style.bottom = '0';
  div.style.left = '0';
  div.style.width = '100vw';
  div.style.height = '100vh';
  div.style.zIndex = '2147483647';
  div.style.backgroundColor = 'rgba(23, 23, 23, 0.2)';
  document.body.appendChild(div);
  return { container: div, overlayContainer: div };
}

function createMessageHandler(
  allowedOrigin: string,
  resolve: (value: LinkResult) => void,
  reject: (error: any) => void
) {
  return function onMessage(event: MessageEvent) {
    if (event.origin !== allowedOrigin) {
      // Explicitly surface unexpected origins to aid integrators
      reject(
        flError(
          'IFRAME_ORIGIN_MISMATCH',
          'Message received from unexpected origin',
          {
            details: {
              expectedOrigin: allowedOrigin,
              receivedOrigin: event.origin,
            },
          }
        )
      );
      return;
    }

    const parsed = parseAuthMessage(event);
    if (!parsed) return;

    if (parsed.type === 'COMPLETED') {
      resolve(parsed);
      return;
    }

    if (parsed.type === 'FAILED') {
      reject(
        flError(parsed.error_type as LinkErrorCode, parsed.error, {
          details: {
            error_id: parsed.error_id,
            error_type: parsed.error_type,
            error_description: parsed.error_description,
            error_uri: parsed.error_uri,
          },
        })
      );
    }
  };
}

function createTimeoutHandler(reject: (error: any) => void) {
  return function onTimeout() {
    reject(flError('TIMEOUT', 'Iframe flow timed out'));
  };
}

function finalizePromise<T>(
  p: Promise<T>,
  cleanup: () => void,
  timeoutId?: number
): Promise<T> {
  return p.finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    cleanup();
  });
}

function removeNode(node: HTMLElement | null) {
  try {
    if (!node) return;
    if (typeof (node as any).remove === 'function') (node as any).remove();
    else if ((node as any).parentNode)
      (node as any).parentNode.removeChild(node);
  } catch {}
}

function removeExistingLinkIframes(scope: HTMLElement) {
  try {
    const nodes = scope.querySelectorAll(
      'iframe[data-fiskil-link-iframe="true"]'
    );
    nodes.forEach((n) => {
      try {
        if (typeof (n as any).remove === 'function') (n as any).remove();
        else if ((n as any).parentNode) (n as any).parentNode.removeChild(n);
      } catch {}
    });
  } catch {}
}

function teardownEmbed(
  handler: ((event: MessageEvent) => void) | null,
  iframe: HTMLIFrameElement | null,
  overlay: HTMLElement | null
) {
  if (handler) window.removeEventListener('message', handler);
  removeNode(iframe);
  removeNode(overlay);
}

/**
 * Mount the auth experience in an iframe.
 * Returns a controller and a promise that settles on completion/cancel.
 */
export function link(sessionId: string, options?: LinkOptions): LinkFlow {
  const mounted = mountContainer(options?.containerId);
  let overlayContainer: HTMLElement | null = mounted.overlayContainer;
  const container = mounted.container;
  // Construct auth URL (allow override for local/staging)
  const defaultOrigin = 'https://auth.fiskil.com';
  const baseOrigin = options?.authServer ?? defaultOrigin;
  const authUrl = `${baseOrigin}?sess_id=${encodeURIComponent(sessionId)}`;
  const allowedOrigin = options?.allowedOrigin ?? new URL(authUrl).origin;

  // Create iframe
  removeExistingLinkIframes(container);
  const iframe = document.createElement('iframe');
  iframe.src = authUrl;
  iframe.setAttribute('data-fiskil-link-iframe', 'true');
  iframe.style.border = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  container.appendChild(iframe);

  let current: HTMLIFrameElement | null = iframe;
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  let rejectRef: ((error: any) => void) | null = null;
  let timeoutId: number | undefined;
  const completed = new Promise<LinkResult>((resolve, reject) => {
    function settleOk(value: LinkResult) {
      resolve(value);
    }
    function settleErr(error: any) {
      reject(error);
    }
    rejectRef = settleErr;

    messageHandler = createMessageHandler(allowedOrigin, settleOk, settleErr);
    window.addEventListener('message', messageHandler);

    // Timeout guard: configurable (default 10 minutes)
    const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000;
    timeoutId = window.setTimeout(createTimeoutHandler(settleErr), timeoutMs);
  });

  const controller = {
    close() {
      // Reject the in-flight promise as a user-cancel action, then cleanup
      try {
        (rejectRef ?? (() => {}))(
          flError('IFRAME_USER_CANCELLED', 'Iframe flow closed by caller')
        );
      } catch {}
    },
  };

  const promise = finalizePromise(
    completed,
    () => {
      teardownEmbed(messageHandler, current, overlayContainer);
    },
    timeoutId
  ) as LinkFlow;
  promise.close = controller.close;
  return promise;
}
