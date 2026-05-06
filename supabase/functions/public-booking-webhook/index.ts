// Cal.com integration temporarily disabled — internal-only mode.
// This webhook used to receive Cal.com events; it now no-ops.

import { getCorsHeaders, json } from '../_shared/booking.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return json(req, 200, { disabled: true, reason: 'Cal.com integration temporarily disabled' });
});
