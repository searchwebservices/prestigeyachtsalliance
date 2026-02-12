# Internal Calendar Booking Backend Plan (No SQL Migration)

## Goal
Add an authenticated internal booking-create endpoint for employee bookings that uses V3 policy and skips Turnstile. Keep all public endpoints unchanged.

## Scope
1. New edge function: `supabase/functions/internal-booking-create/index.ts`
2. Reuse existing helpers from `supabase/functions/_shared/booking.ts`
3. No SQL migration required
4. No change to `public-booking-create` or `public-booking-availability` behavior for external/public consumers

## Auth and Access
1. Require `Authorization` header with Supabase JWT.
2. Validate user via anon client `auth.getUser()`.
3. Allow any authenticated team user (admin or staff).
4. Reject unauthenticated requests with 401.

## Endpoint Contract
### POST `/functions/v1/internal-booking-create`
Request JSON:
- `slug: string`
- `date: YYYY-MM-DD`
- `requestedHours: number`
- `startHour: number`
- `attendee: { name: string; email: string; phoneNumber?: string }`
- `notes?: string`

Response 200:
- `requestId: string`
- `transactionId: string`
- `bookingUid: string | null`
- `status: string`

Errors:
- 400 invalid input or policy rule
- 401 unauthorized
- 404 yacht not found or booking disabled
- 409 stale/unavailable slot
- 502 upstream provider error
- 500 unexpected error

## Behavior Requirements
1. Use V3 helpers:
- `resolveStartHourForCreate`
- `isStartAllowedByPolicy`
- `buildAvailabilityForMonth`
- `isStartSelectionAvailable`
2. Re-check slot availability server-side before creating booking.
3. Use Cal payload:
- `start = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE)`
- `lengthInMinutes = requestedHours * 60`
4. Skip Turnstile checks entirely for this endpoint.
5. Keep rate limiting logic equivalent to public endpoint.
6. Write metadata:
- `policy_version`
- `start_hour`
- `end_hour`
- `requested_hours`
- `shift_fit`
- `segment`
- `selected_half` derived from shift fit when absent
- `timezone`
- `source = internal_calendar_v1`
- `booked_by_user_id`
- `booked_by_email`
7. Log request outcomes to `booking_request_logs` with endpoint `internal-booking-create`.

## CORS/Headers
1. Reuse shared CORS helpers from `_shared/booking.ts`.
2. Support internal app origins already configured by `BOOKING_ALLOWED_ORIGINS`.

## Validation Checklist
1. Valid create: 3h morning slot returns 200.
2. Invalid rule: 4h at 15:00 returns 400.
3. Stale selection: valid policy but unavailable slot returns 409.
4. Unauthenticated call returns 401.
5. Public endpoint still requires Turnstile behavior unchanged.
