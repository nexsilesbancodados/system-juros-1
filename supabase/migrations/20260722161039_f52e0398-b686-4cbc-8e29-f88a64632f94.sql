
-- Vincular contratos a empréstimos de investidor (alocação de capital)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS investor_loan_id uuid REFERENCES public.investor_loans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_investor_loan ON public.contracts(investor_loan_id);

-- KPI ativo x passivo (SECURITY DEFINER, escopo do usuário logado)
CREATE OR REPLACE FUNCTION public.get_ativo_passivo()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ativo_capital', COALESCE((
      SELECT SUM(c.capital)
      FROM public.contracts c
      WHERE c.user_id = auth.uid() AND c.status = 'active'
    ), 0),
    'ativo_a_receber', COALESCE((
      SELECT SUM(i.amount - COALESCE(i.paid_amount,0))
      FROM public.contract_installments i
      WHERE i.user_id = auth.uid() AND i.status <> 'paid'
    ), 0),
    'passivo_captado', COALESCE((
      SELECT SUM(l.principal)
      FROM public.investor_loans l
      WHERE l.user_id = auth.uid() AND l.status <> 'paid'
    ), 0),
    'passivo_a_pagar', COALESCE((
      SELECT SUM(l.total_due - COALESCE(l.paid_amount,0))
      FROM public.investor_loans l
      WHERE l.user_id = auth.uid() AND l.status <> 'paid'
    ), 0),
    'alocado_capital', COALESCE((
      SELECT SUM(c.capital)
      FROM public.contracts c
      WHERE c.user_id = auth.uid()
        AND c.status = 'active'
        AND c.investor_loan_id IS NOT NULL
    ), 0)
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_ativo_passivo() TO authenticated;
