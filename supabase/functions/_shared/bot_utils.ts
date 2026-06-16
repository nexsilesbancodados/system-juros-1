// Utilitários do bot WhatsApp. Mantidos isolados para serem testáveis.

/** Extrai o primeiro objeto JSON balanceado de um texto livre da IA. */
export function extractJsonObject(text: string): any | null {
  if (!text || typeof text !== "string") return null;
  // tenta direto
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { /* fallthrough */ }
  }
  // procura cercas markdown ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fallthrough */ }
  }
  // varredura: encontra o primeiro `{` e busca o `}` que fecha (respeitando strings/escape)
  for (let start = 0; start < trimmed.length; start++) {
    if (trimmed[start] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try { return JSON.parse(candidate); } catch { break; }
        }
      }
    }
  }
  return null;
}

/** Saneia o resultado da IA, devolvendo um payload sempre válido (sem campos undefined). */
export function sanitizeAiResult(raw: any): {
  reply: string;
  is_receipt: boolean;
  is_rollover: boolean;
  is_promise: boolean;
  promise_date: string | null;
  receipt_value: number;
  needs_human: boolean;
  intent: string;
  summary: string;
  thought: string;
  memory_update: any;
} {
  const r = raw && typeof raw === "object" ? raw : {};
  const replyRaw = typeof r.reply === "string" ? r.reply : "";
  // remove markdown code-fences acidentais e limita
  const reply = replyRaw.replace(/```/g, "").trim().slice(0, 1500);
  const num = (v: any) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const dateOk = (s: any): string | null => {
    if (typeof s !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  return {
    reply,
    is_receipt: Boolean(r.is_receipt),
    is_rollover: Boolean(r.is_rollover),
    is_promise: Boolean(r.is_promise),
    promise_date: dateOk(r.promise_date),
    receipt_value: num(r.receipt_value),
    needs_human: Boolean(r.needs_human),
    intent: typeof r.intent === "string" ? r.intent.slice(0, 32) : "outro",
    summary: typeof r.summary === "string" ? r.summary.slice(0, 200) : "",
    thought: typeof r.thought === "string" ? r.thought.slice(0, 500) : "",
    memory_update: r.memory_update && typeof r.memory_update === "object" ? r.memory_update : null,
  };
}

/**
 * (Compat) — versão simples mantida para callers antigos.
 * Para produção use `validateReceipt`, que devolve um diagnóstico completo.
 */
export function shouldTrustReceipt(opts: {
  messageType: string;
  hasMedia: boolean;
  incomingText: string;
  receiptValue: number;
}): boolean {
  if (opts.receiptValue <= 0) return false;
  if (opts.hasMedia && (opts.messageType === "image" || opts.messageType === "document")) return true;
  const t = (opts.incomingText || "").toLowerCase();
  const KEYWORDS = ["paguei", "pago", "comprovante", "transferi", "depositei", "pix enviado", "feito o pix"];
  const hasKeyword = KEYWORDS.some(k => t.includes(k));
  const hasMoneySignal = /(r\$|reais|\d+,\d{2}|\d+\.\d{2})/.test(t);
  return hasKeyword && hasMoneySignal;
}

// ─── Validação avançada de comprovante ─────────────────────────────────────────

export interface InstallmentLike {
  id: string;
  amount: number | string;
  due_date?: string;
  late_fee?: number | string | null;
  contract_id?: string;
  installment_number?: number;
}

export interface ReceiptValidationInput {
  messageType: string;          // "text" | "image" | "document" | "audio"
  hasMedia: boolean;
  incomingText: string;
  receiptValue: number;          // valor extraído pela IA
  receiptDate?: string | null;   // YYYY-MM-DD (opcional — vindo de OCR)
  installments: InstallmentLike[];
  todayStr: string;              // YYYY-MM-DD (hoje no fuso BR)
  mediaHash?: string | null;     // SHA-256 hex do binário (anti-reuso)
  seenHashes?: Set<string>;      // hashes já usados antes (audit_logs)
  tolerancePct?: number;         // default 2% (acomoda multa pequena)
  maxFutureDays?: number;        // default 1 (recibo não pode ser do futuro além de 1d)
  maxPastDays?: number;          // default 30 (recibo muito antigo é suspeito)
}

export interface ReceiptValidation {
  trusted: boolean;
  riskScore: number;          // 0 (limpo) – 100 (rejeição)
  reasons: string[];          // motivos legíveis (logs/auditoria)
  matchedInstallmentId?: string;
  matchType?: "exact" | "tolerance" | "sum_overdue" | "total" | "partial" | "none";
  duplicate?: boolean;
  suspiciousAmount?: boolean;
  outOfWindow?: boolean;
}

const FRAUD_HINTS = [
  "editado", "photoshop", "comprovante falso", "print antigo",
  "screenshot antigo", "ja paguei isso", "já paguei isso",
];

const STRONG_KEYWORDS = ["paguei", "comprovante", "transferi", "depositei", "pix enviado", "feito o pix"];

function num(v: any): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  if (!isFinite(da) || !isFinite(db)) return 0;
  return Math.round((db - da) / 86_400_000);
}

/**
 * Validação completa de comprovante com pontuação de risco.
 *
 * Camadas:
 *  1. Evidência mínima (mídia OU texto com palavra-chave + R$).
 *  2. Sanidade de valor: precisa bater (com tolerância) com alguma parcela,
 *     soma dos atrasos ou total — senão é "suspicious_amount".
 *  3. Competência da data: rejeita data futura (> maxFutureDays) ou muito antiga
 *     (> maxPastDays). Padrão BR: hoje±1d a 30d.
 *  4. Anti-reuso: se o hash do arquivo já existe no histórico → rejeita.
 *  5. Detecção de tentativa de fraude por texto (FRAUD_HINTS).
 *
 * Decisão final: `trusted = riskScore < 50 && !duplicate && houver evidência`.
 */
export function validateReceipt(opts: ReceiptValidationInput): ReceiptValidation {
  const reasons: string[] = [];
  let risk = 0;

  const value = num(opts.receiptValue);
  if (value <= 0) {
    return { trusted: false, riskScore: 100, reasons: ["valor_zero_ou_negativo"], matchType: "none" };
  }

  const text = (opts.incomingText || "").toLowerCase();
  const hasMedia = opts.hasMedia && (opts.messageType === "image" || opts.messageType === "document");
  const hasKeyword = STRONG_KEYWORDS.some(k => text.includes(k));
  const hasMoneySignal = /(r\$|reais|\d+,\d{2}|\d+\.\d{2})/.test(text);

  // 1) Evidência mínima
  if (!hasMedia && !(hasKeyword && hasMoneySignal)) {
    return {
      trusted: false,
      riskScore: 80,
      reasons: ["sem_evidencia_minima"],
      matchType: "none",
    };
  }
  if (!hasMedia) {
    risk += 20;
    reasons.push("sem_midia_anexada");
  }

  // 2) Sanidade de valor
  const tolerance = (opts.tolerancePct ?? 2) / 100;
  const within = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.5, b * tolerance);
  const insts = (opts.installments || []).map(i => ({
    ...i,
    amt: num(i.amount) + num(i.late_fee),
  }));

  let matchedInstallmentId: string | undefined;
  let matchType: ReceiptValidation["matchType"] = "none";

  // valor exato
  const exact = insts.find(i => num(i.amount) === value || i.amt === value);
  if (exact) {
    matchedInstallmentId = exact.id;
    matchType = "exact";
  } else {
    // dentro da tolerância
    const tol = insts.find(i => within(value, num(i.amount)) || within(value, i.amt));
    if (tol) {
      matchedInstallmentId = tol.id;
      matchType = "tolerance";
    } else {
      // soma de atrasos
      const totalOverdue = insts.reduce((s, i) => s + i.amt, 0);
      if (totalOverdue > 0 && within(value, totalOverdue)) {
        matchType = "sum_overdue";
      } else {
        // pagamento parcial (>= 30% da menor parcela e < menor parcela)
        const minAmt = insts.length ? Math.min(...insts.map(i => num(i.amount))) : 0;
        if (minAmt > 0 && value >= minAmt * 0.3 && value < minAmt) {
          matchType = "partial";
          risk += 15;
          reasons.push("pagamento_parcial");
        } else {
          // valor não bate com nada → suspeito
          risk += 40;
          reasons.push("valor_nao_corresponde_parcelas");
        }
      }
    }
  }

  // valor absurdamente alto (10× a maior parcela) ou ridículo (< R$ 1)
  const maxAmt = insts.length ? Math.max(...insts.map(i => i.amt)) : 0;
  if (value < 1) {
    risk += 30;
    reasons.push("valor_irrisorio");
  }
  if (maxAmt > 0 && value > maxAmt * 10) {
    risk += 35;
    reasons.push("valor_acima_do_razoavel");
  }

  // 3) Janela temporal
  const maxFuture = opts.maxFutureDays ?? 1;
  const maxPast = opts.maxPastDays ?? 30;
  let outOfWindow = false;
  if (opts.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.receiptDate)) {
    const delta = diffDays(opts.receiptDate, opts.todayStr); // dias entre recibo→hoje
    if (delta < -maxFuture) {
      risk += 40;
      reasons.push(`data_no_futuro:${-delta}d`);
      outOfWindow = true;
    } else if (delta > maxPast) {
      risk += 25;
      reasons.push(`data_muito_antiga:${delta}d`);
      outOfWindow = true;
    }
  }

  // 4) Anti-reuso (hash)
  let duplicate = false;
  if (opts.mediaHash && opts.seenHashes && opts.seenHashes.has(opts.mediaHash)) {
    duplicate = true;
    risk = 100;
    reasons.push("comprovante_ja_utilizado");
  }

  // 5) Indícios textuais de fraude
  if (FRAUD_HINTS.some(h => text.includes(h))) {
    risk += 30;
    reasons.push("palavras_de_alerta");
  }

  const suspiciousAmount = reasons.some(r => r.startsWith("valor_"));
  const trusted = !duplicate && risk < 50;

  return {
    trusted,
    riskScore: Math.min(100, risk),
    reasons,
    matchedInstallmentId,
    matchType,
    duplicate,
    suspiciousAmount,
    outOfWindow,
  };
}

/** SHA-256 em hex. Aceita string base64 ou Uint8Array — útil para hash do binário do comprovante. */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    // base64 → bytes
    try {
      const bin = atob(input.replace(/^data:[^;]+;base64,/, ""));
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      bytes = new TextEncoder().encode(input);
    }
  } else {
    bytes = input;
  }
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Anti-eco: bloqueia envio de resposta idêntica à última feita ao mesmo JID em < TTL. */
export function isEchoOfLastReply(
  lastBotReply: Map<string, { text: string; ts: number }>,
  jid: string,
  text: string,
  ttlMs = 60_000,
): boolean {
  const last = lastBotReply.get(jid);
  if (!last) return false;
  if (Date.now() - last.ts > ttlMs) return false;
  return last.text.trim() === (text || "").trim();
}

/**
 * Calcula valor de renovação (pagar só os juros) de forma estável.
 * Prioriza taxa explícita do contrato; cai pra (parcela - capital) só se taxa não existir.
 */
export function computeRolloverInterest(opts: {
  capital: number;
  interestRate: number; // % do contrato (ex: 20 = 20%)
  installmentAmount: number;
  numInstallments?: number;
}): number {
  const capital = Number(opts.capital) || 0;
  const rate = Number(opts.interestRate) || 0;
  const inst = Number(opts.installmentAmount) || 0;
  if (capital > 0 && rate > 0) {
    return +(capital * (rate / 100)).toFixed(2);
  }
  // fallback: parcela - amortização média
  const n = Math.max(1, Number(opts.numInstallments) || 1);
  const amort = capital / n;
  const diff = inst - amort;
  return diff > 0 ? +diff.toFixed(2) : +inst.toFixed(2);
}
