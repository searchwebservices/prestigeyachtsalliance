# Agency OS Implementation — Handoff

This doc captures the in-progress implementation of a new admin interface for Daniela ("Dani"), based on the prototype in `Yacht Agency OS - Dani/`. Previous session did the planning and source review but **did not write any code yet**. The next session should be able to pick up from here without re-reading the prototype source.

## User-locked decisions

The user explicitly chose these in the prior session — do not re-litigate:

| Decision | Value |
|---|---|
| Role identifier (in `app_role` enum) | `agency_manager` |
| Route path | `/agency` |
| Visual fidelity | Pixel-perfect — port inline styles verbatim, do **not** rebuild with Tailwind/shadcn |
| Data wiring scope | Mock data only this pass; document the wire-up plan for a follow-up |
| Language | Keep Spanish (matches the prototype) |

User's exact framing: *"I dont want to change a THING about what is already implemented, this will be a test interface only for a user type (called 'Dani'). Only users assigned this role will see this interface. Lets plan to link it entirely with the real data from the app though."*

## Source prototype

Lives in `Yacht Agency OS - Dani/`:

- `Yacht Agency OS.html` — entry point (loads scripts in order)
- `data.js` (407 lines) — mock yachts, leads, bookings, alerts, helpers
- `theme.jsx` (269 lines) — theme tokens + UI primitives (Pill, Stat, Spark, BarSeries, SectionHd, Kbd, Avatar, YachtMark, SourceDot, Priority, Btn, Card, YachtPhoto)
- `app.jsx` (310 lines) — OS shell (MenuBar + window chrome + Dock), CommandPalette (Cmd+K)
- `surface-dashboard.jsx` (403 lines)
- `surface-inbox.jsx` (395 lines)
- `surface-calendar.jsx` (353 lines)
- `surface-portfolio.jsx` (295 lines)
- `Yacht Agency OS _standalone_.html` (1.6 MB) — bundled standalone, ignore
- `tweaks-panel.jsx` and `design-canvas.jsx` — Claude Design infrastructure, **do not port** (these are for the prototype canvas, not the real app)

### Key observation that simplifies the port

The prototype defines 3 theme variants (`bridge`, `marina`, `concierge`) and each surface dispatches per-theme. **`app.jsx` hardcodes `theme = Themes.marina`** — only the marina (warm-cream UniqueOS) variant is actually rendered. **Skip the Bridge and Concierge implementations entirely.** The dispatcher in each surface looks like:

```js
if (t.id === 'bridge') return <BridgeDashboard ... />;
if (t.id === 'marina') return <MarinaDashboard ... />;
return <ConciergeDashboard ... />;
```

Port only the `Marina*` variants. That cuts ~60% of the source line count.

The prototype is anchored to `TODAY = new Date(2026, 4, 7)` (May 7 2026) — keep this anchor in the ported `data.ts` so the mock data stays internally consistent, even though real "today" will diverge.

## Existing app context (relevant facts)

### Auth & roles (read these first)

- `src/contexts/AuthContext.tsx`:
  - `AppRole = 'admin' | 'staff' | null`
  - `onAuthStateChange` registered **before** `getSession()` (intentional ordering)
  - Role fetch deferred via `setTimeout(..., 0)` to avoid Supabase listener deadlocks
  - **Preserve both patterns** when extending
- `src/components/ProtectedRoute.tsx` — checks `user` only, not role. Need a new `AgencyRoute` that also checks `role === 'agency_manager'` (admin should probably also have access for testing — confirm with user if ambiguous).
- `supabase/migrations/20251203193306_*.sql` defines `CREATE TYPE public.app_role AS ENUM ('admin', 'staff');` and `has_role()` SQL function.

### Database

- Yachts table has `commission_amount`, `owner_notes`, `cal_event_type_id`, `booking_mode`, `booking_public_enabled` columns — useful for the future wire-up.
- Postgres enum extension: `ALTER TYPE public.app_role ADD VALUE 'agency_manager';` — must run in its own transaction (Postgres limitation).

### Routing

