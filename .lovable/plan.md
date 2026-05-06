## Problem

On `/book?yacht=made-for-waves&step=day`, the wizard calls
`GET .../functions/v1/internal-booking-availability?slug=made-for-waves&month=2026-05`
and the browser reports `TypeError: Failed to fetch`.

Edge logs show only:
- One successful `OPTIONS` (CORS preflight) for that URL at 22:02:29
- A boot log right after (`booted (time: 30ms)`)
- **No log entry at all for the actual GET request** — i.e. the worker never returned a response, so the browser sees a network-level failure.

Other facts:
- Function source was rewritten in the previous turn (Cal.com → internal-only) but the new code may not have been redeployed cleanly, so the GET hits a worker that fails to evaluate the new module.
- `_shared/internal-availability.ts` uses a mixed value/type import from `booking.ts` (`import { …, type createServiceRoleClient } from './booking.ts'`). Some Deno edge runtime versions choke on inline `type` specifiers in `.ts` files when transpiled, which would cause the worker to throw during module evaluation — exactly matching the "boot OK, GET produces no response" symptom.
- Public/internal create + cancel + reschedule + public availability all import the same shared file and would have the same failure mode.

## Fix

1. **Remove the inline `type` import in `_shared/internal-availability.ts`.**
   Replace
   ```ts
   import {
     parseMonthKey, toTimeZoneParts, zonedDateTimeToUtcIso,
     type createServiceRoleClient,
   } from './booking.ts';
   ```
   with a separate `import type { … }` line. Use a structural type for the supabase client (e.g. `type SupabaseClient = ReturnType<typeof createServiceRoleClient>`) so we don't need to value-import the factory.

2. **Add explicit error logging in `internal-booking-availability/index.ts`.**
   Wrap the `buildAvailabilityForMonth` call in its own try/catch and `console.error('avail build failed', err)` before re-throwing, so any future failure shows up in edge logs instead of looking like "Failed to fetch".

3. **Redeploy the affected functions** so the running worker actually has the new internal-only code:
   - `internal-booking-availability`
   - `internal-booking-create`
   - `internal-calendar-bookings`
   - `internal-calendar-booking-cancel`
   - `internal-calendar-booking-reschedule`
   - `public-booking-availability`
   - `public-booking-create`
   - `public-booking-webhook`

4. **Verify** by:
   - Re-loading `/book?yacht=made-for-waves&step=day` and confirming the calendar renders with no error toast.
   - Checking edge logs for `internal-booking-availability` show a `GET … 200`.
   - If a 500 surfaces, the new `console.error` line will tell us whether it's a DB / RLS / TZ issue and we patch that next.

## Out of scope

- No DB schema changes (the `reservation_details` schema, RPC, and index from the previous migration are already in place).
- No frontend changes; `Book.tsx` already targets `internal-booking-availability` correctly.
- Cal.com code stays disabled-but-present per the prior decision.
