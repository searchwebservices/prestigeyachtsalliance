
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  session_id text,
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  component_stack text,
  url text,
  route text,
  user_agent text,
  viewport text,
  referrer text,
  release text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_client_errors_created_at ON public.client_errors (created_at DESC);
CREATE INDEX idx_client_errors_user_created ON public.client_errors (user_id, created_at DESC);
CREATE INDEX idx_client_errors_source ON public.client_errors (source);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert their own error reports
CREATE POLICY "Anyone can insert client errors"
ON public.client_errors
FOR INSERT
TO anon, authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- Only admins can read
CREATE POLICY "Admins can view all client errors"
ON public.client_errors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete (for housekeeping)
CREATE POLICY "Admins can delete client errors"
ON public.client_errors
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
