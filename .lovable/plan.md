

# Booking Guardrails V3 -- Backend Migration Plan

## Summary

Replace the V2 half-day (AM/PM) booking engine with V3 hour-granular policy across three edge-function files. No frontend changes.

## V3 Policy Rules

```text
Operating window:  06:00 - 18:00  (America/Mazatlan)
Morning window:    06:00 - 13:00
Buffer zone:       13:00 - 15:00  (blocks 3-4h starts)
Afternoon window:  15:00 - 18:00

Duration  Allowed starts
--------  --------------
3h        06:00-10:00 (end <= 13:00)  OR  15:00 (end = 18:00)
4h        06:00-09:00 (end <= 13:00)
5h        06:00-13:00 (end <= 18:00)
6h        06:00-12:00
7h        06:00-11:00
8h        06:00-10:00
```

## Changes by File

### 1. `supabase/functions/_shared/booking.ts`

- Change `BOOKING_POLICY_VERSION` to `'v3'`.
- Replace window constants: operating 6-18, morning 6-13, buffer 13-15, afternoon 15-18.
- Remove `BLOCK_DURATIONS`, `BlockScope`, `PM_MAX_HOURS` exports (no longer needed).
- Add new exported helpers:
  - `isStartAllowedByPolicy(requestedHours, startHour)` -- implements the table above.
  - `getValidStartsForDay(openHours: number[], requestedHours: number)` -- filters openHours through policy + contiguous-block check.
  - `deriveShiftFit(startHour, endHour)` -- returns `'morning'|'afternoon'|'full_span'`.
  - `resolveStartHourForCreate({ startHour?, half?, requestedHours })` -- uses `startHour` if present; falls back `am->6, pm->15`; validates via policy.
  - `isStartSelectionAvailable(day, requestedHours, startHour)` -- checks startHour exists in `day.validStartsByDuration[requestedHours]`.
- Rewrite `buildAvailabilityForMonth`:
  - Keep slot-fetching with `duration=60`.
  - Change booking blocking: extract exact booked intervals (start/end) and mark individual hours as occupied instead of synthetic AM/PM blocking.
  - Per day, compute `openHours: number[]` (hours in 6-18 that have a Cal slot and are not blocked).
  - Compute `validStartsByDuration` for durations 3-8 using `getValidStartsForDay`.
  - Keep `am`, `pm`, `fullOpen` for hybrid calendar highlighting (derived from openHours/validStarts).
- Remove old `resolveBookingBlock` and `isSelectionAvailable`; keep legacy type exports if needed for compatibility.

### 2. `supabase/functions/public-booking-availability/index.ts`

- Update response `constraints` object to V3 shape:
  ```json
  {
    "minHours": 3,
    "maxHours": 8,
    "timeStepMinutes": 60,
    "operatingWindow": "06:00-18:00",
    "morningWindow": "06:00-13:00",
    "bufferWindow": "13:00-15:00",
    "afternoonWindow": "15:00-18:00"
  }
  ```
- Each `days[date]` will include `am`, `pm`, `fullOpen`, `openHours`, and `validStartsByDuration`.

### 3. `supabase/functions/public-booking-create/index.ts`

- Accept `startHour` (number) as primary input alongside existing `half`.
- Use `resolveStartHourForCreate` to resolve final start hour (with legacy half fallback).
- Validate with `isStartAllowedByPolicy(requestedHours, startHour)`.
- Server-side re-check via `isStartSelectionAvailable` against freshly-built availability.
- Build Cal.com payload: `start = zonedDateTimeToUtcIso(date, startHour, 0, tz)`, `lengthInMinutes = requestedHours * 60`.
- Metadata: `policy_version: 'v3'`, `start_hour`, `end_hour`, `requested_hours`, `shift_fit`, `segment` (derived), `selected_half` (derived or from fallback).
- Conflict error message changed to "Selected date/time is no longer available".

### 4. CORS / Environment

- Verify `BOOKING_ALLOWED_ORIGINS` secret includes `http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173` alongside production origins. Will check current value and update if needed.

### 5. Deployment and Validation

- Deploy `public-booking-availability` and `public-booking-create`.
- Run validation calls:
  - `GET /public-booking-availability?slug=...&month=2026-02` -- confirm `constraints.timeStepMinutes` and `validStartsByDuration["3"]` in response.
  - `POST /public-booking-create` with valid `startHour=6, requestedHours=3` -- expect pass-through to Cal.com.
  - `POST` with invalid combo (e.g. `startHour=15, requestedHours=4`) -- expect 400.

## Technical Notes

- The `fetchSlotsOpenMap` function will be refactored to return `Map<string, number[]>` (raw open hours per day) instead of `Map<string, OpenState>`.
- Booking blocking will parse each booking's start/end into local hours and remove those hours from the open set, rather than using synthetic AM/PM flags.
- All existing helper functions (Cal API, CORS, rate limiting, Turnstile, webhook signature) remain unchanged.
- `bookingPolicy.ts` (frontend) is NOT modified per the request -- backend only.

