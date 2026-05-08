# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on port 8080 (host `::`).
- `npm run build` — production build (output: `dist/`). Netlify deploys from this.
- `npm run build:dev` — build in development mode (keeps `lovable-tagger` plugin).
- `npm run lint` — ESLint over `**/*.{ts,tsx}`. Ignores `dist`, `cal.com/**`, `supabase/.temp/**`. There is no test runner configured.
- `npm run preview` — preview a built bundle.

This repo is also synced with Lovable (project URL in `README.md`); changes pushed to `main` reflect there and vice versa. The `componentTagger` Vite plugin runs only in dev mode for Lovable's component picker.

Path alias: `@/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`).

## Architecture

This is a Vite + React 18 + TypeScript SPA backed by Supabase (Postgres + Auth + Edge Functions). It is the booking and calendar admin tool for Prestige Yachts Alliance, integrating Cal.com as the underlying scheduling provider.

`docs/booking-system-architecture.md` is the authoritative reference for the booking system — read it before non-trivial booking/calendar work.

### Routes (`src/App.tsx`)

- `/` — `Index` (public landing)
- `/book/:yachtSlug` — `PublicBooking` (no auth, public reservation flow)
- `/book` — `Book` (5-step internal wizard, auth required)
- `/calendar` — admin calendar + reservation center (auth, admin role enforced server-side)
- `/dashboard`, `/team`, `/deposit`, `/settings` — auth-gated
- All authed routes wrap in `<ProtectedRoute>`; `App.tsx` composes providers in this order: `QueryClient → ThemeProvider → LanguageProvider → AuthProvider → UserPreferenceSync → TooltipProvider → BrowserRouter`.

### Auth model (`src/contexts/AuthContext.tsx`)

- Supabase Auth session held in context; role (`admin | staff | null`) read from `user_roles` table.
- `onAuthStateChange` listener is registered **before** `getSession()` (intentional ordering — do not flip).
- Role fetch inside the auth callback is deferred via `setTimeout(..., 0)` to avoid Supabase listener deadlocks. Preserve that pattern when editing.
- `signOut` clears local state even if the API call fails (handles expired sessions).

### Supabase integration

- Client: `src/integrations/supabase/client.ts`. Reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from env. Auth persists in `localStorage`.
- Generated DB types: `src/integrations/supabase/types.ts` (do not hand-edit — regenerate from Supabase).
- Project ID pinned in `supabase/config.toml`: `uykzfpzawuyaroksyjsc`.
- All edge functions have `verify_jwt = false` in `config.toml`. Authentication is enforced **manually inside each internal function** by reading the `Authorization` bearer token, validating with Supabase, and checking `user_roles` for admin where required. CORS, rate limiting (`ip_hash`/`email_hash` via `BOOKING_RATE_LIMIT_SALT`), and Turnstile are also implemented in shared helpers (`supabase/functions/_shared/booking.ts`, `_shared/internal-availability.ts`).

### Booking system (Cal.com-backed)

Single source of truth for policy constants on the frontend: `src/lib/bookingPolicy.ts`. Mirror exists in `supabase/functions/_shared/booking.ts` for edge code — keep them in sync.

Booking Policy V3:
- Timezone: `America/Mazatlan`
- Duration: 3–8 hours; Operating window: 06:00–18:00; 60-minute step
- Inter-booking buffer: 2 hours, enforced **server-side** via `reservation_details`
- Allowed start rule (frontend): any 3–8h block fitting within 06:00–18:00
- Availability response shape includes `validStartsByDuration` per duration key (`'3'..'8'`); UI must use this rather than legacy AM/PM half-day logic.

Yacht booking eligibility requires: `booking_public_enabled = true`, `booking_mode = 'policy_v2'`, `cal_event_type_id` set. If a Cal event type rejects fixed-length bookings, create handlers retry without `lengthInMinutes` (compatibility fallback — preserve it).

Cal.com API versions used (do not change without testing both flows): slots `2024-09-04`, bookings `2024-08-13`.

### Edge functions (`supabase/functions/`)

- Public (no auth, used by `/book/:yachtSlug`): `public-booking-availability`, `public-booking-create`, `public-booking-webhook`
- Internal booking (auth, used by `/book` wizard): `internal-booking-availability`, `internal-booking-create`
- Admin calendar/reservation (admin role): `internal-calendar-bookings`, `internal-calendar-booking-reschedule`, `internal-calendar-booking-cancel`, `internal-reservation-details` (+ `/export`), `internal-team-member-reservation-oversight`
- Misc: `fetch-exchange-rate`, `get-users`, `get-user-activity`, `update-user-profile`

`internal-calendar-booking-reschedule` does a native Cal reschedule when duration is unchanged, but **creates new + cancels old** when duration changes. Cancellation is idempotent for already-cancelled bookings.

### Data model highlights

- `yachts` — booking config (`cal_event_type_id`, `booking_mode`, `booking_public_enabled`, `booking_v2_live_from`, legacy `cal_embed_url`)
- `booking_rate_limits`, `booking_request_logs`, `booking_webhook_events` — public booking platform support
- `user_activity` — analytics events (`trip_booked`, wizard step events) tracked via `useActivityTracker`
- `guest_profiles`, `reservation_details`, `reservation_stays`, `reservation_change_log` — reservation ops; schema in `docs/sql/luxury_reservation_phase_b.sql`
- `profiles.{phone_number, preferred_theme, preferred_language}` — user preferences synced by `<UserPreferenceSync />`

### UI conventions

- shadcn/ui components live in `src/components/ui/` (configured by `components.json`, base color `slate`, CSS variables enabled). Prefer composing these over building bespoke primitives.
- Lucide icons (`lucide-react`), Tailwind, `tailwind-merge` + `clsx` via `cn()` in `src/lib/utils.ts`.
- Forms: `react-hook-form` + `zod` (`@hookform/resolvers`).
- Server state: `@tanstack/react-query` (single `QueryClient` instantiated in `App.tsx`).
- Toasts: both Radix-based `<Toaster />` and `sonner` are mounted; existing code uses both.
- Theme: `next-themes` via `src/components/theme/ThemeProvider.tsx` (`attribute="class"`, `defaultTheme="system"`).
- i18n: `src/contexts/LanguageContext.tsx` + `src/lib/uiText.ts` (custom — no i18n library).

### Booking-relevant entry points

- Yacht detail "Book" CTA routes to **internal** flow: `src/components/yacht/YachtDetail.tsx` → `/book?yacht=<slug>&step=day`. Public booking remains separately at `/book/:yachtSlug`.
- Calendar page composes admin-calendar primitives (`src/components/admin-calendar/`): `CalendarToolbar`, `MonthGrid`, `TimeGrid`, `EventBlock`, `EventDrawer`, `ReservationCenterModal`, `YachtTabs`.
- Internal wizard primitives: `src/components/calendar/` (`BookingWizard`, `StepYacht`, `StepDay`, `StepDuration`, `StepStartTimes`, `StepClient`, `StepHeader`).

## Deployment

Netlify (`netlify.toml`): `npm run build` → `dist/`, with SPA catch-all redirect (`/*` → `/index.html`). Lovable also publishes from this repo.
