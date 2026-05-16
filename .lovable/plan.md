## Goal

Replace the single hardcoded Stripe deposit link on `/deposit` with a flexible system:
- **One standard deposit link** (the existing $500 link) used as the global default.
- **Per-yacht payment links**, where each yacht can define any number of links keyed to a specific duration (in hours).
- Admins manage all of this from the yacht admin UI; on `/deposit` the user picks yacht + hours and gets the matching link (falling back to the standard $500 deposit when no match exists).

## Data model

New table `public.yacht_payment_links`:
- `id uuid pk`
- `yacht_id uuid not null` (references `yachts.id`)
- `duration_hours int not null` (3–8, but not constrained — free-form so future durations work)
- `label text` (optional, e.g. "4h charter — full payment")
- `amount_usd numeric` (optional, display-only)
- `stripe_url text not null`
- `sort_order int default 0`
- `created_at`, `updated_at`
- Unique `(yacht_id, duration_hours)` so each yacht has at most one link per duration.
- RLS: admins manage; staff + authenticated can read. (No anon — `/deposit` is auth-gated.)

New `app_settings` row (or a tiny `app_settings` key/value table if none exists) holding the **standard deposit link** so admins can rotate it without a code deploy. Key: `standard_deposit_stripe_url`, default seeded to the current `https://buy.stripe.com/7sY3cu0AL1eZ70Lg9Df3a01`.

## Admin UI

In the existing yacht detail/edit surface (`src/components/yacht/YachtDetail.tsx` + a new `PaymentLinksManager.tsx`):
- New section "Payment links" listing rows: duration | label | amount | URL | actions (edit / delete).
- "Add link" form: duration (number, 1–24), label, amount, Stripe URL.
- Inline edit + delete with confirm.

A small admin-only "Standard deposit link" editor (likely on the existing Team/Settings admin page, or a new `/admin/payments` route — easiest is a card on `TeamManagement` since it's already admin-gated).

## `/deposit` page rewrite

`src/pages/Deposit.tsx` becomes a selector:
1. Yacht dropdown (lists all yachts the user can see).
2. Duration dropdown (shows the durations that yacht has links for, plus a "Standard $500 deposit" option always present).
3. Summary card shows the chosen link's label + amount + a "Pay now" button that opens the matching `stripe_url`.
4. If no yacht/duration is selected, default to the standard $500 deposit link (preserves today's behavior for muscle memory).

## Files touched

- `supabase/migrations/<ts>_yacht_payment_links.sql` — new table, RLS, optional `app_settings` row.
- `src/integrations/supabase/types.ts` — regenerated automatically.
- `src/components/yacht/PaymentLinksManager.tsx` (new) — CRUD UI.
- `src/components/yacht/YachtDetail.tsx` — mount the manager.
- `src/pages/Deposit.tsx` — selector + fallback flow.
- `src/pages/TeamManagement.tsx` (or new admin card) — edit the standard deposit URL.

## Open questions before I build

1. **Standard deposit link location** — keep it editable in the app (recommended, via `app_settings`), or hardcode it like today?
2. **Where should the standard deposit link editor live?** A card on the Team page, or a new `/admin/settings` route?
3. **On `/deposit`, when a user picks a yacht + duration that has no matching link**, do you want me to (a) silently fall back to the $500 standard link, or (b) show "No link configured — contact admin"?
4. **Amount field** — should it be required (so the user always sees the price before paying) or optional?
