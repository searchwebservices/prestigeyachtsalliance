# Book Internal API Switchover Plan (Lovable Backend)

## Goal
Power the internal `/book` flow using internal authenticated edge functions only, with V3 policy enforcement and no Turnstile.

## Required Backend Workstreams (Exact)
1. Add `GET /functions/v1/internal-booking-availability`.
2. Add `POST /functions/v1/internal-booking-create` (if not already deployed).
3. Require authenticated Supabase JWT for both.
4. Use shared V3 policy helpers.
5. Skip Turnstile on both internal endpoints.
6. Ignore `booking_public_enabled` for internal endpoints.
7. Internal yacht eligibility:
8. `booking_mode = policy_v2`
9. `cal_event_type_id` present
10. Keep server-side stale-slot recheck.
11. Keep rate limiting parity with public create.
12. Keep `booking_request_logs` entries with internal endpoint names.
13. Metadata for create includes:
14. `policy_version`, `start_hour`, `end_hour`, `requested_hours`, `shift_fit`, `segment`, `selected_half`, `timezone`, `source=internal_book_v1`, `booked_by_user_id`, `booked_by_email`.
15. Return stable error codes:
16. `400` invalid input/rule
17. `401` unauthorized
18. `404` yacht not found/not internally eligible
19. `409` stale/unavailable
20. `502` upstream provider
21. `500` unexpected

## Endpoint Contracts

### `GET /functions/v1/internal-booking-availability`
Query:
- `slug` (required)
- `month` (`YYYY-MM`, required)

Auth:
- Require `Authorization: Bearer <access_token>`.

Behavior:
- Validate token with Supabase auth.
- Ignore `booking_public_enabled`.
- Return V3 availability structure expected by internal Book UI:
- `constraints` + `days[date]` including `am`, `pm`, `fullOpen`, `openHours`, `validStartsByDuration`.

Errors:
- `400`, `401`, `404`, `500`.

### `POST /functions/v1/internal-booking-create`
Body:
- `slug`
- `date` (`YYYY-MM-DD`)
- `requestedHours`
- `startHour`
- `attendee: { name, email, phoneNumber? }`
- `notes?`

Auth:
- Require `Authorization: Bearer <access_token>`.

Behavior:
- Validate with V3 shared helpers:
- `resolveStartHourForCreate`
- `isStartAllowedByPolicy`
- `buildAvailabilityForMonth`
- `isStartSelectionAvailable`
- Re-check selected start against fresh availability to prevent stale slot submits.
- Cal payload:
- `start = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE)`
- `lengthInMinutes = requestedHours * 60`
- Skip Turnstile.
- Keep rate limit behavior equal to public create.
- Store metadata fields listed in workstream item 14.

Response 200:
- `requestId`, `transactionId`, `bookingUid`, `status`.

Errors:
- `400`, `401`, `404`, `409`, `502`, `500`.

## Guardrails
1. Keep public endpoints unchanged (`public-booking-availability`, `public-booking-create`).
2. Keep exact-time behavior (no synthetic full-day blocking).
3. No SQL migration required.

## Validation Checklist
1. `401` without auth token on both internal endpoints.
2. Internal availability works for `policy_v2` yachts even when `booking_public_enabled=false`.
3. Invalid policy combo (example `requestedHours=4`, `startHour=15`) returns `400`.
4. Stale slot returns `409`.
5. Success writes metadata fields including booking operator identity and `source=internal_book_v1`.
6. `booking_request_logs` contains `internal-booking-availability` and `internal-booking-create` entries.
7. Public endpoints remain behaviorally unchanged.
