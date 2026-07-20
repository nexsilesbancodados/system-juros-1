
ALTER TABLE public.settings 
  ADD COLUMN IF NOT EXISTS mercadopago_checkout_url text;

ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'hubla';
