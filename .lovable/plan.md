# Booking V2 Smoke Test Execution Plan (Updated)

## Summary
Validate Booking V2 end-to-end for pilot yacht `made-for-waves` after the `660 -> 480` full-day patch, then rollback safely to legacy mode.

## Preconditions
- Pilot yacht is enabled for V2:
```sql
SELECT slug, booking_mode, booking_public_enabled, cal_event_type_id, booking_v2_live_from
FROM yachts
WHERE slug = 'made-for-waves';
Expected:

booking_mode = 'policy_v2'

booking_public_enabled = true

cal_event_type_id = 4718180

Cal event type 4718180 is configured with:

timezone America/Mazatlan

durations 240, 360, 480

availability window 08 (lines 0-19, column 0)

time-slot interval set to 60 minutes

published ON

Edge function patch is deployed:

full-day block duration is 480 in server/shared policy

availability checks use 240, 360, 480

Test Data Rules
Use unique attendee emails for every create call (qa+timestamp+N@...) to avoid rate-limit false positives.
Use half="pm" only for 4h tests.
Use half=null for 5h tests.
If month has no PM availability, test current month first, then next month.
Step 1: Discover Test Dates
Call availability for current month:
http

GET /functions/v1/public-booking-availability?slug=made-for-waves&month=YYYY-MM
If no valid PM date exists, repeat for next month.
Pick:
date_pm: first date with pm = "available"
date_full: first different date with am = "available", pm = "available", fullOpen = true
Step 2: Smoke Tests B–F
Test B — Availability
Request:

http

GET /functions/v1/public-booking-availability?slug=made-for-waves&month=<selected-month>
Pass:

200
response includes days
at least one date has pm = "available"
Test C — Create 4h PM
Request:

http

POST /functions/v1/public-booking-create
{
  "slug": "made-for-waves",
  "date": "<date_pm>",
  "requestedHours": 4,
  "half": "pm",
  "attendee": { "name": "QA PM 1", "email": "qa+pm1@example.com" }
}
Pass:

200 with bookingUid and status
Test D — Repeat Same 4h PM
Same payload/date as Test C, new email.
Pass:

409 conflict (Selected date/segment is no longer available)
Test E — Create 5h Full-Day
Request:

http

POST /functions/v1/public-booking-create
{
  "slug": "made-for-waves",
  "date": "<date_full>",
  "requestedHours": 5,
  "half": null,
  "attendee": { "name": "QA Full 1", "email": "qa+full1@example.com" }
}
Pass:

200 with bookingUid and status
Test E2 — Repeat Same Full-Day
Same payload/date as Test E, new email.
Pass:

409 conflict
Test F — Webhook Insert
If CAL_WEBHOOK_SECRET is NOT set:

http

POST /functions/v1/public-booking-webhook
{ "triggerEvent": "BOOKING_CREATED", "payload": { "uid": "qa-test-uid-1" } }
Pass:

200
new row in booking_webhook_events with matching event_type + booking_uid
If CAL_WEBHOOK_SECRET IS set:

send valid signed payload with x-cal-signature-256
expect 200 and row insert
Step 3: Post-Test Availability Verification
Re-run availability for the tested month and confirm:

date_pm now shows pm = "booked"
date_full now shows am = "booked" and pm = "booked"
Step 4: Safe Rollback to Legacy
sql

-- 1) Verify legacy embed URL exists
SELECT slug, cal_embed_url
FROM yachts
WHERE slug = 'made-for-waves';

-- 2) If cal_embed_url is NULL, set it first:
-- UPDATE yachts
-- SET cal_embed_url = 'https://cal.com/prestigeyachts/3hr'
-- WHERE slug = 'made-for-waves';

-- 3) Rollback mode
UPDATE yachts
SET booking_mode = 'legacy_embed',
    booking_public_enabled = false
WHERE slug = 'made-for-waves';
Final Report Format
Return one summary table with:

Test name
HTTP status
Pass/Fail
Key response details (requestId, bookingUid, error message if any)
Include:

selected dates (date_pm, date_full)
webhook insert proof row
rollback status

