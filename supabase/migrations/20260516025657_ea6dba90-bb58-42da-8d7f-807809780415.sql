-- App settings key/value table for admin-editable globals
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value)
VALUES ('standard_deposit_stripe_url', 'https://buy.stripe.com/7sY3cu0AL1eZ70Lg9Df3a01')
ON CONFLICT (key) DO NOTHING;

-- Per-yacht, per-duration payment links
CREATE TABLE public.yacht_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES public.yachts(id) ON DELETE CASCADE,
  duration_hours integer NOT NULL CHECK (duration_hours > 0 AND duration_hours <= 24),
  label text,
  amount_usd numeric,
  stripe_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (yacht_id, duration_hours)
);

CREATE INDEX idx_yacht_payment_links_yacht ON public.yacht_payment_links(yacht_id);

ALTER TABLE public.yacht_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payment links"
  ON public.yacht_payment_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage payment links"
  ON public.yacht_payment_links FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_yacht_payment_links_updated_at
  BEFORE UPDATE ON public.yacht_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();