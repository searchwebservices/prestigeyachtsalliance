-- Stripe key setup submissions — admin-only, stored securely in portal DB
CREATE TABLE IF NOT EXISTS public.stripe_setup_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  key_type text NOT NULL CHECK (key_type IN ('live', 'test', 'restricted')),
  secret_key text NOT NULL,
  publishable_key text,
  notes text,
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_setup_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stripe submissions"
  ON public.stripe_setup_submissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
