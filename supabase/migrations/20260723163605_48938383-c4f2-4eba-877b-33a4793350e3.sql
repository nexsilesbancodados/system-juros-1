-- ============================================================================
-- Pagamento atômico + estorno que limpa lucro/caixa.
--
-- Antes, quitar uma parcela fazia 3-4 escritas separadas no frontend (parcela,
-- lucro, caixa, conclusão de contrato) sem transação — se uma falhasse no meio,
-- ficava inconsistente. E o estorno não removia o lucro/transação criados,
-- deixando os totais inflados.
--
-- Aqui centralizamos tudo em duas funções transacionais:
--  - pay_installment: aplica o pagamento (parcela + lucro + caixa + conclusão)
--    de forma atômica. Juros = fração real do total do contrato (correção A4);
--    caixa lança só o dinheiro novo desta chamada (correção A5).
--  - reverse_installment_payment: estorna e remove SOMENTE os lançamentos desta
--    parcela (vinculados por installment_id, escopados ao próprio usuário),
--    reabrindo o contrato se estava concluído.
--
-- SECURITY INVOKER: as funções rodam com as permissões do chamador, então o RLS
-- de dono (auth.uid() = user_id) já garante que ninguém toque em dados de outro.
-- Additivo: nenhuma coluna/linha existente é removida.
-- ============================================================================

-- Vínculo para permitir estorno preciso (nulo em lançamentos antigos).
ALTER TABLE public.profits      ADD COLUMN IF NOT EXISTS installment_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_id uuid;
CREATE INDEX IF NOT EXISTS idx_profits_installment_id      ON public.profits(installment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_installment_id ON public.transactions(installment_id);

-- ── pay_installment ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pay_installment(
  _installment_id uuid,
  _paid_total     numeric,
  _mark_paid      boolean DEFAULT true,
  _method         text    DEFAULT 'pix',
  _receipt_url    text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _inst      public.contract_installments%rowtype;
  _contract  public.contracts%rowtype;
  _prev_paid numeric;
  _new_money numeric;
  _interest  numeric := 0;
  _remaining int;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  _prev_paid := COALESCE(_inst.paid_amount, 0);
  _new_money := round((_paid_total - _prev_paid)::numeric, 2);

  UPDATE public.contract_installments
     SET paid_amount    = _paid_total,
         payment_method = _method,
         receipt_url    = COALESCE(_receipt_url, receipt_url),
         status         = CASE WHEN _mark_paid THEN 'paid' ELSE status END,
         paid_at        = CASE WHEN _mark_paid THEN now()  ELSE paid_at END
   WHERE id = _installment_id;

  -- Lucro (juros do contrato) — só na quitação, uma vez.
  IF _mark_paid THEN
    SELECT * INTO _contract FROM public.contracts WHERE id = _inst.contract_id;
    IF _contract.id IS NOT NULL AND COALESCE(_contract.total_amount, 0) > 0 THEN
      _interest := round((_inst.amount * (_contract.total_interest / _contract.total_amount))::numeric, 2);
    END IF;
    IF _interest > 0 THEN
      INSERT INTO public.profits (user_id, amount, description, client_id, installment_id)
      VALUES (auth.uid(), _interest,
              'Juros parcela #' || _inst.installment_number, _inst.client_id, _installment_id);
    END IF;
  END IF;

  -- Caixa — só o dinheiro novo desta chamada.
  IF _new_money > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description, client_id, contract_id, installment_id)
    VALUES (auth.uid(), _new_money, 'payment',
            'Pagamento parcela #' || _inst.installment_number, _inst.client_id, _inst.contract_id, _installment_id);
  END IF;

  -- Conclui o contrato se não há mais parcelas em aberto.
  IF _mark_paid THEN
    SELECT count(*) INTO _remaining FROM public.contract_installments
      WHERE contract_id = _inst.contract_id AND status <> 'paid';
    IF _remaining = 0 THEN
      UPDATE public.contracts SET status = 'completed' WHERE id = _inst.contract_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'new_money', _new_money, 'interest', _interest);
END;
$$;

-- ── reverse_installment_payment ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reverse_installment_payment(_installment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  _inst public.contract_installments%rowtype;
BEGIN
  SELECT * INTO _inst FROM public.contract_installments WHERE id = _installment_id;
  IF _inst.id IS NULL THEN RAISE EXCEPTION 'installment_not_found'; END IF;
  IF _inst.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Remove SOMENTE os lançamentos desta parcela (escopados ao dono). Lançamentos
  -- antigos (installment_id NULL) não são tocados — só o que este fluxo criou.
  DELETE FROM public.profits      WHERE installment_id = _installment_id AND user_id = auth.uid();
  DELETE FROM public.transactions WHERE installment_id = _installment_id AND user_id = auth.uid();

  UPDATE public.contract_installments
     SET status = 'pending', paid_at = NULL, paid_amount = NULL
   WHERE id = _installment_id;

  -- Reabre o contrato se havia sido concluído.
  UPDATE public.contracts SET status = 'active'
   WHERE id = _inst.contract_id AND status = 'completed';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_installment(uuid, numeric, boolean, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.pay_installment(uuid, numeric, boolean, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_installment_payment(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.reverse_installment_payment(uuid) TO authenticated;
