// Utilitários de merge da memória do bot WhatsApp.
// Garante:
//  - Sem corrupção (entradas inválidas são descartadas, não quebram o objeto).
//  - Dedup case-insensitive (strings) ou por JSON canônico (objetos).
//  - Prioriza informações MAIS RECENTES (novas entradas substituem versões antigas
//    e ficam no topo da lista).
//  - Limite por seção (default 20) preservando as mais recentes.
//  - Serialização final respeitando MAX_BYTES (default 6000) sem produzir JSON inválido.

export const SECTION_LIMIT = 20;
export const MAX_BYTES = 6000;

export const MEMORY_SECTIONS = [
  "fatos",
  "preferencias",
  "motivos_atraso",
  "contatos_alternativos",
  "promessas",
  // Intenções recentes do cliente — cada item é um objeto:
  // { tipo, data, detalhe?, abordagem?, canal?, resultado? }
  // Usado para personalizar o PRÓXIMO envio (evitar repetir abordagem).
  "intencoes",
] as const;

export type MemorySection = typeof MEMORY_SECTIONS[number];

export interface BotMemory {
  fatos: any[];
  preferencias: any[];
  motivos_atraso: any[];
  contatos_alternativos: any[];
  promessas: any[];
  ultima_interacao?: string;
  notas_legadas?: string;
  [k: string]: any;
}

function canonicalKey(x: any): string | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "string") {
    const t = x.trim().toLowerCase();
    return t.length ? t : null;
  }
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (typeof x === "object") {
    try {
      const keys = Object.keys(x).sort();
      const norm: Record<string, any> = {};
      for (const k of keys) norm[k] = x[k];
      const s = JSON.stringify(norm);
      return s && s !== "{}" ? s.toLowerCase() : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Faz merge de duas listas priorizando as MAIS RECENTES (`incoming`).
 * - Itens inválidos (null/undefined/strings vazias) são descartados.
 * - Dedup case-insensitive; em caso de duplicata a versão NOVA vence.
 * - Resultado é cortado em `limit`, mantendo os mais recentes.
 */
export function dedupArr(
  existing: any[] = [],
  incoming: any[] = [],
  limit = SECTION_LIMIT,
): any[] {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  // newest-first: incoming antes de existing
  const ordered = [...safeIncoming, ...safeExisting];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of ordered) {
    const k = canonicalKey(item);
    if (k === null) continue; // inválido → descarta
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Faz o parse defensivo do bot_memory bruto vindo do banco. */
export function parseMemory(raw: unknown): BotMemory {
  const base: BotMemory = {
    fatos: [],
    preferencias: [],
    motivos_atraso: [],
    contatos_alternativos: [],
    promessas: [],
    intencoes: [],
  };
  if (!raw) return base;
  const s = String(raw);
  if (!s.trim().startsWith("{")) {
    return { ...base, notas_legadas: s.slice(0, 1500) };
  }
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return base;
    for (const sec of MEMORY_SECTIONS) {
      base[sec] = Array.isArray(parsed[sec]) ? parsed[sec] : [];
    }
    if (typeof parsed.ultima_interacao === "string") base.ultima_interacao = parsed.ultima_interacao;
    if (typeof parsed.notas_legadas === "string") base.notas_legadas = parsed.notas_legadas.slice(0, 1500);
    return base;
  } catch {
    return { ...base, notas_legadas: s.slice(0, 1500) };
  }
}

/**
 * Faz merge da memória existente com `update` retornado pela IA.
 * Sempre prioriza dados novos; nunca corrompe; sempre devolve um objeto válido.
 */
export function mergeMemory(
  existing: BotMemory,
  update: any,
  todayStr: string,
  limit = SECTION_LIMIT,
): BotMemory {
  const safeUpdate = update && typeof update === "object" && !Array.isArray(update) ? update : {};
  const merged: BotMemory = {
    fatos: dedupArr(existing.fatos, safeUpdate.fatos, limit),
    preferencias: dedupArr(existing.preferencias, safeUpdate.preferencias, limit),
    motivos_atraso: dedupArr(existing.motivos_atraso, safeUpdate.motivos_atraso, limit),
    contatos_alternativos: dedupArr(existing.contatos_alternativos, safeUpdate.contatos_alternativos, limit),
    promessas: dedupArr(existing.promessas, safeUpdate.promessas, limit),
    // intenções: janela menor (12) — só interessa o passado recente
    intencoes: dedupArr(existing.intencoes, safeUpdate.intencoes, Math.min(limit, 12)),
    ultima_interacao:
      (typeof safeUpdate.ultima_interacao === "string" && safeUpdate.ultima_interacao) ||
      todayStr ||
      existing.ultima_interacao,
  };
  if (existing.notas_legadas) merged.notas_legadas = existing.notas_legadas;
  return merged;
}

/**
 * Serializa garantindo que JSON.parse(serializeMemory(m)) === objeto válido.
 * Se exceder MAX_BYTES, vai cortando das seções mais ruidosas (mantendo as recentes).
 */
export function serializeMemory(memory: BotMemory, maxBytes = MAX_BYTES): string {
  let attempt = { ...memory };
  let serialized = JSON.stringify(attempt);
  if (serialized.length <= maxBytes) return serialized;

  // Estratégia: encurta seções progressivamente (mantém topo = mais recentes).
  const order: MemorySection[] = [
    "contatos_alternativos",
    "motivos_atraso",
    "preferencias",
    "fatos",
    "promessas",
  ];
  for (let cap = SECTION_LIMIT - 1; cap >= 1; cap--) {
    for (const sec of order) {
      attempt = { ...attempt, [sec]: (attempt[sec] || []).slice(0, cap) };
      serialized = JSON.stringify(attempt);
      if (serialized.length <= maxBytes) return serialized;
    }
  }
  // Último recurso: derruba notas_legadas.
  delete attempt.notas_legadas;
  serialized = JSON.stringify(attempt);
  if (serialized.length <= maxBytes) return serialized;
  // Garantia final: trunca de forma segura mantendo JSON válido.
  return JSON.stringify({
    fatos: [],
    preferencias: [],
    motivos_atraso: [],
    contatos_alternativos: [],
    promessas: [],
    ultima_interacao: memory.ultima_interacao,
  });
}