- All routes in `src/App.tsx`. Provider order is: `QueryClient → BrowserRouter → ThemeProvider → LanguageProvider → AuthProvider → UserPreferenceSync → TooltipProvider → Routes`. **`BrowserRouter` must stay outermost** — Lovable's `componentTagger` needs it.
- Public surfaces today: `/login`, `/reserve`, `/reserve/book`, `/reserve/inquire`. Everything else is `<ProtectedRoute>`.

## Implementation plan (ordered)

The previous session set this up as 14 todos. Restore on resume:

1. **Migration** — `supabase/migrations/<timestamp>_agency_manager_role.sql`:
   ```sql
   ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agency_manager';
   ```
   Note: `ADD VALUE` cannot run inside a transaction with other DDL in some Postgres versions — keep this migration **single-statement only**.

2. **AuthContext** — extend `AppRole` union to `'admin' | 'staff' | 'agency_manager' | null`. Add `isAgencyManager: boolean` to context value (mirrors `isAdmin`). Update `defaultAuthContext` accordingly.

3. **AgencyRoute guard** — `src/components/AgencyRoute.tsx`. Pattern: same shape as `ProtectedRoute` but also check `role === 'agency_manager' || role === 'admin'`. Redirect non-matching authed users to `/dashboard`. Open question for the user: *should `admin` also see this interface, or strictly `agency_manager`?* Default to allowing admin (so user can self-test without creating a second account) and call this out when reporting back.

4. **Port `data.js` → `src/lib/agency-os/data.ts`** as TypeScript. Define interfaces:
   ```ts
   export type YachtClass = 'own' | 'partner';
   export type LeadSource = 'experiencia' | 'reserva' | 'abierta';
   export type LeadPriority = 'urgente' | 'alta' | 'media' | 'baja';
   export type LeadStatus = 'nuevo' | 'leído' | 'esperando';
   export type BookingType = 'reservation' | 'block' | 'hold';
   export type Scenario = 'typical' | 'busy' | 'quiet';
   export type Density = 'compact' | 'comfortable';
   ```
   Keep `TODAY = new Date(2026, 4, 7)` and the helper `day(offset, h, m)` exactly. Export the same shape: `{ TODAY, TZ_LABEL, yachts, yById, EXPERIENCES, leadsFor, bookingsFor, alertsFor, todayBookings, revenue, utilization, fmt, day }`.

5. **Port `theme.jsx` → `src/components/agency-os/theme.tsx`**. Export:
   - `marinaTheme` const (single theme object — drop the `Themes` map)
   - UI primitive components: `Pill`, `Stat`, `Spark`, `BarSeries`, `SectionHd`, `Kbd`, `Avatar`, `YachtMark`, `SourceDot`, `Priority`, `Btn`, `Card`, `YachtPhoto`
   - Each takes `theme` as a prop (don't refactor to context — it's only one level deep)

6. **Port `app.jsx` → `src/components/agency-os/AgencyShell.tsx`**:
   - Replicate `MenuBar`, `Dock`, `ScreenShell` (rename to `AgencyShell`)
   - **Drop**: `DesignCanvas`, `DCSection`, `DCArtboard`, `TweaksPanel`, `TweakRadio`, `TweakColor`, `useTweaks` — those are prototype scaffolding, not part of the real app
   - **Keep**: scenario/density state, but lift to URL search params or local state (user can choose; suggest local state for simplicity)
   - Keep `CommandPalette` as a separate component

7. **Port the four surfaces** — Marina variants only:
   - `src/components/agency-os/surfaces/Dashboard.tsx` — port `MarinaDashboard` from `surface-dashboard.jsx` lines 180-296
   - `src/components/agency-os/surfaces/Inbox.tsx` — port `MarinaInbox` + shared `ConvertDialog` and `Field` from `surface-inbox.jsx` lines 35-292
   - `src/components/agency-os/surfaces/Calendar.tsx` — port `MarinaCal` + shared `BlockDialog`, `Toolbar`, `daysOfWeek`, `bgColor`, `borderColor` from `surface-calendar.jsx` lines 18-276
   - `src/components/agency-os/surfaces/Portfolio.tsx` — port `MarinaPortfolio` + shared `AddYachtDialog`, `FilterBar`, `MarinaStatItem`, `Toggle`, `inp`, `Field` from `surface-portfolio.jsx` lines 21-233

