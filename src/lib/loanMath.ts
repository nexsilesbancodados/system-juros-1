// Núcleo unificado de cálculo de empréstimos.
// Mantém EXATAMENTE a lógica que já estava espalhada em Simulador.tsx e
// NovoCliente.tsx (juros simples) para não mudar nenhum valor mostrado ao usuário.

export type LoanMode = "percentage" | "installments";
export type Frequency = "monthly" | "weekly" | "daily" | "biweekly" | "custom";
export type DailyMode = "mon-fri" | "mon-sat" | "mon-sun";
export type ValueMode = "rate" | "installment";

export interface CalculateLoanInput {
  capital: number;
  /** Taxa em % por período (ignorada se valueMode === "installment"). */
  rate?: number;
  /** Nº de parcelas / períodos. Pode ser 0 quando loanMode = "percentage" e valueMode = "rate". */
  periods?: number;
  frequency: Frequency;
  loanMode: LoanMode;
  valueMode?: ValueMode;
  /** Valor da parcela quando valueMode = "installment". */
  installmentValue?: number;
}

export interface CalculateLoanResult {
  installmentAmount: number;
  totalAmount: number;
  totalInterest: number;
  numInstallments: number;
  /** Taxa derivada (%) quando valueMode = "installment". */
  derivedRate?: number;
  perPeriodLabel: string;
}

export const periodLabelFor = (f: Frequency): string => {
  switch (f) {
    case "daily": return "dia";
    case "weekly": return "semana";
    case "biweekly": return "quinzena";
    case "custom": return "parcela";
    default: return "mês";
  }
};

/**
 * Calcula um empréstimo de juros simples conforme as regras do app.
 * Retorna `null` quando faltam inputs essenciais (mesma semântica das useMemos antigas).
 */
export function calculateLoan(input: CalculateLoanInput): CalculateLoanResult | null {
  const { capital, frequency, loanMode } = input;
  const valueMode: ValueMode = input.valueMode ?? "rate";
  const periods = input.periods ?? 0;
  const rate = input.rate ?? 0;
  const installmentValue = input.installmentValue ?? 0;
  const label = periodLabelFor(frequency);

  if (!capital || capital <= 0) return null;

  // Modo "valor da parcela" → deriva a taxa (apenas com parcelas fixas).
  if (valueMode === "installment") {
    if (loanMode !== "installments" || periods <= 0 || installmentValue <= 0) return null;
    const totalAmount = installmentValue * periods;
    const totalInterest = totalAmount - capital;
    const derivedRate = (totalInterest / (capital * periods)) * 100;
    return {
      installmentAmount: installmentValue,
      totalAmount,
      totalInterest,
      numInstallments: periods,
      derivedRate,
      perPeriodLabel: label,
    };
  }

  if (rate <= 0) return null;

  if (loanMode === "percentage") {
    // Mensal sem nº de parcelas → 1 pagamento único.
    if (frequency === "monthly" && periods <= 0) {
      const juros = capital * (rate / 100);
      return {
        installmentAmount: capital + juros,
        totalAmount: capital + juros,
        totalInterest: juros,
        numInstallments: 1,
        perPeriodLabel: label,
      };
    }
    // Periódico com nº de parcelas informado.
    if (periods > 0) {
      const juros = capital * (rate / 100) * periods;
      const total = capital + juros;
      return {
        installmentAmount: total / periods,
        totalAmount: total,
        totalInterest: juros,
        numInstallments: periods,
        perPeriodLabel: label,
      };
    }
    // Periódico sem nº → calcula até quitar (paga capital * taxa por período).
    const autoPeriods = Math.ceil(100 / rate);
    const payPer = capital * (rate / 100);
    const total = payPer * autoPeriods;
    return {
      installmentAmount: payPer,
      totalAmount: total,
      totalInterest: total - capital,
      numInstallments: autoPeriods,
      perPeriodLabel: label,
    };
  }

  // loanMode === "installments"
  if (periods <= 0) return null;
  const juros = capital * (rate / 100) * periods;
  const total = capital + juros;
  return {
    installmentAmount: total / periods,
    totalAmount: total,
    totalInterest: juros,
    numInstallments: periods,
    perPeriodLabel: label,
  };
}

/**
 * Deriva a taxa periódica (%) a partir do valor da parcela.
 * (Juros simples: total = parcela * n; juros = total - capital; taxa = juros / (capital * n) * 100)
 */
export function deriveRateFromInstallment(params: {
  capital: number;
  installment: number;
  periods: number;
}): number | null {
  const { capital, installment, periods } = params;
  if (capital <= 0 || installment <= 0 || periods <= 0) return null;
  const total = installment * periods;
  const juros = total - capital;
  return (juros / (capital * periods)) * 100;
}

/**
 * Gera as datas de vencimento das parcelas.
 * Mantém o comportamento atual: NÃO empurra fim de semana/feriado (exceto o skip de
 * fim de semana no modo "daily" conforme dailyMode).
 */
export function generateInstallmentSchedule(params: {
  /** Data base (ISO string ou "YYYY-MM-DD"). */
  startDate: string;
  /** Data da 1ª parcela (opcional). Quando ausente, soma 1 período sobre startDate. */
  firstDueDate?: string;
  count: number;
  frequency: Frequency;
  dailyMode?: DailyMode;
  /** Datas customizadas quando frequency = "custom" (uma por parcela, "YYYY-MM-DD"). */
  customDates?: (string | undefined)[];
}): string[] {
  const { startDate, firstDueDate, count, frequency } = params;
  const dailyMode: DailyMode = params.dailyMode ?? "mon-fri";
  const customDates = params.customDates ?? [];

  const dates: string[] = [];

  if (frequency === "custom") {
    for (let i = 0; i < count; i++) {
      const d = customDates[i];
      if (d) {
        dates.push(new Date(d + "T12:00:00").toISOString());
      } else {
        // fallback: cadência mensal a partir do startDate
        const s = new Date(startDate + "T12:00:00");
        s.setMonth(s.getMonth() + i + 1);
        dates.push(s.toISOString());
      }
    }
    return dates;
  }

  const s = new Date(startDate + "T12:00:00");
  const firstDueDateObj = firstDueDate ? new Date(firstDueDate + "T12:00:00") : null;

  for (let i = 0; i < count; i++) {
    if (firstDueDateObj && i === 0) {
      dates.push(firstDueDateObj.toISOString());
      continue;
    }
    const baseDate = firstDueDateObj || s;

    if (frequency === "daily") {
      let added = 0;
      const cur = new Date(firstDueDateObj || s);
      const target = firstDueDateObj ? i : i + 1;
      while (added < target) {
        cur.setDate(cur.getDate() + 1);
        const dow = cur.getDay();
        if (dailyMode === "mon-fri" && (dow === 0 || dow === 6)) continue;
        if (dailyMode === "mon-sat" && dow === 0) continue;
        added++;
      }
      dates.push(cur.toISOString());
    } else if (frequency === "weekly") {
      const d = new Date(baseDate);
      const offset = firstDueDateObj ? i * 7 : (i + 1) * 7;
      d.setDate(baseDate.getDate() + offset);
      dates.push(d.toISOString());
    } else if (frequency === "biweekly") {
      const d = new Date(baseDate);
      const offset = firstDueDateObj ? i * 15 : (i + 1) * 15;
      d.setDate(baseDate.getDate() + offset);
      dates.push(d.toISOString());
    } else {
      // monthly
      const d = new Date(baseDate);
      const offset = firstDueDateObj ? i : i + 1;
      d.setMonth(baseDate.getMonth() + offset);
      dates.push(d.toISOString());
    }
  }

  return dates;
}
