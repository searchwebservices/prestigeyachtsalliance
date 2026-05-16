## Goal

Capture every error happening in a user's browser session — React render errors, uncaught JS exceptions, unhandled promise rejections, `console.error` calls, and `toast.error` calls — with rich metadata, stored in our database for review.

## Approach

In-house tracking (no third-party SDK), built on the same Supabase pattern as `useActivityTracker`. Lightweight, no extra dependencies.

### 1. New table: `client_errors`

Columns (beyond standard id/created_at):
- `user_id` (uuid, nullable — anon users on `/reserve*` can hit errors too)
- `session_id` (text — generated per tab load, stored in `sessionStorage`)
- `source` (text: `react` | `window_error` | `unhandled_rejection` | `console_error` | `toast_error` | `manual`)
- `severity` (text: `error` | `warning`)
- `message` (text)
- `stack` (text, nullable)
- `component_stack` (text, nullable — React only)
- `url` (text — `window.location.href`)
- `route` (text — pathname)
- `user_agent` (text)
- `viewport` (text — e.g. `1246x940`)
- `referrer` (text, nullable)
- `release` (text, nullable — git SHA / build id if available, else `dev`)
- `metadata` (jsonb — free-form: tags, extra context, breadcrumbs)

RLS:
- `INSERT`: allowed for `anon` and `authenticated` (so public pages report too). Inserts always with `auth.uid()` for the `user_id` column when present, NULL otherwise.
- `SELECT`: admin only (uses existing `has_role(auth.uid(), 'admin')`).
- No UPDATE / DELETE policies.

Index on `(created_at desc)` and `(user_id, created_at desc)` for the admin viewer.

### 2. Error reporter module — `src/lib/errorReporter.ts`

- `reportError(payload)` — single insert into `client_errors`. Best-effort, swallows its own failures (never throws), de-dupes identical messages within 5s.
- Generates/reuses `session_id` from `sessionStorage`.
- Auto-fills `url`, `route`, `user_agent`, `viewport`, `referrer`, `release`.
- Maintains an in-memory breadcrumb ring buffer (last ~25 events: route changes, clicks, fetches) and attaches to `metadata.breadcrumbs`.

### 3. Global installer — `src/lib/installErrorTracking.ts`

Called once from `src/main.tsx`. Wires:
- `window.addEventListener('error', …)` → `source: 'window_error'`.
- `window.addEventListener('unhandledrejection', …)` → `source: 'unhandled_rejection'`.
- Monkey-patches `console.error` (calls original first, then reports) → `source: 'console_error'`. Filters known React Router future-flag warnings to avoid noise.
- Wraps `sonner`'s `toast.error` and the legacy `useToast` `toast()` calls with `variant: 'destructive'` → `source: 'toast_error'`. Done via a thin re-export module `@/lib/toast.ts` plus a runtime wrapper that the existing imports continue to work against.

### 4. React error boundary — `src/components/ErrorBoundary.tsx`

Class component. `componentDidCatch` → `reportError({ source: 'react', component_stack })`. Renders a minimal fallback with "Reload" button. Wrap `<Routes>` in `App.tsx`.

### 5. Admin viewer — `/admin/errors` (admin-only route)

Table listing latest 200 errors with filters by `source`, `user_id`, `route`. Row expands to show stack, breadcrumbs, full metadata. Built with existing shadcn `Table` + `Dialog`. Linked from `TeamManagement` page header.

### 6. Edge function (optional but recommended) — `client-error-ingest`

For anon callers, a tiny edge function fronts the insert so we can rate-limit by IP (reuses existing `BOOKING_RATE_LIMIT_SALT` pattern). Authed callers can insert directly via RLS. Keeps abuse surface small.

## Technical notes

- No new npm dependencies.
- Toast wrapping is the only invasive change; existing call sites keep working because we re-export `toast` from `sonner` with the same signature.
- Console patching is opt-out via `window.__disableErrorTracking__ = true` to make debugging the tracker itself easier.
- All capture paths route through one `reportError` so de-dup + breadcrumbs are consistent.
- PII: we store `user_agent` and `referrer` but no form values; metadata is opt-in per call site.

## Open questions for you

1. **Retention** — keep forever, or auto-prune after 30/60/90 days?
2. **Anon coverage** — should `/reserve*` (public) errors be tracked too, or authed-only?
3. **Toast wrapping** — OK to add a thin `@/lib/toast.ts` re-export that all new code should import from? (Existing `import { toast } from 'sonner'` still works via runtime patch.)
4. **Admin viewer scope now** — full filter/search UI, or v1 is just "last 200 errors" and we iterate?