8. **Page + route** — `src/pages/AgencyOS.tsx` mounts `AgencyShell` with surface state. Register in `src/App.tsx`:
   ```tsx
   <Route path="/agency" element={<AgencyRoute><AgencyOS /></AgencyRoute>} />
   ```

9. **Wire-up doc** — `docs/agency-os-data-wireup.md` — see "Data wire-up plan" below for the content.

10. **Verify** — `npm run dev`, log in as a test user with `agency_manager` role (need to manually insert via Supabase dashboard or SQL after migration), navigate to `/agency`, click through all four surfaces. Verify Cmd+K opens the palette.

## Data wire-up plan (for the wire-up doc)

Each mock data source maps to a real source with varying difficulty. Document this so the user can prioritize the follow-up.

### Yachts (easiest — already in DB)

- Source: `yachts` table in Supabase
- Existing query patterns: see `src/components/yacht/` for read patterns
- Mapping:
  | Mock field | DB field | Notes |
  |---|---|---|
  | `id` | `slug` | Use slug as the prototype's id |
  | `name` | `name` | Direct |
  | `klass` | (new column or derived) | DB doesn't distinguish own vs partner today. Add `yachts.ownership_class enum('own','partner')` or derive from `commission_amount IS NOT NULL` |
  | `type` | `category` or new `yacht_type` column | Check schema |
  | `length`, `capacity`, `hourlyRate`, `year` | existing columns | Direct |
  | `base`, `captain` | `home_marina`, `default_captain` (may need new columns) | Check |
  | `bookable` | `booking_public_enabled` | Direct |
  | `hue` | (new column or hash of slug) | Visual only — hash the slug for stable color |
  | `commission` | `commission_amount` | Direct (may need to convert percentage representation) |
  | `ownerName`, `ownerContact` | `owner_notes` (currently free-text) | Needs structured columns or a `yacht_owners` table |
  | `tagline` | `tagline` (likely missing) | Add column |

- **Action**: Add a `useAgencyYachts()` hook in `src/lib/agency-os/queries.ts` that returns the prototype shape from a Supabase query. Add any missing columns via a migration in the same PR as the wire-up.

### Bookings (medium — Cal.com via existing edge functions)

- Source: Cal.com bookings, accessed through `internal-calendar-bookings` edge function (already exists, admin-only)
- The edge function returns Cal.com booking shape; `reservation_details` table has Prestige-side data (party, value, notes, conflict flag)
- Mapping:
  - `bookingsFor(scenario)` → call `internal-calendar-bookings` with date range covering the visible week/month
  - `type: 'reservation' | 'block' | 'hold'` — Cal has only confirmed bookings; `block` and `hold` need to come from a new `calendar_blocks` table or a status column on `reservation_details`
  - `conflict` flag — derive client-side from overlap check + 2h buffer rule (already encoded in `src/lib/bookingPolicy.ts` and `supabase/functions/_shared/booking.ts`)

- **Action**:
  1. Allow `agency_manager` role through the auth check in `internal-calendar-bookings` (currently admin-only)
  2. Add a `calendar_blocks` table for maintenance/owner blocks (or extend an existing table)
  3. Add a `useAgencyBookings(dateRange, scenario)` hook
  4. Replace `bookingsFor()` mock in surfaces with the hook

### Leads (hardest — Netlify Forms is the source of truth)

This is the gnarly one. Leads land in Netlify Forms (not Supabase). The frontend cannot read Netlify Forms directly — it requires Netlify's API with a personal access token, which can't ship in client code.

Options, ranked:

1. **(Recommended) Sync Netlify → Supabase via webhook.** Netlify Forms supports outgoing webhooks per submission. Add a Supabase Edge Function `netlify-forms-webhook` that accepts the payload and inserts into a new `leads` table. Configure the webhook in the Netlify dashboard for each form (`reservation`, `reservation_lead`, `inquiry`). Downstream: `useAgencyLeads()` queries the `leads` table directly.
   - Pros: real-time, queryable, can store status/priority/assigned-to, supports the prototype's filters cleanly
   - Cons: requires schema design (a `leads` table that unifies the three form shapes), webhook config, edge function with shared secret validation
