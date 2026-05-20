// Núcleo unificado de cálculo de empréstimos.
// Suporta 6 modos: installments, percentage, interest_only, price, bullet, grace.

export type LoanMode =
  | "percentage"
  | "installments"
  | "interest_only"
  | "price"
  | "bullet"
  | "grace";
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
  /** Períodos de carência (apenas para loanMode = "grace"). */
  gracePeriods?: number;
}

export interface CalculateLoanResult {
  installmentAmount: number;
  totalAmount: number;
  totalInterest: number;
  numInstallments: number;
  /** Valor real de cada parcela (mesma length de numInstallments). */
  schedule: number[];
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

export const LOAN_MODE_LABEL: Record<LoanMode, string> = {
  installments: "Por Parcelas",
  percentage: "Por Porcentagem",
  interest_only: "Só Juros + Capital no Fim",
  price: "Juros Compostos (Price)",
  bullet: "Pagamento Único no Vencimento",
  grace: "Com Carência",
};

const uniform = (value: number, n: number): number[] => Array.from({ length: n }, () => value);

export function calculateLoan(input: CalculateLoanInput): CalculateLoanResult | null {
  const { capital, frequency, loanMode } = input;
  const valueMode: ValueMode = input.valueMode ?? "rate";
  const periods = input.periods ?? 0;
  const rate = input.rate ?? 0;
  const installmentValue = input.installmentValue ?? 0;
  const grace = Math.max(0, Math.floor(input.gracePeriods ?? 0));
  const label = periodLabelFor(frequency);

  if (!capital || capital <= 0) return null;

  // Modo "valor da parcela" → deriva a taxa (apenas com parcelas fixas/installments).
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
      schedule: uniform(installmentValue, periods),
      derivedRate,
      perPeriodLabel: label,
    };
  }

  if (rate <= 0) return null;

  // ── installments (juros simples, parcelas iguais) ──
  if (loanMode === "installments") {
    if (periods <= 0) return null;
    const juros = capital * (rate / 100) * periods;
    const total = capital + juros;
    const parcela = total / periods;
    return {
      installmentAmount: parcela,
      totalAmount: total,
      totalInterest: juros,
      numInstallments: periods,
      schedule: uniform(parcela, periods),
      perPeriodLabel: label,
    };
  }

  // ── percentage ──
  if (loanMode === "percentage") {
    if (frequency === "monthly" && periods <= 0) {
      const juros = capital * (rate / 100);
      const total = capital + juros;
      return {
        installmentAmount: total,
        totalAmount: total,
        totalInterest: juros,
        numInstallments: 1,
        schedule: [total],
        perPeriodLabel: label,
      };
    }
    if (periods > 0) {
      const juros = capital * (rate / 100) * periods;
      const total = capital + juros;
      const parcela = total / periods;
      return {
        installmentAmount: parcela,
        totalAmount: total,
        totalInterest: juros,
        numInstallments: periods,
        schedule: uniform(parcela, periods),
        perPeriodLabel: label,
      };
    }
    // auto
    const autoPeriods = Math.ceil(100 / rate);
    const payPer = capital * (rate / 100);
    const total = payPer * autoPeriods;
    return {
      installmentAmount: payPer,
      totalAmount: total,
      totalInterest: total - capital,
      numInstallments: autoPeriods,
      schedule: uniform(payPer, autoPeriods),
      perPeriodLabel: label,
    };
  }

  // ── interest_only: n-1 parcelas de juros + última com juros + capital ──
  if (loanMode === "interest_only") {
    if (periods <= 0) return null;
    const jurosPeriodo = capital * (rate / 100);
    const schedule: number[] = [];
    for (let i = 0; i < periods - 1; i++) schedule.push(jurosPeriodo);
    schedule.push(jurosPeriodo + capital);
    const totalAmount = schedule.reduce((a, b) => a + b, 0);
    return {
      installmentAmount: jurosPeriodo,
      totalAmount,
      totalInterest: totalAmount - capital,
      numInstallments: periods,
      schedule,
      perPeriodLabel: label,
    };
  }

  // ── price: PMT = PV * i / (1 - (1+i)^-n) ──
  if (loanMode === "price") {
    if (periods <= 0) return null;
    const i = rate / 100;
    const pmt = i === 0 ? capital / periods : (capital * i) / (1 - Math.pow(1 + i, -periods));
    const total = pmt * periods;
    return {
      installmentAmount: pmt,
      totalAmount: total,
      totalInterest: total - capital,
      numInstallments: periods,
      schedule: uniform(pmt, periods),
      perPeriodLabel: label,
    };
  }

  // ── bullet: 1 pagamento ao fim de N períodos (juros simples) ──
  if (loanMode === "bullet") {
    if (periods <= 0) return null;
    const total = capital * (1 + (rate / 100) * periods);
    return {
      installmentAmount: total,
      totalAmount: total,
      totalInterest: total - capital,
      numInstallments: 1,
      schedule: [total],
      perPeriodLabel: label,
    };
  }

  // ── grace: g períodos sem pagar (juros simples acumulam) + n parcelas iguais ──
  if (loanMode === "grace") {
    if (periods <= 0) return null;
    const capitalApos = capital * (1 + (rate / 100) * grace);
    const juros = capitalApos * (rate / 100) * periods;
    const totalPosCarencia = capitalApos + juros;
    const parcela = totalPosCarencia / periods;
    const schedule: number[] = [];
    for (let i = 0; i < grace; i++) schedule.push(0);
    for (let i = 0; i < periods; i++) schedule.push(parcela);
    const totalAmount = schedule.reduce((a, b) => a + b, 0);
    return {
      installmentAmount: parcela,
      totalAmount,
      totalInterest: totalAmount - capital,
      numInstallments: schedule.length,
      schedule,
      perPeriodLabel: label,
    };
  }

  return null;
}

