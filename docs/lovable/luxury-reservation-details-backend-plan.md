# Luxury Reservation Details Backend Plan (Lovable)

## Goal
Implement in-house luxury reservation detail management for Calendar and Team oversight while keeping Cal.com as scheduling source of truth.

## Scope
1. Add `GET /functions/v1/internal-reservation-details`
2. Add `PUT /functions/v1/internal-reservation-details`
3. Add `POST /functions/v1/internal-reservation-details/export`
4. Add `GET /functions/v1/internal-team-member-reservation-oversight`
5. Update existing:
6. `POST /functions/v1/internal-calendar-booking-reschedule`
7. `POST /functions/v1/internal-calendar-booking-cancel`

## Auth and Access
1. Require Supabase JWT for all new endpoints.
2. Read endpoints:
3. `internal-reservation-details` read: admin + staff
4. `internal-reservation-details/export`: admin + staff
5. `internal-team-member-reservation-oversight`: admin only
6. Write endpoint:
7. `internal-reservation-details` PUT: admin only
8. Return `401` for missing/invalid token and `403` for forbidden role.

## Data Model Assumptions
Tables created by SQL script:
1. `guest_profiles`
2. `reservation_details`
3. `reservation_stays`
4. `reservation_change_log`

## Endpoint Contracts

### 1) GET `/functions/v1/internal-reservation-details?bookingUid=<uid>&slug=<slug>`
Request:
1. `bookingUid` required
2. `slug` required

Behavior:
1. Validate auth and role (admin/staff).
2. Validate yacht eligibility (`booking_mode=policy_v2`, `cal_event_type_id` present, ignore `booking_public_enabled`).
3. Load local reservation by `booking_uid_current`.
4. If missing, fetch booking from Cal by UID and seed:
5. `guest_profiles`
6. `reservation_details`
7. `reservation_stays` (empty by default)
8. Return normalized payload:
9. `requestId`
10. `reservation`
11. `guest`
12. `stays`
13. `auditSummary`
14. `completionScore`

Errors:
1. `400` invalid query
2. `401` unauthorized
3. `403` forbidden
4. `404` yacht/booking not found or ineligible
5. `502` upstream Cal failure
6. `500` unexpected

### 2) PUT `/functions/v1/internal-reservation-details`
Request JSON:
1. `slug: string`
2. `bookingUid: string`
3. `reservation: object`
4. `guest: object`
5. `stays: array`

Behavior:
1. Validate auth and admin role.
2. Validate yacht eligibility.
3. Upsert guest profile.
4. Upsert reservation details by `booking_uid_current`.
5. Replace stays list transactionally (delete old, insert new with `sort_order`).
6. Compute completion score server-side using deterministic formula:
7. 20% guest contact
8. 20% party composition
9. 20% accommodation completeness
10. 20% guest care completeness
11. 20% ops notes completeness
12. Write `reservation_change_log` action `updated`.
13. Return normalized record.

Errors:
1. `400` invalid payload
2. `401` unauthorized
3. `403` forbidden
4. `404` yacht/ineligible
5. `500` unexpected

### 3) POST `/functions/v1/internal-reservation-details/export`
Request JSON:
1. `slug: string`
2. `bookingUid: string`
3. `format?: "copy" | "csv"`

Behavior:
1. Validate auth (admin/staff).
2. Load normalized reservation record.
3. Return payload for frontend export generation:
4. `requestId`
5. `payload` (reservation + guest + stays + audit summary + completion score)
6. `fileName` suggestion
7. Write `reservation_change_log` action `exported`.

Errors:
1. `400`, `401`, `403`, `404`, `500`

### 4) GET `/functions/v1/internal-team-member-reservation-oversight?userId=<id>&from=<date>&to=<date>`
Request:
1. `userId` required
2. `from` required (`YYYY-MM-DD`)
3. `to` required (`YYYY-MM-DD`)

Behavior:
1. Auth required, admin only.
2. Query reservations where `created_by` or `updated_by` equals `userId` and falls in date window.
3. Return list of oversight records:
4. `reservationId`
5. `bookingUid`
6. `yachtSlug`
7. `yachtName`
8. `startAt`
9. `endAt`
10. `status`
11. `guestName`
12. `completionScore`
13. `missingFields[]`
14. `lastAction`
15. `lastActionAt`
16. `lastUpdatedAt`

Errors:
1. `400`, `401`, `403`, `404`, `500`

## Existing Endpoint Sync Updates

### `internal-calendar-booking-reschedule`
On successful reschedule:
1. Update `reservation_details.booking_uid_current` to active UID.
2. Append previous UID into `booking_uid_history` (deduplicated).
3. Update `start_at`, `end_at`, `status`.
4. Write `reservation_change_log` action `rescheduled`.

### `internal-calendar-booking-cancel`
On successful cancel:
1. Update reservation status to `cancelled`.
2. Keep booking UID mapping.
3. Write `reservation_change_log` action `cancelled` with reason.

## Logging and CORS
1. Handle `OPTIONS` first on all endpoints.
2. Reuse shared helpers:
3. `getCorsHeaders`
4. `isOriginAllowed`
5. `json`
6. Log to `booking_request_logs` with endpoint names:
7. `internal-reservation-details`
8. `internal-reservation-details/export`
9. `internal-team-member-reservation-oversight`
10. plus existing reschedule/cancel endpoint logs

Suggested `details.reason` values:
1. `missing_auth_header`
2. `invalid_token`
3. `forbidden_non_admin`
4. `invalid_input`
5. `not_eligible`
6. `seeded_from_cal`
7. `updated`
8. `exported`
9. `rescheduled_sync`
10. `cancelled_sync`
11. `cal_error`
12. `unhandled_error`

## Validation Checklist
1. First open of booking seeds local record if missing.
2. Staff can view/export but cannot update.
3. Admin can update full guest/trip/stays data.
4. Export endpoint returns normalized payload.
5. Reschedule updates local UID mapping/history.
6. Cancel updates local status.
7. Team oversight endpoint returns admin-only enriched records.
8. Logs are written for success + failure paths.

## Notes
1. No frontend schema assumptions outside normalized payload fields.
2. Keep timezone default `America/Mazatlan`.
3. Keep public booking endpoints unchanged.