2. **Proxy via edge function on each request.** `internal-leads` edge function calls Netlify API with a server-side token, returns shape the frontend wants.
   - Pros: no DB schema, no sync delay
   - Cons: every page load hits Netlify API (rate limits), no place to store status/priority, can't do the filter sidebar efficiently
3. **Manual paste / no integration.** Ricardo/Dani check Netlify dashboard separately. Prototype Inbox is decorative until #1 ships.

- **Action**: Implement option 1 in a follow-up. Schema sketch:
  ```sql
  CREATE TABLE leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    netlify_form_name text NOT NULL,
    netlify_submission_id text UNIQUE,
    received_at timestamptz NOT NULL DEFAULT now(),
    source text,             -- 'experiencia' | 'reserva' | 'abierta'
    channel text,            -- 'web' | 'whatsapp' | 'email' | 'directa'
    experience text,
    guest_name text,
    party int,
    country text,
    requested_date date,
    backup_date date,
    hours numeric,
    note text,
    value_estimate_usd numeric,
    priority text DEFAULT 'media',  -- 'urgente'|'alta'|'media'|'baja'
    status text DEFAULT 'nuevo',     -- 'nuevo'|'leído'|'esperando'|'archivado'|'convertido'
    preferred_yacht_id uuid REFERENCES yachts(id),
    raw_payload jsonb NOT NULL
  );
  ```

### Alerts (derived)

- Source: client-side derivation from bookings + leads
- The mock `alertsFor()` returns hard-coded scenarios. Real implementation walks the bookings array, checks for overlaps + buffer-rule violations, and emits matching alert objects.
- **Action**: Replace `alertsFor()` with a derived `useMemo` in the Dashboard surface. No backend work needed.

### Revenue / utilization (derived)

- Source: aggregate over real bookings
- `revenue(scenario)` → `bookings.filter(...).reduce((s, b) => s + b.value, 0)` over MTD
- `utilization(yachtId, scenario)` → for each of last 30 days, count `bookings_on_day_for_yacht / max_slots_per_day`. Cache the result.
- **Action**: Add `useAgencyRevenue()` and `useAgencyUtilization(yachtId)` hooks once bookings are live.

## Files already read (skip re-reading)

The previous session read all of these in full:
- `Yacht Agency OS - Dani/Yacht Agency OS.html`
- `Yacht Agency OS - Dani/data.js`
- `Yacht Agency OS - Dani/theme.jsx`
- `Yacht Agency OS - Dani/app.jsx`
- `Yacht Agency OS - Dani/surface-dashboard.jsx`
- `Yacht Agency OS - Dani/surface-inbox.jsx`
- `Yacht Agency OS - Dani/surface-calendar.jsx`
- `Yacht Agency OS - Dani/surface-portfolio.jsx`
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `index.html`, `netlify.toml`, `src/lib/netlifyForms.ts`, `src/pages/ReserveBook.tsx` (from earlier turn — Netlify Forms 404 issue, since resolved)

## Open questions for the user (raise on resume)

1. Should `admin` role also be allowed into `/agency`, or strictly `agency_manager`? (Default plan: allow both. If user wants strict, change the `AgencyRoute` check.)
2. Should the `Tweaks` panel from the prototype (scenario switcher: typical/busy/quiet, density: compact/comfortable, accent color picker) be exposed in the real app for testing, or hardcoded to defaults? Defaults: `scenario='typical'`, `density='comfortable'`, `accent='#c96442'`. (Suggest: hide the panel, hardcode defaults; expose later if needed.)

## Verification checklist

When implementation is done:
- [ ] `npm run lint` passes (no new errors in `src/components/agency-os/`, `src/pages/AgencyOS.tsx`)
- [ ] `npm run build` succeeds
- [ ] `npm run dev` boots and `/agency` renders for `agency_manager` user
- [ ] Non-`agency_manager`/`admin` authed users get redirected away from `/agency`
- [ ] Unauthenticated users get redirected to `/login`
- [ ] All four surfaces render: Panel (dashboard), Bandeja (inbox), Calendario, Flota (portfolio)
- [ ] Dock navigation switches surfaces
- [ ] Cmd+K opens command palette; Esc closes
- [ ] Existing routes (`/`, `/dashboard`, `/calendar`, `/book`, `/reserve*`, `/login`) are untouched and still work
