# Booking System Architecture (Current)

Last validated against `main` at commit `07df8ba` (origin/main).

## 1. Scope
This document describes the current booking architecture used by:
- Public booking page: `/book/:yachtSlug`
- Internal team booking wizard: `/book`
- Admin calendar and reservation center: `/calendar`

It reflects current implementation in the app and Supabase Edge Functions, including Cal.com integration and reservation admin actions.

## 2. High-Level Architecture
```text
Public User (no auth)
  -> React page /book/:yachtSlug
  -> Supabase Edge:
     - public-booking-availability
     - public-booking-create
     - public-booking-webhook
  -> Cal.com API v2 (/slots, /bookings)
  -> Supabase tables (rate limits, request logs, webhook events, yachts)

Internal Staff (authenticated)
  -> React page /book (5-step wizard)
  -> Supabase Edge:
     - internal-booking-availability
     - internal-booking-create
  -> Cal.com API v2
  -> Supabase user_activity tracking

Admin (authenticated + admin role)
  -> React page /calendar
  -> Supabase Edge:
     - internal-calendar-bookings
     - internal-calendar-booking-reschedule
     - internal-calendar-booking-cancel
     - internal-reservation-details (+ /export)
     - internal-team-member-reservation-oversight
  -> Cal.com API v2
  -> Supabase reservation tables + change logs
```

## 3. Booking Policy (V3)
Source: `src/lib/bookingPolicy.ts`, `supabase/functions/_shared/booking.ts`

- Timezone: `America/Mazatlan`
- Duration bounds: `3..8` hours
- Operating window: `06:00-18:00`
- Morning window: `06:00-13:00`
- Buffer window: `13:00-15:00`
- Afternoon window: `15:00-18:00`
- Time step: 60 minutes

### Allowed start rules
- `3h`: morning fit (`end <= 13`) OR exactly `15:00`
- `4h`: must fit morning (`end <= 13`)
- `5h..8h`: any start allowed if trip ends by `18:00`

### Availability model
- Day availability now includes:
  - `am`, `pm`, `fullOpen` (UI state)
  - `openHours` (hour buckets)
  - `validStartsByDuration` (start hours per `3..8`)
- Booking selection uses `validStartsByDuration`, not legacy half-only logic.

## 4. Frontend Flows

## 4.1 Public booking (`src/pages/PublicBooking.tsx`)
- Calls `public-booking-availability?slug=<slug>&month=YYYY-MM`
- User picks:
  - date
  - duration (3-8)
  - start time (from `validStartsByDuration`)
- Submits to `public-booking-create` with:
  - `slug`, `date`, `requestedHours`, `startHour`, `attendee`, `notes`, `cfToken`
- On success:
  - shows transaction + booking confirmation UI
  - shows Ricardo contact CTA (WhatsApp/call)
  - tracks `trip_booked` in `user_activity`

## 4.2 Internal booking wizard (`src/pages/Book.tsx`)
- 5 steps:
  1. Yacht
  2. Day
  3. Duration
  4. Start time
  5. Client details
- Uses:
  - `internal-booking-availability`
  - `internal-booking-create`
- Requires auth session token in request headers.
- On success:
  - shows internal confirmation card + copy/WhatsApp actions
  - tracks `trip_booked` and wizard events in `user_activity`

## 4.3 Admin calendar (`src/pages/Calendar.tsx`)
- Loads events via `internal-calendar-bookings`
- Supports view modes: month/week/day
- Opens reservation drawer (`ReservationCenterModal`) with:
  - reschedule action (`internal-calendar-booking-reschedule`)
  - cancel action (`internal-calendar-booking-cancel`)
  - reservation details read/update (`internal-reservation-details`)
  - reservation export (`internal-reservation-details/export`)
- Uses `internal-booking-availability` for reschedule date/time picker availability.

## 5. Edge Function Contracts

