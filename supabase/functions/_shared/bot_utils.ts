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
 * Decide se um "is_receipt=true" da IA deve ser ACEITO automaticamente.
 * Regra: ou veio mídia (foto/PDF) no turno atual, ou o cliente mandou um texto
 * com sinais explícitos (números + palavra-chave). Evita baixar parcela por
 * conversa solta como "vou pagar amanhã".
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
