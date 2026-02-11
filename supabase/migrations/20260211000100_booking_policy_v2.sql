-- Booking policy v2 rollout configuration on yachts
ALTER TABLE public.yachts
  ADD COLUMN IF NOT EXISTS cal_event_type_id INTEGER,
  ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'legacy_embed',
  ADD COLUMN IF NOT EXISTS booking_public_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_v2_live_from DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'yachts_booking_mode_check'
  ) THEN
    ALTER TABLE public.yachts
      ADD CONSTRAINT yachts_booking_mode_check
      CHECK (booking_mode IN ('legacy_embed', 'policy_v2'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_yachts_booking_mode
  ON public.yachts (booking_mode);

CREATE INDEX IF NOT EXISTS idx_yachts_public_slug
  ON public.yachts (slug)
  WHERE booking_public_enabled;

-- Request-level rate limiting for public booking endpoint.
CREATE TABLE IF NOT EXISTS public.booking_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  request_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_booking_rate_limits_ip_created_at
  ON public.booking_rate_limits (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_rate_limits_email_created_at
  ON public.booking_rate_limits (email_hash, created_at DESC);

-- Lightweight request logging for observability and troubleshooting.
CREATE TABLE IF NOT EXISTS public.booking_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  request_id TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_request_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_booking_request_logs_endpoint_created_at
  ON public.booking_request_logs (endpoint, created_at DESC);

-- Persist webhook deliveries from Cal.com for audit/reconciliation.
CREATE TABLE IF NOT EXISTS public.booking_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  booking_uid TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_booking_webhook_events_received_at
  ON public.booking_webhook_events (received_at DESC);

