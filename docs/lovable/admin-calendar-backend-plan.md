# Admin Calendar Backend Plan (Lovable)

## Goal
Add an authenticated internal read-only calendar endpoint that returns normalized Cal.com booking events for the admin `/calendar` page.

## Required Workstreams
1. Add edge function `GET /functions/v1/internal-calendar-bookings`.
2. Require authenticated Supabase JWT (`Authorization: Bearer ...`).
3. Handle `OPTIONS` first with shared CORS headers.
4. Ignore `booking_public_enabled`; internal eligibility is:
5. `booking_mode = policy_v2`
6. `cal_event_type_id` present
7. Query params:
8. `slug` (required for per-yacht tab)
9. `start` (`YYYY-MM-DD`, required)
10. `end` (`YYYY-MM-DD`, required)
11. `timezone` (optional, default `America/Mazatlan`)
12. Use Cal API `/v2/bookings` with event type ID and range filters.
13. Include statuses relevant for schedule view: `upcoming` and `unconfirmed`.
14. Normalize response to stable UI schema:
15. `requestId`, `timezone`, `slug`, `rangeStart`, `rangeEnd`, `events[]`
16. `events[]` fields:
17. `id`, `bookingUid`, `title`, `startIso`, `endIso`, `status`, `yachtSlug`, `yachtName`, `attendeeName`, `attendeeEmail`, `attendeePhone`, `notes`, `calBookingUrl?`
18. Log request outcomes to `booking_request_logs` with endpoint `internal-calendar-bookings`.
19. Stable error codes:
20. `400` invalid query
21. `401` unauthorized
22. `404` yacht missing/ineligible
23. `502` upstream Cal error
24. `500` unexpected

## Endpoint Contract
### GET `/functions/v1/internal-calendar-bookings`
Query:
- `slug: string` (required)
- `start: YYYY-MM-DD` (required)
- `end: YYYY-MM-DD` (required)
- `timezone?: string` (default `America/Mazatlan`)

Auth:
- Require valid Supabase JWT.

Response 200:
- `requestId: string`
- `timezone: string`
- `slug: string`
- `rangeStart: string`
- `rangeEnd: string`
- `events: Array<NormalizedCalendarEvent>`

Errors:
- `400`, `401`, `404`, `502`, `500`

## Normalization Details
1. Parse Cal booking data into stable event fields listed above.
2. Preserve ISO start/end timestamps in `startIso` and `endIso`.
3. Fill missing optional values as `null`.
4. Build a deterministic `title` from event type/yacht context.
5. Include `calBookingUrl` when available in upstream payload.

## CORS and Logging
1. Use shared `getCorsHeaders` / `isOriginAllowed` helpers.
2. Return CORS headers on both success and error responses.
3. Write `booking_request_logs` entries for both success and failures using endpoint `internal-calendar-bookings`.

## Validation Checklist
1. `OPTIONS` preflight returns 200 with expected headers.
2. Missing/invalid JWT returns 401.
3. Ineligible yacht returns 404.
4. Valid query returns normalized event array.
5. Upstream Cal error returns 502.
6. Request logs include endpoint and reason metadata.
