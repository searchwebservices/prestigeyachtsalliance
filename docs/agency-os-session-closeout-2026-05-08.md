# Agency OS — Session Close-Out (2026-05-08)

Final session of the Agency OS port. The interface ships at `/agency` behind a
new role; this doc captures what shipped, what's still mock, and what's open.

## What shipped

Commit [`3342391`](https://github.com/searchwebservices/prestigeyachtsalliance/commit/3342391) on `main` — "Add Agency OS surface at /agency for the new agency_manager role".

### Code

- `supabase/migrations/20260508050425_agency_manager_role.sql` — extends
  `app_role` enum with `agency_manager`. **Applied to remote Supabase via
  Lovable** during the role-assignment step on 2026-05-08.
- `src/contexts/AuthContext.tsx` — extends `AppRole` to
  `'admin' | 'staff' | 'agency_manager' | null`; adds `isAgencyManager`
  helper. Preserves the intentional ordering (`onAuthStateChange` before
  `getSession`) and the `setTimeout(0)` deferral inside the role fetch.
- `src/components/AgencyRoute.tsx` — route guard. Admits
  `agency_manager` **and** `admin` (admin is the self-test escape hatch —
  tighten later, see "Open items").
- `src/lib/agency-os/data.ts` — typed mock data, anchored to
  `TODAY = 2026-05-07` for reproducibility. Ports `data.js` from the
  prototype.
- `src/components/agency-os/theme.tsx` — Marina theme (the warm-cream
  UniqueOS variant — Bridge / Concierge variants from the prototype were
  intentionally skipped) plus the UI primitives (`Pill`, `Stat`, `Spark`,
  `BarSeries`, `SectionHd`, `Kbd`, `Avatar`, `YachtMark`, `SourceDot`,
  `Priority`, `Btn`, `Card`, `YachtPhoto`).
- `src/components/agency-os/AgencyShell.tsx` — desktop chrome (menu bar,
  dock, Cmd+K command palette). Drops the prototype's
  DesignCanvas / TweaksPanel scaffolding.
- `src/components/agency-os/surfaces/Dashboard.tsx`
- `src/components/agency-os/surfaces/Inbox.tsx`
- `src/components/agency-os/surfaces/Calendar.tsx`
- `src/components/agency-os/surfaces/Portfolio.tsx`
- `src/pages/AgencyOS.tsx` — surface state + shell mount. Hardcodes
  `scenario='typical'`, `density='comfortable'`.
- `src/App.tsx` — registers `<Route path="/agency">` behind `AgencyRoute`.

### Docs

- `docs/agency-os-implementation-handoff.md` — full planning + source review
  carried over from the previous (compacted) session.
- `docs/agency-os-data-wireup.md` — phased plan to swap each mock data
  source onto live Supabase / Cal.com / Netlify in follow-up PRs.
- `docs/agency-os-session-closeout-2026-05-08.md` (this file).

### Verification

- `npm run lint` — clean for all new files. Pre-existing warnings/errors in
  untouched code (the `theme.tsx` line is a non-blocking
  `react-refresh/only-export-components` hint, expected for files exporting
  both components and constants).
- `npm run build` — production build succeeds (5.29s).

## Visual fidelity & language

- Inline styles ported verbatim from the prototype. **No Tailwind / shadcn
  rewrite** — that was an explicit user lock at the start of the project.
- Spanish copy preserved as-is from the prototype.
- Bridge and Concierge theme variants were skipped per the handoff
  ("`app.jsx` hardcodes `theme = Themes.marina`").

## Role assignments (applied 2026-05-08)

The `agency_manager` enum value was added to remote Supabase via Lovable.
Role assignments performed during this session:

1. `c77c63c5-f678-4fd5-8555-ac3619b8cc70` (Dani) — original plan was to swap
   her `admin` row for `agency_manager`. **Reverted in the same session**:
   she's back on `admin`. Reason: she still needs admin access elsewhere
   (`/calendar`, `/team`, edge functions that gate on `role === 'admin'`).
2. `d4cc756e-a746-41bb-9a25-cd83f8f5294c` — set to `agency_manager`. This
   is the account that will use `/agency` going forward.

### Important constraint

`AuthContext.fetchUserRole` reads from `user_roles` with `.maybeSingle()`.
A user with **two** rows in `user_roles` will trigger a Supabase error on
sign-in. Each user must have **exactly one** role row. This is why the
swaps used `DELETE` + `INSERT` rather than just `INSERT`.

## What's still mock

Everything in `src/lib/agency-os/data.ts`. The four surfaces consume
exclusively from there. See `docs/agency-os-data-wireup.md` for the
phased path to live data:

- **Phase 1 — Yachts** (lowest effort): replace the `yachts` const with a
  Supabase query against the existing `yachts` table.
- **Phase 2 — Bookings + Calendar** (medium): add `agency_manager` to the
  role check on `internal-calendar-bookings`, add a `calendar_blocks`
  table for maintenance/owner blocks, build `useAgencyBookings()`.
- **Phase 3 — Leads + Inbox** (hardest, separate PR): Netlify Forms →
  Supabase webhook sync into a new `leads` table.
- **Phase 4 — Derived** (cleanup): alerts, revenue, utilization all
  derive client-side once 1–3 land.

## Open items

These need a decision before the next pass — no action this session.

1. **Tighten `AgencyRoute`.** Currently admits both `agency_manager` and
   `admin` so the project owner can self-test without a second account.
   When the data wire-up starts and `/agency` becomes a production tool,
   drop the admin escape hatch — `AgencyRoute.tsx:28`.
2. **Multi-role support in `AuthContext`.** The `.maybeSingle()` constraint
   makes per-user role assignment exclusive. If anyone ever needs both
   `admin` and `agency_manager` (Dani may, eventually), widen
   `fetchUserRole` to return all rows and pick the highest-privilege one,
   or extend the role checks in admin-gated routes/edge functions to
   accept `agency_manager` too.
3. **Lovable parity.** Lovable mirrors `main`. The migration was applied
   directly via Lovable's SQL editor rather than by Lovable picking up the
   migration file from the push. If Lovable pushes future schema changes
   from its side, expect drift between the migration file and the live
   schema — reconcile during the wire-up PRs.
4. ~~**Untracked working dirs.**~~ Resolved 2026-05-08: `Experience Shots/`
   (4 source PNGs for the experience cards — already imported into
   `src/assets/experiences/` for the build) and `Yacht Agency OS - Dani/`
   (Dani's standalone HTML/JSX prototype this surface was ported from)
   committed for posterity.

## Next session

QA the four surfaces against `d4cc756e-a746-41bb-9a25-cd83f8f5294c`'s
account. Report-back format: which surface, what's wrong, what was
expected. Anything visual/layout takes priority since the inline-style
port is the area most likely to have drifted from the prototype.
