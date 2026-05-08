# Agency OS — Data Wire-Up Plan

`/agency` ships in this PR with **mock data only**. This doc lays out the order
of operations to swap each surface onto live Supabase / Cal.com / Netlify data.

The mock layer lives in `src/lib/agency-os/data.ts`. Everything below replaces
specific exports from that file, one at a time, behind hooks. The `Scenario` /
`Density` knobs and the `TODAY = 2026-05-07` anchor stay until every section is
wired (they keep the surfaces internally consistent during the transition).

For deeper context (mapping tables per field, schema sketches, prototype source
references), see `docs/agency-os-implementation-handoff.md` § "Data wire-up
plan" — that doc is the long-form companion to this one.

---

## Phase 0 · Provision an `agency_manager` user (immediate)

Migration `20260508050425_agency_manager_role.sql` extended `app_role` with
`agency_manager`. To grant the role to Dani's account:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<dani-user-uuid>', 'agency_manager');
```

`AgencyRoute` admits both `agency_manager` and `admin` so the project owner can
self-test without a second account. Tighten to `agency_manager` only once the
role is in use.

---

## Phase 1 · Yachts (lowest effort)

The `yachts` constant in `data.ts` is the closest mock to existing data —
swap it first to validate the hook pattern.

1. Add a `useAgencyYachts()` hook in `src/lib/agency-os/queries.ts` that runs
   a Supabase select against `yachts` and reshapes rows to the prototype's
   `Yacht` interface.
2. Most prototype fields map 1:1 to existing columns (`name`, `length`,
   `capacity`, `hourlyRate`, `year`, `booking_public_enabled` → `bookable`).
   Fields without DB equivalents (`klass`, `hue`, `tagline`, `base`, `captain`)
   need either a new column, a derivation, or a temporary fallback. Pick per
   field — `hue` can hash from slug; `klass` could derive from
   `commission_amount IS NOT NULL`; `tagline` likely needs a column.
3. Replace `import { yachts, yById } from '@/lib/agency-os/data'` in the four
   surfaces with the hook return. Keep `data.ts`'s `yachts` export as a
   fallback for tests / Storybook only.

Acceptance: `/agency` Portfolio surface shows the same yachts as the public
fleet — no mock-only entries.

---

## Phase 2 · Bookings + Calendar (medium)

`internal-calendar-bookings` already returns Cal.com bookings for admins.

1. Add `agency_manager` to the role check inside
   `internal-calendar-bookings` (and the reschedule / cancel siblings if Dani
   should be able to mutate). Mirror the same shared-helper pattern used
   elsewhere in `supabase/functions/`.
2. Add a `calendar_blocks` table for maintenance + owner-use rows (the
   prototype's `'block'` and `'hold'` types). Cal-only solutions don't fit
   because we need internal-only metadata. Suggested schema:
   ```sql
   CREATE TABLE calendar_blocks (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     yacht_id uuid REFERENCES yachts(id) NOT NULL,
     kind text NOT NULL CHECK (kind IN ('mantenimiento','propietario','privado')),
     starts_at timestamptz NOT NULL,
     ends_at timestamptz NOT NULL,
     note text,
     created_by uuid REFERENCES auth.users(id),
     created_at timestamptz NOT NULL DEFAULT now()
   );
   ```
3. Add `useAgencyBookings(dateRange)` that fans out: Cal bookings →
   `type: 'reservation'`, `calendar_blocks` → `type: 'block' | 'hold'`. Merge
   into the `Booking[]` shape the surfaces already consume.
4. Derive the `conflict` flag client-side using the 2h buffer rule from
   `src/lib/bookingPolicy.ts`. Keep the rule on the frontend only — the
   backend already enforces server-side, no need to duplicate.

Acceptance: Calendar surface shows real Cal bookings for May; the BlockDialog
in Calendar / Inbox conversion writes to `calendar_blocks`.

---

## Phase 3 · Leads + Inbox (hardest, separate PR)

Leads currently land in **Netlify Forms** (`/reserve/book`, `/reserve/inquire`).
Frontend cannot query Netlify Forms directly — it needs the Netlify API with a
PAT, which can't ship in client code.

Recommended path: **Netlify → Supabase webhook sync**.

1. Add a `leads` table that unifies the three submission shapes
   (`reservation`, `reservation_lead`, `inquiry`). Schema sketch lives in the
   handoff doc; key columns are `netlify_submission_id` (unique),
   `netlify_form_name`, `received_at`, plus the prototype's user-visible
   fields (`source`, `experience`, `guest_name`, `party`, `requested_date`,
   `priority`, `status`, etc.) and `raw_payload jsonb` for anything we forgot.
2. Add edge function `netlify-forms-webhook` (no JWT — validate via shared
   secret in the request body or a header per Netlify's docs).
3. Configure the webhook in the Netlify dashboard for each form (this is a
   per-form setting, like the email recipients — not in code).
4. Add `useAgencyLeads(filter)` against the `leads` table. Replace `leadsFor`
   in Inbox + Dashboard.
5. Backfill historical submissions either from a one-off Netlify API export
   or — cheaper — declare the cutover date and let the table fill forward.

Alternatives if the webhook path stalls: per-request proxy edge function
(simpler, but no place to persist status/priority and rate limits will bite),
or a no-integration parking lot where Inbox stays decorative until Phase 3
ships. Both are documented in the handoff doc.

Acceptance: a fresh `/reserve/book` submission appears in `/agency` Inbox
within 30s; status/priority changes survive a reload.

---

## Phase 4 · Derived sections (cleanup)

These get easier the moment Phase 1–3 land:

- **Alerts** — replace `alertsFor()` with a `useMemo` in `Dashboard.tsx` that
  walks bookings/leads, checks overlap + buffer violations + lead-age
  thresholds, and emits the same `Alert` shape. No backend changes.
- **Revenue (`revenue`)** — sum live bookings filtered to MTD; compare to
  prior month for the `pace` field. Pure aggregation hook.
- **Utilization (`utilization(yachtId)`)** — for each of last 30 days,
  `bookings_on_day_for_yacht / max_slots_per_day`. Cache via React Query.
  Don't bother memoizing in hand-written code — the surfaces re-render rarely.

Once all four derived hooks exist, `data.ts` collapses to type definitions
plus the `EXPERIENCES` lookup and the `fmt` helpers (which are presentation,
not data).

---

## Decommission checklist

When all four phases land:

- Delete `yachts`, `leadsFor`, `bookingsFor`, `alertsFor`, `revenue`,
  `utilization`, `todayBookings` from `src/lib/agency-os/data.ts`. Keep
  types, `EXPERIENCES`, `TODAY` (rename to `TODAY_FALLBACK`), `fmt`,
  `TZ_LABEL`.
- Delete the `Scenario` / `Density` plumbing if not used by tweaks UI.
- Tighten `AgencyRoute` to `agency_manager` only (drop the admin escape hatch).
- Remove the mock-fallback handling inside each surface.
