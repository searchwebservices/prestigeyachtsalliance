## Changes to `src/components/yacht/PaymentLinksManager.tsx`

**1. Accept yacht hourly rate**
- Add prop `hourlyRate?: number | null` to `Props`.
- Update `YachtDetail.tsx` where `<PaymentLinksManager yachtId={...} />` is rendered to also pass `hourlyRate={yacht.hourly_rate}`.

**2. Auto-prefill amount from hours × hourly rate**
- When `hourlyRate` is set and the user changes `duration_hours` in the draft (or opens the form), compute `amount_usd = hours * hourlyRate` and populate the field.
- Treat the amount field as user-overridable: only auto-fill while the user hasn't manually edited it (track a `amountTouched` flag, reset when form is closed/reopened). If `hourlyRate` is null, leave field blank as today.
- Placeholder updates to show the computed suggestion when applicable.

**3. Collapsed add-link UX (admins only)**
- Replace the always-visible add form with a single "Add payment link" button.
- Clicking it reveals the form (duration, amount, label, stripe URL) plus a "Cancel" button alongside "Add link".
- Closing/canceling resets `draft` to defaults and `amountTouched=false`.
- On successful add, collapse the form again.

**4. Empty / populated states**
- If no links: show "No payment links yet" message + the "Add payment link" CTA (same button).
- If links exist: show the list, with the "Add payment link" CTA underneath.
- Non-admins see only the list (or an empty-state message without the CTA), unchanged from today.

No DB, RLS, or other surface changes. `Deposit.tsx` is unaffected.