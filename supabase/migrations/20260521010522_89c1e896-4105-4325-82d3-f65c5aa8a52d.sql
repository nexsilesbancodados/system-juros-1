ALTER TABLE public.contract_installments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS receipt_url text;