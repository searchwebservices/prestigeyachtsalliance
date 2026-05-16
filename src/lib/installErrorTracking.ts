import { toast as sonnerToast } from 'sonner';
import { addBreadcrumb, reportError } from './errorReporter';

let installed = false;

const NOISE_PATTERNS: RegExp[] = [
  /React Router Future Flag Warning/i,
  /\[vite\]/i,
];

function isNoise(msg: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(msg));
}

function stringifyArg(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

export function installErrorTracking() {
  if (installed) return;
  installed = true;

  // Uncaught errors
  window.addEventListener('error', (event) => {
    const err = event.error;
    reportError({
      source: 'window_error',
      message: event.message || (err && err.message) || 'window error',
      stack: err?.stack ?? null,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : stringifyArg(reason) || 'unhandled rejection';
    reportError({
      source: 'unhandled_rejection',
      message,
      stack: reason instanceof Error ? reason.stack ?? null : null,
    });
  });

  // console.error wrapping
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    try {
      const message = args.map(stringifyArg).join(' ');
      if (!isNoise(message)) {
        const stackArg = args.find((a) => a instanceof Error) as Error | undefined;
        reportError({
          source: 'console_error',
          message: message.slice(0, 2000),
          stack: stackArg?.stack ?? null,
        });
      }
    } catch {
      /* noop */
    }
  };

  // sonner toast.error wrapping
  const origToastError = sonnerToast.error;
  (sonnerToast as unknown as { error: typeof origToastError }).error = ((
    message: Parameters<typeof origToastError>[0],
    opts?: Parameters<typeof origToastError>[1],
  ) => {
    try {
      const msg = typeof message === 'string' ? message : stringifyArg(message);
      const desc = opts && typeof (opts as { description?: unknown }).description !== 'undefined'
        ? stringifyArg((opts as { description?: unknown }).description)
        : undefined;
      reportError({
        source: 'toast_error',
        message: msg,
        metadata: desc ? { description: desc } : undefined,
      });
    } catch {
      /* noop */
    }
    return origToastError(message, opts);
  }) as typeof origToastError;

  // Breadcrumbs: route changes
  let lastPath = window.location.pathname;
  const recordRoute = () => {
    const p = window.location.pathname;
    if (p !== lastPath) {
      addBreadcrumb('navigation', { from: lastPath, to: p });
      lastPath = p;
    }
  };
  window.addEventListener('popstate', recordRoute);
  const origPush = history.pushState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args as Parameters<typeof history.pushState>);
    recordRoute();
    return r;
  };
  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args as Parameters<typeof history.replaceState>);
    recordRoute();
    return r;
  };

  // Breadcrumbs: clicks (lightweight)
  window.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase();
      const text = (t.innerText || '').slice(0, 60);
      addBreadcrumb('click', { tag, text });
    },
    { capture: true },
  );

  // Breadcrumbs: fetch
  const origFetch = window.fetch;
  window.fetch = async (...args: Parameters<typeof window.fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    const start = Date.now();
    try {
      const res = await origFetch(...args);
      addBreadcrumb('fetch', { url, status: res.status, ms: Date.now() - start });
      return res;
    } catch (err) {
      addBreadcrumb('fetch', { url, error: stringifyArg(err), ms: Date.now() - start });
      throw err;
    }
  };
}
