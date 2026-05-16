import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ErrorSource =
  | 'react'
  | 'window_error'
  | 'unhandled_rejection'
  | 'console_error'
  | 'toast_error'
  | 'manual';

export interface ReportErrorPayload {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  component_stack?: string | null;
  severity?: 'error' | 'warning';
  metadata?: Record<string, unknown>;
}

type Breadcrumb = {
  t: number;
  type: string;
  data?: Record<string, unknown>;
};

const SESSION_KEY = '__pya_session_id__';
const MAX_BREADCRUMBS = 25;
const breadcrumbs: Breadcrumb[] = [];
const recentMessages = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-session';
  }
}

export function addBreadcrumb(type: string, data?: Record<string, unknown>) {
  breadcrumbs.push({ t: Date.now(), type, data });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

function shouldDedup(key: string): boolean {
  const now = Date.now();
  // prune
  for (const [k, ts] of recentMessages) {
    if (now - ts > DEDUP_WINDOW_MS) recentMessages.delete(k);
  }
  if (recentMessages.has(key)) return true;
  recentMessages.set(key, now);
  return false;
}

export async function reportError(payload: ReportErrorPayload): Promise<void> {
  try {
    if ((window as unknown as { __disableErrorTracking__?: boolean }).__disableErrorTracking__) return;

    const dedupKey = `${payload.source}::${payload.message}`;
    if (shouldDedup(dedupKey)) return;

    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as { data: { user: null } }));

    const row = {
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      source: payload.source,
      severity: payload.severity ?? 'error',
      message: (payload.message ?? '').toString().slice(0, 2000),
      stack: payload.stack?.toString().slice(0, 8000) ?? null,
      component_stack: payload.component_stack?.toString().slice(0, 8000) ?? null,
      url: window.location.href,
      route: window.location.pathname,
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      referrer: document.referrer || null,
      release: (import.meta.env.VITE_RELEASE as string | undefined) ?? (import.meta.env.DEV ? 'dev' : 'prod'),
      metadata: {
        ...(payload.metadata ?? {}),
        breadcrumbs: breadcrumbs.slice(-MAX_BREADCRUMBS),
        device_pixel_ratio: window.devicePixelRatio,
        language: navigator.language,
      } as unknown as Json,
    };

    await supabase.from('client_errors').insert([row]);
  } catch {
    // never throw from the reporter
  }
}