## 5.1 Public
- `public-booking-availability` (`GET`)
  - Query: `slug`, `month`
  - Returns yacht + constraints + day map (`validStartsByDuration`)
  - Requires yacht:
    - `booking_public_enabled = true`
    - `booking_mode = 'policy_v2'`
    - `cal_event_type_id` present

- `public-booking-create` (`POST`)
  - Body: `slug`, `date`, `requestedHours`, `startHour` (or legacy `half`), `attendee`, `notes`, `cfToken`
  - Checks:
    - payload validation
    - V3 rule validation
    - go-live date
    - DB rate limit
    - optional Turnstile
    - policy cache availability
    - provider slot recheck
  - Creates Cal booking with `lengthInMinutes = requestedHours * 60`
  - Fallback: retries without `lengthInMinutes` if provider rejects fixed-length on event type.

- `public-booking-webhook` (`POST`)
  - Optional signature verification
  - Stores payload in `booking_webhook_events`

## 5.2 Internal booking
- `internal-booking-availability` (`GET`)
  - Same availability shape as public
  - Requires JWT (manual validation)
  - Yacht eligibility: `policy_v2 + cal_event_type_id`

- `internal-booking-create` (`POST`)
  - Same booking logic as public but no Turnstile
  - Adds metadata for internal actor:
    - `booked_by_user_id`
    - `booked_by_email`

## 5.3 Internal calendar and reservation ops (admin)
- `internal-calendar-bookings` (`GET`)
  - Admin only
  - Returns normalized Cal bookings for yacht/date range

- `internal-calendar-booking-reschedule` (`POST`)
  - Admin only
  - Validates target slot using V3 + provider checks
  - If same duration: native Cal reschedule
  - If duration changed: create new + cancel old
  - Syncs reservation details/change log

- `internal-calendar-booking-cancel` (`POST`)
  - Admin only
  - Requires cancel reason
  - Idempotent handling for already-cancelled bookings
  - Syncs reservation details/change log

- `internal-reservation-details` (`GET`, `PUT`) and `/export` (`POST`)
  - GET: admin/staff read
  - PUT: admin write
  - Seeds local reservation record from Cal if missing
  - Computes completion score
  - Writes audit/change entries

- `internal-team-member-reservation-oversight` (`GET`)
  - Admin only
  - Aggregates reservation completion/oversight by team member + date range

## 6. Data Model and Tables

## 6.1 Core booking config
- `yachts` (from migrations + v2 extensions)
  - `cal_event_type_id`
  - `booking_mode` (`legacy_embed` | `policy_v2`)
  - `booking_public_enabled`
  - `booking_v2_live_from`
  - legacy `cal_embed_url` still exists for fallback mode

## 6.2 Booking platform support tables
- `booking_rate_limits`
- `booking_request_logs`
- `booking_webhook_events`

## 6.3 User activity tracking
- `user_activity`
  - receives `trip_booked` and related UI/wizard/calendar analytics events

