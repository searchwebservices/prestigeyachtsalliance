# Admin Calendar Actions Backend Plan (Lovable)

## Goal
Add authenticated **admin-only** internal endpoints that allow proactive reservation management from `/calendar`:
1. Change reservation (reschedule)
2. Remove reservation (cancel)

Keep public booking endpoints unchanged.

## Required Workstreams
1. Add `POST /functions/v1/internal-calendar-booking-reschedule`.
2. Add `POST /functions/v1/internal-calendar-booking-cancel`.
3. Harden existing `GET /functions/v1/internal-calendar-bookings` to enforce admin role server-side.
4. Reuse shared booking helpers in `supabase/functions/_shared/booking.ts`.
5. Handle `OPTIONS` first with shared CORS headers on all internal-calendar endpoints.
6. Log all outcomes to `booking_request_logs` with endpoint names:
7. `internal-calendar-booking-reschedule`
8. `internal-calendar-booking-cancel`
9. `internal-calendar-bookings`

## Auth and Authorization
1. Require Supabase JWT (`Authorization: Bearer <token>`) for all three endpoints.
2. Verify session user with anon client `auth.getUser()`.
3. Enforce role `admin` via `user_roles` table lookup for mutation endpoints.
4. Return:
5. `401` for missing/invalid auth
6. `403` for authenticated non-admin

## Endpoint 1: Reschedule
### POST `/functions/v1/internal-calendar-booking-reschedule`

Request JSON:
- `slug: string`
- `bookingUid: string`
- `date: YYYY-MM-DD`
- `requestedHours: number`
- `startHour: number`
- `reason?: string`

Behavior:
1. Validate required fields and date format.
2. Validate yacht internal eligibility:
3. `booking_mode = policy_v2`
4. `cal_event_type_id` present
5. Ignore `booking_public_enabled`.
6. Validate V3 booking rule:
7. `resolveStartHourForCreate`
8. `isStartAllowedByPolicy`
9. Re-check server availability before mutation:
10. `buildAvailabilityForMonth`
11. `isStartSelectionAvailable`
12. `checkProviderSlotAvailable`
13. Fetch existing booking from Cal by `bookingUid` and derive original duration.
14. Hybrid strategy:
15. If new duration equals old duration: use Cal native reschedule endpoint.
16. If duration changed: create new booking with requested slot, then cancel old booking.
17. Preserve attendee identity/details from original booking if not explicitly changed.
18. Metadata on recreate path should keep policy fields (`policy_version`, `start_hour`, `end_hour`, `requested_hours`, `shift_fit`, `segment`, `selected_half`, `timezone`) and include source marker:
19. `source = internal_calendar_action_v1`
20. Include operator fields:
21. `booked_by_user_id`
22. `booked_by_email`

Response 200:
- `requestId: string`
- `changeMode: "native_reschedule" | "recreate_cancel"`
- `bookingUid: string | null` (current active booking UID after change)
- `previousBookingUid: string`
- `status: string`

Errors:
- `400` invalid input / policy invalid
- `401` unauthorized
- `403` forbidden
- `404` yacht or booking missing/ineligible
- `409` stale or unavailable slot
- `502` upstream provider failure
- `500` unexpected

## Endpoint 2: Cancel
### POST `/functions/v1/internal-calendar-booking-cancel`

Request JSON:
- `slug: string`
- `bookingUid: string`
- `reason: string` (required)

Behavior:
1. Validate inputs.
2. Validate admin auth + yacht eligibility.
3. Cancel booking in Cal using booking UID.
4. Include reason in cancellation call and in logs.
5. Treat already-canceled booking as idempotent success when feasible.

Response 200:
- `requestId: string`
- `bookingUid: string`
- `status: string` (e.g., canceled)

Errors:
- `400`, `401`, `403`, `404`, `502`, `500`

## Endpoint 3: Read Endpoint Hardening
### GET `/functions/v1/internal-calendar-bookings`

Changes:
1. Keep current response contract unchanged.
2. Add admin role check server-side (`403` for non-admin).
3. Continue returning:
4. `requestId`, `timezone`, `slug`, `rangeStart`, `rangeEnd`, `events[]`

## Logging Requirements
For each endpoint, write `booking_request_logs` with:
- `endpoint`
- `request_id`
- `status_code`
- `details` JSON including reason/error context

Suggested reasons:
- `missing_auth_header`
- `invalid_token`
- `forbidden_non_admin`
- `invalid_input`
- `not_eligible`
- `slot_not_available_policy_cache`
- `slot_not_available_provider`
- `reschedule_native_success`
- `reschedule_recreate_cancel_success`
- `cancel_success`
- `cal_error`
- `unhandled_error`

## CORS and Security
1. Reuse shared `getCorsHeaders` and `isOriginAllowed`.
2. Return CORS headers on success and error.
3. Handle `OPTIONS` before auth checks.

## Validation Checklist
1. `OPTIONS` preflight returns 200 + headers on all three endpoints.
2. Missing token returns `401`.
3. Staff token returns `403` on action endpoints.
4. Admin valid reschedule same-duration returns `200` with `changeMode=native_reschedule`.
5. Admin duration-change reschedule returns `200` with `changeMode=recreate_cancel`.
6. Admin stale slot returns `409`.
7. Admin cancel with reason returns `200`.
8. `booking_request_logs` entries created for success and failure paths.

## Notes
1. No SQL migration required.
2. Keep public endpoints unchanged.
3. Keep timezone default `America/Mazatlan`.
