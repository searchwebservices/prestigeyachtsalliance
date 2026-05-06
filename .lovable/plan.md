## Goal
Make Trimaran | La Paz bookable through the internal system, and ensure any new yacht added going forward defaults to internal booking (so admins don't have to remember to flip it).

## Changes

### 1. Enable internal booking for Trimaran | La Paz (data update)
Update the existing yacht row:
- `booking_mode` → `policy_v2`
- `booking_public_enabled` → `true`
- `booking_v2_live_from` → today (2026-05-06) so it's immediately bookable

(Made for Waves is already configured this way — no change.)

### 2. New yachts default to internal booking (`AddYachtDialog.tsx`)
- Change the form default `booking_mode` from `'legacy_embed'` to `'policy_v2'`.
- Change the default `booking_public_enabled` to `true`.
- Default `booking_v2_live_from` to today's date in the form so the date input is pre-filled (admin can still override).
- Keep "Not bookable" as a selectable option for edge cases, but "Internal booking system" is now the pre-selected default.

### 3. No edge function or schema changes
The internal availability + booking edge functions already work for any yacht with `booking_mode = 'policy_v2'`. No backend code changes needed.

## Verification
- Reload `/book`, pick **Trimaran | La Paz**, confirm step 2 (calendar) loads availability without the "not eligible" 404.
- Add a test yacht via the admin dialog → confirm it lands as `policy_v2` + public enabled and shows up immediately as bookable.
