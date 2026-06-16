import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractJsonObject,
  sanitizeAiResult,
  shouldTrustReceipt,
  isEchoOfLastReply,
  computeRolloverInterest,
} from "./bot_utils.ts";

Deno.test("extractJsonObject: JSON puro", () => {
  const o = extractJsonObject('{"a":1,"b":"x"}');
  assertEquals(o.a, 1);
});

Deno.test("extractJsonObject: JSON com texto antes/depois", () => {
  const o = extractJsonObject('Aqui está: {"reply":"ok","n":2} fim');
  assertEquals(o.reply, "ok");
  assertEquals(o.n, 2);
});

Deno.test("extractJsonObject: cercas markdown ```json", () => {
  const o = extractJsonObject('```json\n{"x":true}\n```');
  assertEquals(o.x, true);
});

Deno.test("extractJsonObject: chaves dentro de string não confundem", () => {
  const o = extractJsonObject('lixo {"reply":"o cliente disse: { quero pagar }","ok":1}');
  assertEquals(o.ok, 1);
  assert(o.reply.includes("{ quero pagar }"));
});

Deno.test("extractJsonObject: devolve null sem lançar para entrada inválida", () => {
  assertEquals(extractJsonObject(""), null);
  assertEquals(extractJsonObject("sem json aqui"), null);
  assertEquals(extractJsonObject("{ inacabado"), null);
});

Deno.test("sanitizeAiResult: aplica defaults seguros para tudo", () => {
  const s = sanitizeAiResult(null);
  assertEquals(s.reply, "");
  assertEquals(s.is_receipt, false);
  assertEquals(s.receipt_value, 0);
  assertEquals(s.promise_date, null);
  assertEquals(s.intent, "outro");
});

Deno.test("sanitizeAiResult: coage números e datas inválidas", () => {
  const s = sanitizeAiResult({
    reply: "ok ```",
    receipt_value: "150,50",
    promise_date: "amanha",
    is_receipt: 1,
    intent: "x".repeat(200),
  });
  assertEquals(s.receipt_value, 150.5);
  assertEquals(s.promise_date, null);
  assertEquals(s.is_receipt, true);
  assert(s.reply.indexOf("`") === -1, "não pode ter cerca de markdown");
  assert(s.intent.length <= 32);
});

Deno.test("sanitizeAiResult: aceita data ISO válida", () => {
  const s = sanitizeAiResult({ promise_date: "2026-07-15" });
  assertEquals(s.promise_date, "2026-07-15");
});

Deno.test("shouldTrustReceipt: aceita mídia (imagem) com valor", () => {
  assert(shouldTrustReceipt({ messageType: "image", hasMedia: true, incomingText: "", receiptValue: 100 }));
});

Deno.test("shouldTrustReceipt: aceita texto com palavra-chave + valor", () => {
  assert(shouldTrustReceipt({ messageType: "text", hasMedia: false, incomingText: "paguei R$ 250,00", receiptValue: 250 }));
});

Deno.test("shouldTrustReceipt: rejeita 'vou pagar amanhã' (sem prova)", () => {
  assertEquals(
    shouldTrustReceipt({ messageType: "text", hasMedia: false, incomingText: "vou pagar amanhã", receiptValue: 100 }),
    false,
  );
});

Deno.test("shouldTrustReceipt: rejeita valor zero/negativo", () => {
  assertEquals(
    shouldTrustReceipt({ messageType: "image", hasMedia: true, incomingText: "", receiptValue: 0 }),
    false,
  );
});

Deno.test("isEchoOfLastReply: bloqueia repetição dentro do TTL", () => {
  const map = new Map<string, { text: string; ts: number }>();
  map.set("jid1", { text: "Olá, tudo bem?", ts: Date.now() });
  assert(isEchoOfLastReply(map, "jid1", "Olá, tudo bem?"));
  assertEquals(isEchoOfLastReply(map, "jid1", "Outra coisa"), false);
});

Deno.test("isEchoOfLastReply: libera após TTL", () => {
  const map = new Map<string, { text: string; ts: number }>();
  map.set("jid1", { text: "X", ts: Date.now() - 120_000 });
  assertEquals(isEchoOfLastReply(map, "jid1", "X", 60_000), false);
});

Deno.test("computeRolloverInterest: usa capital * taxa quando disponível", () => {
  const v = computeRolloverInterest({ capital: 1000, interestRate: 20, installmentAmount: 0 });
  assertEquals(v, 200);
});

Deno.test("computeRolloverInterest: fallback usa parcela - amortização", () => {
  // capital 1200, 12x => amort 100/parcela; parcela 150 => juros 50
  const v = computeRolloverInterest({ capital: 1200, interestRate: 0, installmentAmount: 150, numInstallments: 12 });
  assertEquals(v, 50);
});

Deno.test("computeRolloverInterest: nunca devolve negativo", () => {
  const v = computeRolloverInterest({ capital: 1000, interestRate: 0, installmentAmount: 50, numInstallments: 1 });
  assert(v > 0);
});
