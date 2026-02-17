

# Enforce 2-Hour Buffer Between Trips + Fix Build Error

## Problem

Two issues need fixing:

1. **Build error** in `internal-booking-create`: Variables `attendeePhoneRaw` and `attendeePhone` are referenced in the `catch` block but defined inside the `try` block (out of scope).

2. **Missing 2-hour inter-trip buffer**: When a day has a booking (e.g., 10am-6pm), the system still shows 3h and 4h options because Cal.com's slots API doesn't enforce our buffer policy. A new trip must have at least 2 hours of gap before or after any existing booking on the same day.

### Example
- Existing booking: 10:00 - 18:00
- Available window: 06:00 - 10:00 (4 hours)
- With 2h buffer required before the existing trip: new booking must END by 08:00 (10:00 - 2h)
- That leaves only 06:00 - 08:00 = 2 hours, which is below the 3h minimum
- Result: **No bookings should be available** on this day

## Plan

### Fix 1: Build Error (internal-booking-create)

**File**: `supabase/functions/internal-booking-create/index.ts`

Move the phone diagnostic logging to use values captured at the top of the catch block, or declare the variables before the try block. The simplest fix: remove the phone diagnostic fields from the catch block since they're out of scope (the error message from Cal already contains the relevant info).

### Fix 2: 2-Hour Buffer Enforcement

**File**: `supabase/functions/_shared/booking.ts`

**Approach**: After computing booking intervals from Cal.com data, apply a 2-hour buffer zone around each booking. Filter out any provider-returned start times that would place a new trip within 2 hours of an existing one.

**Constant**: Add `INTER_BOOKING_BUFFER_HOURS = 2` to the shared booking module.

**Logic change in `buildAvailabilityForMonth`**:

1. Collect raw booking intervals (startHour, endHour) per day (not just blocked hours -- we already compute these but discard the interval structure)
2. When filtering provider starts for each duration, add a buffer check: for candidate start S with duration D, the new booking occupies [S, S+D). For every existing booking [B_start, B_end) on that day, require:
   - `S + D <= B_start - 2` (new trip ends at least 2h before existing starts), OR
   - `S >= B_end + 2` (new trip starts at least 2h after existing ends)
3. If neither condition is met for any existing booking, reject that start time

**Also update the client-side policy** in `src/lib/bookingPolicy.ts`:

- Add `INTER_BOOKING_BUFFER_HOURS = 2` constant for documentation/frontend use

### Technical Details

```text
Existing booking: [10, 18)
Buffer = 2 hours

Forbidden zone for new booking start S with duration D:
  NOT (S + D <= 10 - 2)  AND  NOT (S >= 18 + 2)
  = S + D > 8  AND  S < 20

For D=3: S + 3 > 8 -> S > 5, and S < 20
  So S in [6, 19] is forbidden. ALL starts blocked.

For D=4: S + 4 > 8 -> S > 4, and S < 20  
  So S in [5, 19] is forbidden. ALL starts blocked.

Result: No options available -- correct!
```

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/booking.ts` | Add `INTER_BOOKING_BUFFER_HOURS = 2`, collect booking intervals per day, filter provider starts by buffer rule |
| `supabase/functions/internal-booking-create/index.ts` | Remove out-of-scope phone variables from catch block |
| `src/lib/bookingPolicy.ts` | Add `INTER_BOOKING_BUFFER_HOURS = 2` constant |

### Validation

After deploying:
- A day with a 10am-6pm booking should show **zero** available options
- A day with a 6am-9am booking should only allow starts at 11:00+ (9+2=11)
- A day with a 6am-8am booking should allow starts at 10:00+ (8+2=10), so 3h at 10:00 or 15:00, 4h at 10:00-13:00 would be blocked by morning rule but others valid, etc.

