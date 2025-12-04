-- Create table to store exchange rates
CREATE TABLE public.exchange_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency text NOT NULL DEFAULT 'USD',
  target_currency text NOT NULL DEFAULT 'MXN',
  rate numeric NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Everyone can read exchange rates
CREATE POLICY "Anyone can view exchange rates"
ON public.exchange_rates
FOR SELECT
USING (true);

-- Only service role can insert/update (via edge function)
CREATE POLICY "Service role can manage exchange rates"
ON public.exchange_rates
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for quick lookups
CREATE INDEX idx_exchange_rates_currencies ON public.exchange_rates (base_currency, target_currency);
CREATE INDEX idx_exchange_rates_fetched_at ON public.exchange_rates (fetched_at DESC);