/**
 * Deriva a taxa periódica (%) a partir do valor da parcela (juros simples).
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
 */
export function generateInstallmentSchedule(params: {
  startDate: string;
  firstDueDate?: string;
  count: number;
  frequency: Frequency;
  dailyMode?: DailyMode;
  customDates?: (string | undefined)[];
  /** Para bullet: o único pagamento cai N períodos após a data base. */
  periodsAhead?: number;
}): string[] {
  const { startDate, firstDueDate, count, frequency, periodsAhead } = params;
  const dailyMode: DailyMode = params.dailyMode ?? "mon-fri";
  const customDates = params.customDates ?? [];

  // Caso bullet: 1 data, N períodos no futuro
  if (periodsAhead && periodsAhead > 0 && count === 1) {
    const s = new Date(startDate + "T12:00:00");
    if (frequency === "daily") {
      let added = 0;
      const cur = new Date(s);
      while (added < periodsAhead) {
        cur.setDate(cur.getDate() + 1);
        const dow = cur.getDay();
        if (dailyMode === "mon-fri" && (dow === 0 || dow === 6)) continue;
        if (dailyMode === "mon-sat" && dow === 0) continue;
        added++;
      }
      return [cur.toISOString()];
    }
    if (frequency === "weekly") { s.setDate(s.getDate() + 7 * periodsAhead); return [s.toISOString()]; }
    if (frequency === "biweekly") { s.setDate(s.getDate() + 15 * periodsAhead); return [s.toISOString()]; }
    s.setMonth(s.getMonth() + periodsAhead);
    return [s.toISOString()];
  }

  const dates: string[] = [];

  if (frequency === "custom") {
    for (let i = 0; i < count; i++) {
      const d = customDates[i];
      if (d) {
        dates.push(new Date(d + "T12:00:00").toISOString());
      } else {
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
      const d = new Date(baseDate);
      const offset = firstDueDateObj ? i : i + 1;
      d.setMonth(baseDate.getMonth() + offset);
      dates.push(d.toISOString());
    }
  }

  return dates;
}
