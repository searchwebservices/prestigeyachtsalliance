

# Booking V2 Deployment Execution Plan

## Current State

| Item | Status |
|---|---|
| Edge function code (3 functions + shared helper) | In repo, not yet deployed |
| `supabase/config.toml` (verify_jwt=false) | Already configured |
| Secrets | **None configured** |
| Yachts | 2 exist: `made-for-waves` (has `cal_embed_url`), `ocean-breeze` (no `cal_embed_url`) -- both `legacy_embed`, no `cal_event_type_id` |
| DB tables (`booking_rate_limits`, `booking_request_logs`, `booking_webhook_events`) | Already exist |
| Frontend (`/book/:yachtSlug`, booking components) | Already exists |

---

## Step 1: Set Secrets

**Known-value secrets** (set directly, no user input needed):
- `CAL_API_BASE_URL` = `https://api.cal.com`
- `CAL_API_VERSION` = `2024-08-13`
- `BOOKING_ALLOWED_ORIGINS` = `https://prestigeyachtsalliance.lovable.app,http://localhost:5173`
- `BOOKING_RATE_LIMIT_MAX_REQUESTS` = `12`
- `BOOKING_RATE_LIMIT_WINDOW_MINUTES` = `60`

**User-provided secrets** (will prompt):
- `CAL_API_KEY` -- from Cal.com Settings > Developer > API Keys
- `BOOKING_RATE_LIMIT_SALT` -- a long random string (e.g. output of `openssl rand -hex 32`)

**Optional secrets** (will ask if desired):
- `TURNSTILE_SECRET_KEY` -- only if enabling Cloudflare Turnstile captcha
- `CAL_WEBHOOK_SECRET` -- only if Cal.com webhook signing is configured

**Turnstile dependency note**: If `TURNSTILE_SECRET_KEY` is set server-side, the frontend needs `VITE_TURNSTILE_SITE_KEY` in the `.env` to render the widget. Since `.env` is auto-managed and no `VITE_TURNSTILE_SITE_KEY` is currently present, I will leave `TURNSTILE_SECRET_KEY` unset unless you confirm you want it and provide the site key too.

## Step 2: Deploy Edge Functions

Deploy all three (shared `_shared/booking.ts` is bundled automatically):
- `public-booking-availability`
- `public-booking-create`
- `public-booking-webhook`

## Step 3: Pre-flight Cal Readiness Check

**Blocker**: Neither yacht has `cal_event_type_id` set. Before enabling any yacht, you must provide:
- The numeric Cal.com event type ID for the pilot yacht
- Confirm in Cal.com that the event type has:
  - Timezone = `America/Mazatlan`
  - Schedule window covering 08:00-19:00
  - Allowed durations include 240, 360, and 660 minutes

I will ask you for the `cal_event_type_id` and which yacht slug to pilot.

## Step 4: Enable Pilot Yacht

Run SQL (after you provide the event type ID and slug):

```text
UPDATE yachts
SET cal_event_type_id = <ID>,
    booking_v2_live_from = CURRENT_DATE,
    booking_public_enabled = true,
    booking_mode = 'policy_v2'
WHERE slug = '<pilot-slug>';
```

## Step 5: Smoke Tests

Run all 6 tests via edge function curl:

A. `GET /public-booking-availability?slug=test-yacht&month=2026-02` -- expect 404
B. `GET /public-booking-availability?slug=<pilot>&month=2026-02` -- expect 200 with days map
C. `POST /public-booking-create` with `requestedHours=4, half=null` -- expect 400
D. `POST /public-booking-create` with `requestedHours=4, half="am"` -- expect 200 or 409
E. Repeat D -- expect 409
F. `POST /public-booking-webhook` with test payload -- expect 200, verify DB insert

## Step 6: Rollback SQL (with cal_embed_url safeguard)

```text
-- Check cal_embed_url first
SELECT slug, cal_embed_url FROM yachts WHERE slug = '<pilot-slug>';

-- If cal_embed_url IS NULL, set it before rollback:
-- UPDATE yachts SET cal_embed_url = '<legacy-cal-url>' WHERE slug = '<pilot-slug>';

-- Then rollback:
UPDATE yachts
SET booking_mode = 'legacy_embed',
    booking_public_enabled = false
WHERE slug = '<pilot-slug>';
```

For `made-for-waves`: `cal_embed_url` is already set (`https://cal.com/prestigeyachts/3hr`), safe to rollback directly.
For `ocean-breeze`: `cal_embed_url` is NULL -- must set it before any rollback to legacy.

---

## Decisions Needed From You Before Execution

1. **CAL_API_KEY** value
2. **BOOKING_RATE_LIMIT_SALT** value
3. Which yacht slug to pilot (`made-for-waves` or `ocean-breeze`)?
4. The numeric `cal_event_type_id` for that yacht from Cal.com
5. Do you want `TURNSTILE_SECRET_KEY` and/or `CAL_WEBHOOK_SECRET` set now? (default: skip both)

