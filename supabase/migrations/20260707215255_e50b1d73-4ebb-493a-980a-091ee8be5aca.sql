
INSERT INTO public.client_notifications
  (client_id, user_id, contract_id, installment_id, type, title, message, metadata)
SELECT
  ci.client_id,
  c.user_id,
  ci.contract_id,
  ci.id,
  'installment_overdue',
  'Parcela ' || ci.installment_number || ' em atraso',
  'Sua parcela ' || ci.installment_number
    || ' de ' || to_char(ci.amount, 'FM"R$" 999G990D00')
    || ' venceu em ' || to_char(ci.due_date, 'DD/MM/YYYY')
    || '. Regularize para evitar aumento de juros.',
  jsonb_build_object(
    'installment_number', ci.installment_number,
    'amount', ci.amount,
    'due_date', ci.due_date,
    'days_overdue', GREATEST(0, (CURRENT_DATE - ci.due_date::date)),
    'late_fee', COALESCE(ci.late_fee, 0),
    'total_due', ci.amount + COALESCE(ci.late_fee, 0),
    'backfill', true
  )
FROM public.contract_installments ci
JOIN public.contracts c ON c.id = ci.contract_id
WHERE ci.status NOT IN ('paid','cancelled')
  AND ci.due_date < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.client_notifications n
    WHERE n.installment_id = ci.id AND n.type = 'installment_overdue'
  )
ON CONFLICT DO NOTHING;
