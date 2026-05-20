# Melhorias nas funções de empréstimo

Você pediu para mexer nas 4 áreas. Como é bastante coisa, vou entregar em **4 fases sequenciais**, cada uma testável sozinha. Você pode aprovar este plano inteiro e eu sigo fase por fase, mostrando o resultado antes de seguir para a próxima.

Regras já definidas por você:
- Dias úteis: **mantém o comportamento atual** (não mexer).
- Quitação antecipada: **sem desconto** (cobra o valor cheio das parcelas restantes).

---

## Fase 1 — Núcleo de cálculo unificado (`src/lib/loanMath.ts`)

Hoje a fórmula está duplicada em `Simulador.tsx` e `NovoCliente.tsx`, com pequenas divergências. Vou:

- Criar `src/lib/loanMath.ts` com funções puras:
  - `calculateLoan({ capital, rate, periods, frequency, loanMode, valueMode, installmentValue })` → retorna `{ installmentAmount, totalAmount, totalInterest, numInstallments, derivedRate? }`.
  - `deriveRateFromInstallment({ capital, installment, periods })`.
  - `generateInstallmentSchedule({ startDate, periods, frequency })` (mantendo a lógica de datas atual).
- Substituir os cálculos inline em `Simulador.tsx` e `NovoCliente.tsx` por chamadas a esse módulo.
- Adicionar testes em `src/test/loanMath.test.ts` cobrindo: juros simples mensal, diário, semanal, modo porcentagem, modo parcelas, e derivação de taxa.

**Resultado:** mesma lógica visível ao usuário, mas centralizada, testada e sem divergências.

## Fase 2 — Simulador (UX + IA)

- Presets rápidos de capital (R$ 500 / 1k / 5k / 10k) e de parcelas (3, 6, 12).
- Validações inline com mensagens claras (taxa > 100%/período, capital negativo, parcela menor que capital÷n).
- Painel "Comparar cenários": mostra lado a lado os 3 cenários da IA (`simulator-ai`) com diferença em R$ vs o atual.
- Botão "Aplicar cenário" que preenche os campos do simulador.
- Tratamento explícito dos códigos 429/402 do gateway (toast amigável já existe parcialmente).

## Fase 3 — Criação/edição de contrato (`NovoCliente.tsx`)

- Schema Zod único para o passo de empréstimo (capital, taxa, parcelas, datas, garantia).
- Preview da tabela de parcelas (datas + valor) **antes** de salvar, com possibilidade de:
  - Ajustar a data da 1ª parcela (já existe parcial).
  - Editar manualmente o valor de uma parcela específica (ex: parcela balão).
- Resumo final do contrato com CET aproximado (juros totais ÷ capital).
- Bloquear submit enquanto houver erro de validação (hoje alguns erros só viram toast).

## Fase 4 — Quitação antecipada e renegociação

Em `src/pages/ClienteDetalhe.tsx` (ou onde estiver a gestão de parcelas):

- Botão **"Quitar contrato"** que:
  - Lista todas as parcelas `pending`.
  - Soma o valor cheio (sem desconto, conforme sua escolha).
  - Marca todas como `paid` na mesma transação, registra `paid_at = now()` e cria 1 `transaction` consolidada + `profit`.
- Botão **"Pagamento parcial"** numa parcela: aceita valor menor, registra `paid_amount`, mantém status `pending` até completar.
- Botão **"Renegociar saldo"**: cria um novo contrato a partir do saldo devedor restante (capital = soma das parcelas pendentes), encerra o contrato antigo como `renegotiated`, mantém histórico.
- Tudo registrado em `audit_logs`.

---

## Detalhes técnicos

- Sem mudanças de schema necessárias nas 3 primeiras fases. A Fase 4 adiciona:
  - Coluna `paid_amount` em `contract_installments` já existe ✓.
  - Novo status `renegotiated` em `contracts.status` (string livre, sem enum — não precisa de migration).
  - Opcional: coluna `renegotiated_from` (uuid) em `contracts` para linkar contrato original → renegociado. Confirmo com você antes de aplicar a migration.
- Sem mudanças visuais profundas — mantém tema dark/glassmorphism.
- Testes com Vitest na Fase 1 (já configurado no projeto).

---

**Confirma o plano?** Se sim, começo pela **Fase 1** (núcleo de cálculo + testes), te mostro funcionando e seguimos.
