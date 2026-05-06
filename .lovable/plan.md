# Roll Back to Internal-Only Bookings (Disable Cal.com)

## Goal
Stop calling Cal.com from every booking surface. Use `reservation_details` as the single source of truth for what's booked. Keep Cal.com edge functions and config in place (commented/disabled) so we can re-enable later. Simplify availability to: open 06:00–18:00, block exact booked intervals + 2h buffer, no AM/PM/morning-only constraints.

## What stays
- All Cal.com edge function files remain in `supabase/functions/` (no deletes).
- `yachts.cal_event_type_id`, `cal_embed_url`, `booking_mode` columns stay.
- V3 timezone (`America/Mazatlan`) and 2h buffer stay.

## What changes

### 1. Database (single migration)
- Add columns to `reservation_details` to support internally-created bookings without a Cal UID:
  - `created_by_email text not null default ''`
  - Make `booking_uid_current` allow internal-style ids (e.g. `internal_<uuid>`); no schema change needed, just convention.
- Add index `(yacht_slug, start_at, end_at)` on `reservation_details` for fast availability lookups.
- No RLS changes (existing admin/staff policies already cover reads/writes).
- For the public `/book` page to write without auth, add a SECURITY DEFINER RPC `create_public_reservation(...)` that inserts into `reservation_details` after re-validating the slot. Public page calls this RPC; no anonymous direct table writes.

### 2. New shared availability helper (internal)
Create `supabase/functions/_shared/internal-availability.ts`:
- `loadReservationsForMonth(supabase, yachtSlug, monthYYYY_MM, tz)` → reads `reservation_details` rows whose `start_at`/`end_at` overlap the month, status not `cancelled`.
- `buildInternalAvailability(reservations, monthYYYY_MM)` returns the same `DayAvailability` shape the UI already consumes:
  - `openHours`: every hour in 06–17 not covered by a booking ± 2h buffer.
  - `validStartsByDuration[d]`: starts where `[start, start+d]` fits in 06–18 AND doesn't overlap any booked-interval-±-buffer.
  - `am`/`pm`/`fullOpen`: derived from `openHours` (am = any open hour < 13, pm = any open hour ≥ 15).
  - **Drop** the morning-only-for-4h, 3h-must-fit-half, and AM/PM-window rules. Only constraints: 3–8h, fits within 06–18, respects buffer.

### 3. Edge functions (rewrite bodies, keep file names)
- `internal-booking-availability/index.ts`: stop calling Cal slots; use new helper. Keep auth + response shape identical.
- `internal-booking-create/index.ts`: stop calling Cal `/v2/bookings`. Re-check slot via helper, then `insert into reservation_details` with `booking_uid_current = 'internal_' || gen_random_uuid()`, `source = 'internal_v2_no_cal'`, populate `created_by`, `updated_by`, `yacht_slug`, `yacht_name`, `start_at`, `end_at`, `status='booked'`. Return same response shape (`requestId`, `transactionId`, `bookingUid`, `status`).
- `internal-calendar-bookings/index.ts`: replace Cal fetch with a `reservation_details` query for `[start, end]` range, map to existing `NormalizedCalendarEvent` shape (pull guest name/email/phone via `guest_profile_id` join).
- `internal-calendar-booking-cancel/index.ts`: update `reservation_details.status = 'cancelled'` instead of calling Cal cancel.
- `internal-calendar-booking-reschedule/index.ts`: update `start_at`/`end_at` (and append old uid to `booking_uid_history` if duration changes / new uid issued); no Cal call.
- `public-booking-availability/index.ts`: same swap as internal-availability (no auth gating change), reads from `reservation_details`.
- `public-booking-create/index.ts`: call the new `create_public_reservation` RPC after Turnstile + rate-limit checks. Drop Cal calls. Keep response shape.
- `public-booking-webhook/index.ts`: short-circuit to `200 {disabled:true}` and log; no DB writes.

### 4. Frontend
- `src/lib/bookingPolicy.ts`: relax `isStartAllowedByPolicy` to only check `requestedHours ∈ [3,8]` and `start..end ⊂ [6,18]`. Remove the morning/afternoon clauses. Keep `INTER_BOOKING_BUFFER_HOURS = 2` (used server-side now).
- `src/pages/Book.tsx` / `StepYacht.tsx`: keep current "all yachts shown, blocked unless bookingReady" UI, but redefine `bookingReady = booking_mode === 'policy_v2'` only (drop the `cal_event_type_id != null` requirement so any policy_v2 yacht is bookable internally).
- `src/pages/Calendar.tsx` and `admin-calendar/*`: no contract changes — they already consume the same JSON shapes.

### 5. Config / cleanup
- Leave `supabase/config.toml` entries for Cal-era functions in place.
- Leave `CAL_API_KEY` etc. secrets in place.
- Add a banner comment at the top of each rewritten edge function: `// Cal.com integration temporarily disabled — internal-only mode.`

## Files touched
| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Add `created_by_email`, index, `create_public_reservation` RPC |
| `supabase/functions/_shared/internal-availability.ts` | New helper |
| `supabase/functions/internal-booking-availability/index.ts` | Rewrite to use helper |
| `supabase/functions/internal-booking-create/index.ts` | Insert into reservation_details |
| `supabase/functions/internal-calendar-bookings/index.ts` | Read from reservation_details |
| `supabase/functions/internal-calendar-booking-cancel/index.ts` | Update status to cancelled |
| `supabase/functions/internal-calendar-booking-reschedule/index.ts` | Update start_at/end_at |
| `supabase/functions/public-booking-availability/index.ts` | Use helper |
| `supabase/functions/public-booking-create/index.ts` | RPC insert, no Cal |
| `supabase/functions/public-booking-webhook/index.ts` | Disable body, return 200 |
| `src/lib/bookingPolicy.ts` | Simplify `isStartAllowedByPolicy` |
| `src/pages/Book.tsx` | `bookingReady = policy_v2` only |

## Validation
1. Internal create on an empty day for a `policy_v2` yacht returns 200 and the row appears in `reservation_details`.
2. Calendar page shows that booking immediately (no Cal round-trip).
3. A second booking overlapping or within 2h of the first is rejected with 409.
4. 4h at 14:00 is now allowed (was blocked under old AM-only rule).
5. Cancel via Calendar flips `status` to `cancelled`; the slot becomes available again.
6. Public `/book` create works without Cal and writes a `reservation_details` row via RPC.
7. Cal.com webhook endpoint returns 200 disabled and no longer mutates data.
