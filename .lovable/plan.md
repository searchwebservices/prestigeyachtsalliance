
# Internal Booking Create 502 -- Root-Cause Investigation Report

---

## A) Timeline of the 6 Most Recent Failures

All failures share the **identical** Cal.com rejection:

```
calStatus: 400
error: "responses - {attendeePhoneNumber}invalid_number, "
reason: cal_error
status_code: 502
```

| # | Request ID | Timestamp (UTC) | Logged Status | Logged Reason |
|---|------------|-----------------|---------------|---------------|
| 1 | `e6886cce-...` | 2026-02-16 21:28:54 | 502 | `cal_error` |
| 2 | `8fb07185-...` | 2026-02-16 21:29:09 | 502 | `cal_error` |
| 3 | `56f56203-...` | 2026-02-16 22:00:38 | 502 | `cal_error` |
| 4 | `664f83ef-...` | 2026-02-17 00:14:36 | 502 | `cal_error` |
| 5 | `5d7c91c9-...` | 2026-02-17 00:14:43 | 502 | `cal_error` |
| 6 | `8af1e632-...` | 2026-02-17 00:14:51 | 502 | `cal_error` |

There is **no** variation between attempts -- all six are the same error class. The last successful booking was on 2026-02-14 (request `b4612362`), which did not include a phone number problem.

---

## B) Root-Cause Hypothesis Matrix

| Hypothesis | Evidence Supporting | Evidence Contradicting | Confidence |
|---|---|---|---|
| **1. Cal.com event type now requires/validates `attendeePhoneNumber`, and either (a) the phone value sent is rejected by Cal's validator, or (b) no phone is sent and Cal treats the missing field as invalid** | All 6 failures have identical Cal 400 with `{attendeePhoneNumber}invalid_number`. Successful bookings on Feb 13-14 did not trigger this. The Cal event type config may have changed between Feb 14 and Feb 16. | None. | **High** |
| **2. Error classification bug: Cal 400 mapped to HTTP 502 instead of 400** | Logs show `calStatus: 400` but `reason: cal_error` and `status_code: 502`. Current source code (lines 424-427) should classify 400 as `isCalClientError=true` and return 400, not 502. This means the **deployed** version has different classification logic than the current repo code. | The current repo code looks correct, suggesting a recent code change that has NOT been redeployed. | **High** |
| **3. Phone normalization passes but Cal rejects the format** | `normalizePhoneNumber` allows `+` followed by 8-15 digits. Cal.com may use a stricter libphonenumber-based validator that rejects certain valid-looking numbers. | If phone is empty/missing, the code skips the `phoneNumber` field entirely (line 344). | **Medium** |
| **4. Cal event type now has phone as a required booking question, and omitting it triggers the error** | The error pattern `responses - {attendeePhoneNumber}invalid_number` suggests Cal treats it as a booking question response field, not just the attendee phone. If the event type added a required phone question, any booking without a valid phone would fail. | Would need Cal dashboard confirmation. | **Medium** |

---

## C) Most Likely Root Cause (Two Issues)

### Issue 1: Cal.com Phone Validation Rejection (Primary)

Cal.com is rejecting the booking because of the `attendeePhoneNumber` field. This is happening on **every** attempt, which means either:

- **The Cal event type was updated** (between Feb 14 and Feb 16) to require a phone number as a booking question/response field, and the phone value being sent does not satisfy Cal's validation -- or no phone is being sent at all and Cal requires it.
- The frontend sends `phoneNumber: draft.attendeePhone.trim() || undefined` (Book.tsx line 764). If the user leaves phone blank, `undefined` is sent, the edge function's `normalizePhoneNumber` returns `null`, and `attendeePhone` on line 344 is falsy -- so the `phoneNumber` key is **omitted** from the Cal payload entirely. If Cal now requires this field, the omission causes the 400.

### Issue 2: Misclassified Error Response (Secondary)

The **deployed** edge function version maps this Cal 400 error to HTTP 502 (upstream provider error) rather than HTTP 400 (client validation error). The current repo code has the correct classification logic (`isCalClientError` check on line 424), but it was apparently **not deployed** after the fix was written. This is why the user sees "502 Bad Gateway" instead of a meaningful validation error.

---

## D) Proposed Remediation Plan

### Immediate Mitigation
1. **Redeploy `internal-booking-create`** so the corrected error classification logic (already in the repo) goes live. This changes the 502 to a 400 with the actual Cal error message, giving the user actionable feedback.

### Definitive Fix (two parts)

**Part A -- Handle phone field for Cal compatibility:**
- When `attendeePhone` is null/empty but the Cal event type requires it, either:
  - Send a placeholder or skip the field gracefully
  - OR detect the Cal booking question schema and surface a frontend validation requiring phone before submission
- Recommended: Make the edge function **never** send `phoneNumber` in the attendee object if it's empty, AND handle the Cal 400 about phone numbers as a user-facing validation error (return 400 with a clear message like "A valid phone number is required for this yacht").

**Part B -- Fix error classification in deployed code:**
- Ensure the deployed version matches the repo. The current code correctly classifies Cal 400s as client errors (line 424-452), returning HTTP 400 to the frontend instead of 502.
- Add a specific detection for the phone validation error pattern to return a user-friendly message.

### Validation Plan
1. After redeploying, submit a booking **without** a phone number -- expect a 400 with a clear message instead of 502.
2. Submit a booking **with** a valid international phone number -- expect 200 success.
3. Submit with an invalid phone format -- expect either client-side validation or a clear 400.
4. Check `booking_request_logs` to confirm `reason: cal_client_error` (not `cal_error`) and `status_code: 400` (not 502).

### Rollback / Guardrail Plan
- If the fix causes regressions, the phone field can be stripped entirely from the Cal payload as a safe fallback (the `phoneNumber` spread on line 344 can be temporarily removed).
- No database migration is involved, so rollback is a simple function redeploy.

---

## E) Missing Data (to reach >90% confidence)

1. **Cal.com event type configuration** for event type ID `4718180` -- specifically whether `attendeePhoneNumber` was recently added as a required booking question/response. This would confirm whether the issue is a missing required field vs. an invalid format.
2. **The actual phone value** sent in the failing requests -- the `booking_request_logs` details don't capture the raw input payload. Adding the phone value to the log `details` on the 400 path would clarify whether a phone was sent (and rejected) or omitted (and required).
3. **Deployed function hash/timestamp** -- confirming whether the current repo code is actually deployed or if there's a stale version running. A redeploy would resolve this ambiguity.
