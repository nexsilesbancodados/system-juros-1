ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS loan_mode text NOT NULL DEFAULT 'installments',
  ADD COLUMN IF NOT EXISTS grace_periods integer NOT NULL DEFAULT 0;