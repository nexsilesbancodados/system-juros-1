
-- Limpar duplicatas e dados antigos do cliente de teste
DELETE FROM contract_installments WHERE client_id IN ('70d355ab-5111-4a58-97b4-0ad6e5f395dd','1fb59303-55d8-4bdb-8078-095b0d4e0598','521f2fee-fea2-400b-acbe-421e12aae152');
DELETE FROM contracts WHERE client_id IN ('70d355ab-5111-4a58-97b4-0ad6e5f395dd','1fb59303-55d8-4bdb-8078-095b0d4e0598','521f2fee-fea2-400b-acbe-421e12aae152');
DELETE FROM clients WHERE id IN ('70d355ab-5111-4a58-97b4-0ad6e5f395dd','1fb59303-55d8-4bdb-8078-095b0d4e0598','521f2fee-fea2-400b-acbe-421e12aae152');

-- Limpar contrato antigo do cliente que vamos manter
DELETE FROM contract_installments WHERE client_id = '16881780-6f72-48fa-959f-68b653319ca9';
DELETE FROM contracts WHERE client_id = '16881780-6f72-48fa-959f-68b653319ca9';

-- Atualizar dados do cliente
UPDATE clients SET 
  email = 'carlos.teste@portal.com',
  phone = '(11) 98765-4321',
  whatsapp = '11987654321',
  status = 'Ativo'
WHERE id = '16881780-6f72-48fa-959f-68b653319ca9';

-- Criar contrato ativo
INSERT INTO contracts (
  id, user_id, client_id, capital, interest_rate, num_installments,
  installment_amount, frequency, start_date, total_amount, total_interest,
  status, payment_method, daily_interest_percent, late_fee_percent
) VALUES (
  'aaaa1111-2222-3333-4444-555566667777',
  '1534006f-9ad0-4532-985d-ea93f10af710',
  '16881780-6f72-48fa-959f-68b653319ca9',
  5000, 10, 5, 1100, 'monthly', now() - interval '35 days',
  5500, 500, 'active', 'pix', 0.33, 2
);

-- Criar parcelas (1 vencida, 1 vence hoje, 3 futuras)
INSERT INTO contract_installments (user_id, contract_id, client_id, installment_number, amount, due_date, status) VALUES
('1534006f-9ad0-4532-985d-ea93f10af710','aaaa1111-2222-3333-4444-555566667777','16881780-6f72-48fa-959f-68b653319ca9',1,1100, now() - interval '5 days','pending'),
('1534006f-9ad0-4532-985d-ea93f10af710','aaaa1111-2222-3333-4444-555566667777','16881780-6f72-48fa-959f-68b653319ca9',2,1100, now(),'pending'),
('1534006f-9ad0-4532-985d-ea93f10af710','aaaa1111-2222-3333-4444-555566667777','16881780-6f72-48fa-959f-68b653319ca9',3,1100, now() + interval '30 days','pending'),
('1534006f-9ad0-4532-985d-ea93f10af710','aaaa1111-2222-3333-4444-555566667777','16881780-6f72-48fa-959f-68b653319ca9',4,1100, now() + interval '60 days','pending'),
('1534006f-9ad0-4532-985d-ea93f10af710','aaaa1111-2222-3333-4444-555566667777','16881780-6f72-48fa-959f-68b653319ca9',5,1100, now() + interval '90 days','pending');