## 6.4 Reservation operations tables
Reservation admin endpoin`ts reference:
- `guest_profiles`
- `reservation_details`
- `reservation_stays`
- `reservation_change_log`

These schemas are defined in `docs/sql/luxury_reservation_phase_b.sql` and are expected to exist in the runtime DB used by calendar reservation features.

## 6.5 User preference/profile additions
- `profiles.phone_number`
- `profiles.preferred_theme`
- `profiles.preferred_language`

## 7. Auth and Security Model
- `supabase/config.toml` has `verify_jwt = false` for booking/calendar functions.
- Internal endpoints still enforce auth manually by:
  - reading `Authorization` bearer token
  - validating with Supabase auth
  - checking `user_roles` for admin where required
- CORS:
  - enforced in shared helper using `BOOKING_ALLOWED_ORIGINS`
- Rate limiting:
  - hash-based (`ip_hash`, `email_hash`) using `BOOKING_RATE_LIMIT_SALT`
- CAPTCHA:
  - optional Turnstile verification on public create only

## 8. Cal.com Integration Details

## 8.1 API versions
- Slots requests: `2024-09-04`
- Bookings requests/create: `2024-08-13`

## 8.2 Slot + booking strategy
- Availability:
  - fetches duration=60 open hours
  - fetches per-duration starts (`3..8` hours)
  - fetches bookings (`upcoming`, `unconfirmed`) and blocks accepted/pending/unconfirmed statuses
- Create:
  - uses exact `startHour` + `requestedHours`
  - sends metadata for policy/audit context

## 8.3 Environment variables used
- Required:
  - `CAL_API_BASE_URL`
  - `CAL_API_KEY`
  - `BOOKING_ALLOWED_ORIGINS`
  - `BOOKING_RATE_LIMIT_MAX_REQUESTS`
  - `BOOKING_RATE_LIMIT_WINDOW_MINUTES`
  - `BOOKING_RATE_LIMIT_SALT`
- Optional:
  - `CAL_API_VERSION` (defaulted by code where needed)
  - `CAL_PLATFORM_CLIENT_ID`
  - `CAL_PLATFORM_SECRET_KEY`
  - `TURNSTILE_SECRET_KEY` (or aliases)
  - `CAL_WEBHOOK_SECRET` / `CAL_WEBHOOK_SIGNING_SECRET`

## 9. Current UI Entry Points (Booking)
- Yacht detail book CTA now routes to internal flow:
  - `src/components/yacht/YachtDetail.tsx`
  - path: `/book?yacht=<slug>&step=day`
- Public booking remains available at:
  - `/book/:yachtSlug`

## 10. Recent Change Index (since `6a33929`)
Key booking/calendar evolution in current branch history:

- `621798e` Migrate to Booking V3 backend
- `f3efe7f` V3 guardrails/time-selection public flow
- `a410a3a` Internal booking wizard introduced
- `3889c50` Internal booking endpoints added
- `10ea340` Admin calendar page introduced
- `d33dff7` Internal calendar bookings endpoint added
- `673ab96` Admin calendar action deck (UI)
- `537a9fb` Internal reschedule/cancel endpoints
- `6e0d4aa` Reservation details backend endpoints
- `de05fa8` Reservation control center + oversight UX
- `9f25e54` CORS methods expanded for internal APIs
- `c331b44` Booking create hardened (phone + fixed-length event fallback)
- `07df8ba` Latest UI iteration updates (wizard layout)

## 11. Known Compatibility Notes
- If Cal event type does not support multiple durations, create handlers retry booking creation without `lengthInMinutes`.
- V3 rules are start-time based; legacy half-based compatibility is maintained only as fallback input handling.
- Public/internal UIs show clear endpoint-not-ready messages when functions are missing/not deployed.

## 12. Primary File Map
- Policy constants (frontend): `src/lib/bookingPolicy.ts`
- Public booking UI: `src/pages/PublicBooking.tsx`
- Internal booking UI: `src/pages/Book.tsx`
- Admin calendar UI: `src/pages/Calendar.tsx`
- Shared booking engine (edge): `supabase/functions/_shared/booking.ts`
- Public endpoints:
  - `supabase/functions/public-booking-availability/index.ts`
  - `supabase/functions/public-booking-create/index.ts`
  - `supabase/functions/public-booking-webhook/index.ts`
- Internal endpoints:
  - `supabase/functions/internal-booking-availability/index.ts`
  - `supabase/functions/internal-booking-create/index.ts`
  - `supabase/functions/internal-calendar-bookings/index.ts`
  - `supabase/functions/internal-calendar-booking-reschedule/index.ts`
  - `supabase/functions/internal-calendar-booking-cancel/index.ts`
  - `supabase/functions/internal-reservation-details/index.ts`
  - `supabase/functions/internal-team-member-reservation-oversight/index.ts`
- Function exposure config: `supabase/config.toml`
- Booking v2 migration: `supabase/migrations/20260211000100_booking_policy_v2.sql`
- User settings/history migration: `supabase/migrations/20260211000200_user_settings_and_history.sql`
