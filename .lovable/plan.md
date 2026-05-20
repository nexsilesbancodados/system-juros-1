# Novos tipos de empréstimo

Adicionar 4 novos modos além dos atuais "Por Parcelas" e "Por Porcentagem", no Simulador **e** no Novo Cliente.

## Tipos novos

| Tipo | Como funciona | Parcelas geradas |
|---|---|---|
| **Só juros + capital no final** (`interest_only`) | Cliente paga só os juros todo período. No último, paga juros + capital. | N-1 parcelas de juros + 1 final maior |
| **Juros compostos / Tabela Price** (`price`) | PMT fixo com amortização real: `PMT = PV·i / (1−(1+i)^−n)` | N parcelas iguais (compostas) |
| **Pagamento único no vencimento** (`bullet`) | Capital + juros simples × períodos, num único pagamento na data final. | 1 parcela só |
| **Empréstimo com carência** (`grace`) | X períodos iniciais sem pagar nada (juros acumulam — juros simples). Depois entra em parcelas normais. | X parcelas de R$ 0,00 + N parcelas iguais do saldo capitalizado |

## Mudanças

### 1. Núcleo (`src/lib/loanMath.ts`)
- Estender `LoanMode` com os 4 novos valores.
- `calculateLoan` retorna agora também `schedule: number[]` (valor de cada parcela), permitindo parcelas não-uniformes.
- Novo input opcional `gracePeriods` (usado só por `grace`).
- Testes Vitest para cada tipo.

### 2. UI Simulador + NovoCliente
- Trocar o grid de 2 cards do "Modo do Empréstimo" para um grid de 6 cards (2×3 mobile, 3×2 desktop) com ícone + descrição curta.
- Quando `grace` é selecionado, mostra campo extra "Períodos de carência".
- Painel de resultado mostra a tabela de parcelas com valores reais (já existe parcial — só passa a usar `schedule`).

### 3. Persistência (NovoCliente → Supabase)
- **Migration necessária**: adicionar colunas em `contracts`:
  - `loan_mode text not null default 'installments'`
  - `grace_periods integer not null default 0`
- Ao salvar, gravar `loan_mode` e `grace_periods`, e inserir cada `contract_installments.amount` com o valor real da parcela (não mais um único `installment_amount` repetido).
- `installment_amount` continua sendo a parcela "representativa" (1ª parcela paga, ou PMT) para retrocompatibilidade do resto do app.

## Riscos / não escopo

- **AI Simulator** (`simulator-ai`): vou passar o novo `loan_mode` no prompt; análise da IA pode ficar genérica nos modos novos até refinar prompts depois.
- **Cobranças automáticas e juros de mora**: continuam usando a mesma regra; não muda.
- **Renegociação/quitação** (Fase 4 do plano anterior): não é parte desta tarefa.

## Migration

```sql
ALTER TABLE public.contracts
  ADD COLUMN loan_mode text NOT NULL DEFAULT 'installments',
  ADD COLUMN grace_periods integer NOT NULL DEFAULT 0;
```

Contratos existentes ficam como `installments` (comportamento atual preservado).

---

**Confirma?** Se sim, eu rodo a migration e implemento tudo numa tacada só.
