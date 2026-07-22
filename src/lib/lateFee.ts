// Calcula multa + juros diários em tempo real, sem depender do cron diário.
// Fallback: se não houver config de multa/juros, usa o valor `late_fee` já salvo.
export interface LateFeeInput {
  amount: number | string | null | undefined;
  due_date: string | null | undefined;
  status?: string | null;
  late_fee?: number | string | null;
  late_fee_percent?: number | string | null;
  daily_interest_percent?: number | string | null;
  paid_at?: string | null;
}

export function computeLateFee(inst: LateFeeInput, now: Date = new Date()): number {
  if (!inst) return 0;
  const stored = Number(inst.late_fee || 0);

  // Se já foi paga, mostra a multa que foi cobrada (persistida)
  if (inst.status === "paid" || inst.status === "cancelled") return stored;

  const base = Number(inst.amount || 0);
  if (!base || !inst.due_date) return stored;

  const due = new Date(inst.due_date);
  if (isNaN(due.getTime())) return stored;

  const msDay = 86400000;
  const days = Math.floor((now.getTime() - due.getTime()) / msDay);
  if (days <= 0) return stored;

  const multaPct = Number(inst.late_fee_percent || 0);
  const jurosPct = Number(inst.daily_interest_percent || 0);

  // Sem configuração de multa/juros no contrato — mantém o valor já persistido
  // (o cron auto-late-fees aplica o fallback dos defaults do credor).
  if (multaPct <= 0 && jurosPct <= 0) return stored;

  const multa = base * (multaPct / 100);
  const juros = base * (jurosPct / 100) * days;
  const total = Math.round((multa + juros) * 100) / 100;

  // Sempre mostra o maior entre o computado agora e o já persistido
  return Math.max(total, stored);
}

export function totalDue(inst: LateFeeInput, now?: Date): number {
  return Number(inst?.amount || 0) + computeLateFee(inst, now);
}

export interface LateFeeBreakdown {
  daysLate: number;
  base: number;
  multaPct: number;
  jurosPct: number;
  multa: number;
  juros: number;
  total: number;   // multa + juros (o mesmo que computeLateFee)
  withFees: number; // base + total
}

export function computeLateFeeBreakdown(inst: LateFeeInput, now: Date = new Date()): LateFeeBreakdown {
  const base = Number(inst?.amount || 0);
  const total = computeLateFee(inst, now);
  const due = inst?.due_date ? new Date(inst.due_date) : null;
  const daysLate = due && !isNaN(due.getTime()) ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)) : 0;
  const multaPct = Number(inst?.late_fee_percent || 0);
  const jurosPct = Number(inst?.daily_interest_percent || 0);
  let multa = base * (multaPct / 100);
  let juros = base * (jurosPct / 100) * daysLate;
  // Se o total veio do valor persistido (fallback) e não bate com o cálculo, distribui proporcionalmente.
  const computed = multa + juros;
  if (computed > 0 && Math.abs(computed - total) > 0.01) {
    const ratio = total / computed;
    multa = Math.round(multa * ratio * 100) / 100;
    juros = Math.round(juros * ratio * 100) / 100;
  } else if (computed === 0 && total > 0) {
    // sem config: exibe tudo como "multa" (fallback persistido)
    multa = total;
    juros = 0;
  }
  return { daysLate, base, multaPct, jurosPct, multa, juros, total, withFees: base + total };
}
