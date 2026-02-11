# Booking V2: Half-Based Duration Patch (Revised)

## Summary
Replace the old “full-day block” model with a half-selected duration model.  
Every booking (3–8h) must choose `AM` or `PM`, and we send exact duration to Cal:

- `startHour = 08:00` for AM, `13:00` for PM
- `lengthInMinutes = requestedHours * 60`

This ensures Cal booking cards + attendee emails reflect the selected start half and exact requested hours.

---

## Manual Blocker (must complete first)
Cal event type `4718180` must have **Multiple Durations** enabled with:

- `240, 300, 360, 420, 480`

Without this, Cal may reject `lengthInMinutes` in create-booking payloads.

---

## Rules (Final)

## Hours / Half Rules
- Allowed requested hours: `3..8`
- `half` is required for all requests (`am | pm`)
- Start times:
  - `am` -> `08:00`
  - `pm` -> `13:00`

## Duration Fit Rules (critical)
- AM supports up to `8h` (08:00–16:00)
- PM supports up to `6h` (13:00–19:00)
- Server must reject invalid PM duration:
  - if `half="pm"` and `requestedHours > 6` -> `400`

---

## Code Changes

## 1) Frontend Policy Constants
**File:** `src/lib/bookingPolicy.ts`

- Set `BOOKING_MAX_HOURS = 8`
- Keep `BOOKING_MIN_HOURS = 3`
- Keep timezone constant `America/Mazatlan`
- Remove/stop using full-day specific helpers/constants in UI logic

---

## 2) Booking Form
**File:** `src/components/booking/BookingForm.tsx`

- Half is required for all hour selections.
- Update help text:
  - AM: 3–8h supported
  - PM: 3–6h supported
- Keep hours dropdown `3..8`.
- Add client-side validation:
  - block submit if `half` missing
  - block submit if `half="pm"` and `requestedHours > 6`
- Keep existing name/email required behavior.

---

## 3) Calendar UI
**File:** `src/components/booking/HalfDayCalendar.tsx`

- Remove full-day selection UI/button entirely.
- Always allow AM/PM selection when respective half is `available`.
- Keep visual state model (`available`, `booked`, `closed`).

---

## 4) Public Booking Page
**File:** `src/pages/PublicBooking.tsx`

- Remove any logic that clears/ignores half for higher hours.
- Always send `half` in payload:
  - `half: 'am' | 'pm'`
- Keep existing endpoint contracts unchanged.

---

## 5) Shared Server Policy
**File:** `supabase/functions/_shared/booking.ts`

### Validation (`resolveBookingBlock`)
- Require:
  - integer `requestedHours` in `3..8`
  - `half` must be `am|pm`
  - reject PM > 6h
- Compute:
  - `startHour = half === 'am' ? 8 : 13`
  - `blockMinutes = requestedHours * 60`
  - `blockScope = half === 'am' ? 'HALF_AM' : 'HALF_PM'`

### Selection Availability (`isSelectionAvailable`)
- Do not only check half color state.
- Must validate **duration-fit availability** for selected half and requested duration.

### Availability Resolver (`buildAvailabilityForMonth` / slot logic)
- Keep `duration=60` slot probe approach.
- Add/create helper to validate exact start + duration fit:
  - AM booking needs contiguous hourly slots from 08:00 through `(08 + requestedHours - 1)`
  - PM booking needs contiguous hourly slots from 13:00 through `(13 + requestedHours - 1)`
- Keep `fullOpen` field for backward compatibility, but it is no longer required by create flow.

### Booking Overlay (critical overlap fix)
When converting existing bookings into day-half booked states:
- Use actual booking `start/end` overlap against windows:
  - AM window: `08:00-12:00`
  - PM window: `13:00-19:00`
- Mark a half `booked` if booking interval overlaps that window.
- Do not rely only on metadata `block_scope` for long bookings.

---

## 6) Booking Create Function
**File:** `supabase/functions/public-booking-create/index.ts`

- Re-enable:
  - `lengthInMinutes: blockResolution.blockMinutes`
- Keep:
  - start from `zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE)`
- Add explicit guard:
  - `requestedHours > 8` -> `400`
  - `half='pm' && requestedHours>6` -> `400`
- Keep rate limit, Turnstile (optional), and conflict handling.
- Keep metadata:
  - include `requested_hours`
  - include `block_scope` (`HALF_AM`/`HALF_PM`)

---

## 7) API Version Handling
- Keep endpoint-specific Cal API versions that currently work in your environment.
- Ensure create-booking path uses working version for `/v2/bookings`.
- Ensure slots path uses working version for `/v2/slots`.

---

## Acceptance Criteria

## Booking Creation
- 4h AM -> start `08:00`, `lengthInMinutes=240`, scope `HALF_AM`
- 4h PM -> start `13:00`, `lengthInMinutes=240`, scope `HALF_PM`
- 5h AM -> start `08:00`, `lengthInMinutes=300`, scope `HALF_AM`
- 5h PM -> start `13:00`, `lengthInMinutes=300`, scope `HALF_PM`
- 7h PM -> rejected `400` (exceeds PM window)

## Conflict Behavior
- Repeating same date/half with overlapping duration returns `409`.

## Availability Rendering
- Day-half states update correctly after bookings:
  - PM booking marks PM as booked
  - Long AM booking that overlaps PM marks both halves as booked when applicable

## Legacy Regression
- `legacy_embed` yachts remain unaffected.

---

## Smoke Test Plan (Post-Deploy)

1. **Availability load**
- `GET /public-booking-availability?slug=made-for-waves&month=<target>`
- Expect `200` and PM availability on future dates.

2. **4h PM create**
- Expect `200`, verify Cal shows `13:00` start and 4h duration.

3. **Duplicate 4h PM**
- Expect `409`.

4. **5h AM create**
- Expect `200`, verify Cal shows `08:00` start and 5h duration.

5. **Invalid PM duration (7h PM)**
- Expect `400`.

6. **Post-booking availability re-check**
- Verify affected halves are marked booked based on overlap.

7. **Webhook insert**
- `POST /public-booking-webhook` test payload
- Expect `200` + row in `booking_webhook_events`.

---

## Pilot Rollback (safe)

```sql
-- Verify legacy embed URL exists
SELECT slug, cal_embed_url
FROM yachts
WHERE slug = 'made-for-waves';

-- If cal_embed_url is NULL, set it first:
-- UPDATE yachts
-- SET cal_embed_url = 'https://cal.com/prestigeyachts/3hr'
-- WHERE slug = 'made-for-waves';

-- Roll back to legacy mode
UPDATE yachts
SET booking_mode = 'legacy_embed',
    booking_public_enabled = false
WHERE slug = 'made-for-waves';
Deliverables
Code patch committed
Functions deployed
Smoke test report with status codes + booking UID/times
Confirmation that Cal booking cards/emails now show correct selected half + duration
Rollback status documented

