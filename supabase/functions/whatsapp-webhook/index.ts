import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSharedSecret } from "../_shared/guard.ts";
import { parseMemory, mergeMemory, serializeMemory } from "../_shared/memory.ts";
import {
  extractJsonObject,
  sanitizeAiResult,
  validateReceipt,
  sha256Hex,
  isEchoOfLastReply,
  computeRolloverInterest,
  validatePixReply,
  computeClientBehavior,
  detectResponseLoop,
  detectClientTone,
} from "../_shared/bot_utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory dedupe (per isolate) — evita responder a mesma msg 2x
const processedMessages = new Map<string, number>();
const DEDUPE_TTL_MS = 5 * 60 * 1000;

// Rate limit por JID — evita loops/spam
const jidRateBucket = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;

// Buffer de mensagens (debounce) — agrupa mensagens consecutivas do mesmo contato
const messageBuffer = new Map<string, { texts: string[]; lastTs: number }>();
const BUFFER_WAIT_MS = 5000;

// Lock por JID — evita duas execuções paralelas respondendo ao mesmo contato
const jidLock = new Map<string, number>();
const LOCK_TTL_MS = 30 * 1000;

// Última resposta enviada pelo bot por JID — evita "eco"
const lastBotReply = new Map<string, { text: string; ts: number }>();

// Saudações variadas (lead)
const LEAD_GREETINGS = [
  (e: string) => `Olá! 👋 Aqui é da *${e}*.\n\nNão consegui localizar seu cadastro pelo seu número. Pode me passar seu *nome completo* e *CPF*? Assim consigo te atender direitinho. 😊`,
  (e: string) => `Oi, tudo bem? 🙂\n\nAqui é o atendimento da *${e}*. Pra te ajudar melhor, pode me informar seu *nome* e *CPF*?`,
  (e: string) => `Olá! Seja bem-vindo(a) à *${e}*. 🤝\n\nPra puxar seu cadastro, preciso do seu *nome completo* e *CPF*, por favor.`,
  (e: string) => `Oi! 👋 Aqui é da *${e}*.\n\nNão te encontrei na nossa base. Me ajuda com seu *nome completo* e *CPF* pra eu seguir? 😉`,
];
const pickGreeting = (e: string) => LEAD_GREETINGS[Math.floor(Math.random() * LEAD_GREETINGS.length)](e);

function norm(s: string) { return (s || "").toLowerCase().replace(/\s+/g, " ").trim(); }

function rememberMessage(id: string) {
  const now = Date.now();
  processedMessages.set(id, now);
  for (const [k, t] of processedMessages) {
    if (now - t > DEDUPE_TTL_MS) processedMessages.delete(k);
  }
}

function isRateLimited(jid: string): boolean {
  const now = Date.now();
  const arr = (jidRateBucket.get(jid) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { jidRateBucket.set(jid, arr); return true; }
  arr.push(now);
  jidRateBucket.set(jid, arr);
  return false;
}

const STOP_WORDS = ["parar bot", "pare bot", "pare de me mandar", "para de mandar", "cancelar bot", "desativar bot", "silenciar bot", "stop bot", "chega de bot", "para com isso bot", "desliga o bot"];
const HUMAN_WORDS = ["atendente", "humano", "pessoa de verdade", "falar com alguem", "falar com alguém", "falar c alguem", "operador", "gerente", "responsavel", "responsável", "quero falar com voce mesmo", "quero falar com vc mesmo", "com uma pessoa", "com alguém real", "quero falar com o dono", "quero falar com o patrão"];
const PIX_WORDS = ["qual o pix", "qual a chave pix", "me passa o pix", "manda o pix", "envia o pix", "me manda a chave pix", "manda a chave", "me manda a chave", "qual sua chave", "qual a chave", "chave pra pagar", "pix pra pagar", "pix p pagar"];

function matchesAny(text: string, words: string[]): boolean {
  const t = (text || "").toLowerCase();
  return words.some(w => t.includes(w));
}

function isWithinBusinessHours(settings: any): boolean {
  if (!settings?.bot_business_hours_only) return true;
  const start = settings.bot_business_start || "08:00";
  const end = settings.bot_business_end || "18:00";
  const now = new Date();
  const local = new Date(now.getTime() + (-180 - now.getTimezoneOffset()) * 60000);
  const hm = `${String(local.getHours()).padStart(2,"0")}:${String(local.getMinutes()).padStart(2,"0")}`;
  return hm >= start && hm <= end;
}

async function evolutionFetch(apiUrl: string, apiKey: string, path: string, body: any) {
  try {
    return await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("evolution fetch failed", path, e);
    return null;
  }
}

async function sendPresence(apiUrl: string, apiKey: string, instance: string, jid: string, presence: "composing" | "paused" | "available") {
  await evolutionFetch(apiUrl, apiKey, `/chat/sendPresence/${instance}`, { number: jid, presence, delay: 1200 });
}

async function markAsRead(apiUrl: string, apiKey: string, instance: string, key: any) {
  await evolutionFetch(apiUrl, apiKey, `/chat/markMessageAsRead/${instance}`, { readMessages: [key] });
}

async function sendText(apiUrl: string, apiKey: string, instance: string, jid: string, text: string) {
  const chunks = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  const list = chunks.length > 0 ? chunks : [text];
  for (let i = 0; i < list.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800));
    await evolutionFetch(apiUrl, apiKey, `/message/sendText/${instance}`, {
      number: jid,
      text: list[i],
      delay: Math.min(1500, 400 + list[i].length * 25),
    });
  }
}

async function upsertConversation(supabase: any, params: {
  userId: string; phone: string; jid: string; instance: string;
  clientId?: string | null; contactName?: string | null;
  preview: string; from: "client" | "bot" | "human"; incrementUnread: boolean;
}): Promise<string | null> {
  const { userId, phone, jid, instance, clientId, contactName, preview, from, incrementUnread } = params;
  const { data: existing } = await supabase
    .from("whatsapp_conversations").select("id, unread_count")
    .eq("user_id", userId).eq("phone", phone).maybeSingle();
  
  if (existing) {
    await supabase.from("whatsapp_conversations").update({
      jid, instance,
      client_id: clientId ?? undefined,
      contact_name: contactName ?? undefined,
      last_message_at: new Date().toISOString(),
      last_message_preview: preview.slice(0, 200),
      last_message_from: from,
      unread_count: incrementUnread ? (existing.unread_count || 0) + 1 : existing.unread_count,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return existing.id;
  }
  
  const { data: created } = await supabase.from("whatsapp_conversations").insert({
    user_id: userId, phone, jid, instance,
    client_id: clientId ?? null, contact_name: contactName ?? null,
    last_message_preview: preview.slice(0, 200), last_message_from: from,
    unread_count: incrementUnread ? 1 : 0,
  }).select("id").single();
  return created?.id ?? null;
}

async function logMessage(supabase: any, params: {
  conversationId: string; userId: string;
  direction: "in" | "out"; sender: "client" | "bot" | "human";
  messageType: string; content: string;
  waMessageId?: string | null; mediaUrl?: string | null; metadata?: any;
}) {
  await supabase.from("whatsapp_messages").insert({
    conversation_id: params.conversationId,
    user_id: params.userId,
    direction: params.direction,
    sender: params.sender,
    message_type: params.messageType,
    content: params.content,
    wa_message_id: params.waMessageId ?? null,
    media_url: params.mediaUrl ?? null,
    metadata: params.metadata ?? {},
  });
}

async function logBotAction(supabase: any, params: {
  userId: string; clientId?: string | null; conversationId?: string | null;
  toolName: string; toolInput?: any; toolOutput?: any;
  success?: boolean; errorMessage?: string | null;
}) {
  try {
    await supabase.from("bot_actions_log").insert({
      user_id: params.userId,
      client_id: params.clientId ?? null,
      conversation_id: params.conversationId ?? null,
      tool_name: params.toolName,
      tool_input: params.toolInput ?? {},
      tool_output: params.toolOutput ?? {},
      success: params.success ?? true,
      error_message: params.errorMessage ?? null,
    });
  } catch (e) {
    console.warn("[bot_actions_log] insert failed:", e);
  }
}

async function escalateToHuman(supabase: any, convoId: string, reason: string) {
  await supabase.from("whatsapp_conversations").update({
    bot_paused: true,
    bot_status: "handoff",
    needs_human: true,
    human_takeover_at: new Date().toISOString(),
    human_takeover_reason: reason,
  }).eq("id", convoId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // SEGURANÇA (C2): o Evolution não assina o payload, então exigimos um segredo
  // compartilhado. Configure o webhook do Evolution com `?secret=<valor>` na URL
  // (ou header x-webhook-secret) e defina EVOLUTION_WEBHOOK_SECRET nos secrets.
  // FAIL-SAFE: só passa a EXIGIR quando o env estiver setado — assim o deploy do
  // código não derruba a recepção antes de você configurar o segredo no Evolution.
  if (!checkSharedSecret(req, "EVOLUTION_WEBHOOK_SECRET", "x-webhook-secret")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    const payload = await req.json();
    if (payload.event !== "messages.upsert" && payload.event !== "MESSAGES_UPSERT") {
      return new Response(JSON.stringify({ status: "ignored_event" }), { headers: corsHeaders });
    }

    const data = payload.data;
    const key = data?.key ?? data?.message?.key;
    const msgContent = data?.message?.message ?? data?.message;
    if (!key || key.fromMe) return new Response(JSON.stringify({ status: "ignored_self" }), { headers: corsHeaders });

    const msgId = key.id;
    if (msgId && processedMessages.has(msgId)) return new Response(JSON.stringify({ status: "duplicate" }), { headers: corsHeaders });
    if (msgId) rememberMessage(msgId);

    const senderJid = key.remoteJid;
    if (!senderJid || senderJid.includes("@g.us") || senderJid.includes("@broadcast")) {
      return new Response(JSON.stringify({ status: "ignored_jid" }), { headers: corsHeaders });
    }
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");
    const instanceName = payload.instance;

    let messageType = "text";
    let incomingText = msgContent?.conversation || msgContent?.extendedTextMessage?.text || "";
    let mediaData: string | null = null;
    let mimeType: string | null = null;

    if (msgContent?.imageMessage) {
      messageType = "image";
      mimeType = msgContent.imageMessage.mimetype;
      incomingText = msgContent.imageMessage.caption || "";
    } else if (msgContent?.audioMessage) {
      messageType = "audio";
      mimeType = msgContent.audioMessage.mimetype;
    } else if (msgContent?.documentMessage) {
      messageType = "document";
      mimeType = msgContent.documentMessage.mimetype;
      incomingText = msgContent.documentMessage.caption || msgContent.documentMessage.fileName || "";
    }

    const { data: settings } = await supabase.from("settings").select("*").eq("whatsapp_instance", instanceName).single();
    if (!settings || !settings.bot_enabled) return new Response(JSON.stringify({ status: "bot_disabled" }), { headers: corsHeaders });

    const apiUrl = (settings.whatsapp_api_url || "").replace(/\/$/, "");
    const apiKey = settings.whatsapp_api_key;
    if (apiUrl && apiKey) markAsRead(apiUrl, apiKey, instanceName, key).catch(() => {});

    const userId = settings.user_id;

    // CLIENT LOOKUP
    let client: any = null;
    const CLIENT_FIELDS = "id, name, phone, whatsapp, cpf_cnpj, status, credit_score, bot_memory, birth_date, email, address, notes, occupation, monthly_income";
    const { data: convoExisting } = await supabase.from("whatsapp_conversations").select("id, client_id, bot_paused, blocked").eq("user_id", userId).eq("phone", senderPhone).maybeSingle();
    if (convoExisting?.client_id) {
      const { data: c } = await supabase.from("clients").select(CLIENT_FIELDS).eq("id", convoExisting.client_id).maybeSingle();
      if (c) client = c;
    }
    if (!client) {
      const tail = senderPhone.slice(-9);
      const { data: clients } = await supabase.from("clients").select(CLIENT_FIELDS).eq("user_id", userId);
      client = clients?.find(c => {
        const cPhone = (c.whatsapp || c.phone || "").replace(/\D/g, "");
        return cPhone.slice(-9) === tail || cPhone.slice(-8) === senderPhone.slice(-8);
      });
    }

    const { data: profile } = await supabase.from("profiles").select("name, pix_key, pix_key_type").eq("id", userId).single();

    const pushName = data?.pushName || data?.message?.pushName || null;
    const convoId = await upsertConversation(supabase, {
      userId, phone: senderPhone, jid: senderJid, instance: instanceName,
      clientId: client?.id ?? null, contactName: client?.name || pushName,
      preview: incomingText || `[${messageType}]`, from: "client", incrementUnread: true,
    });
    if (convoId) {
      await logMessage(supabase, {
        conversationId: convoId, userId, direction: "in", sender: "client",
        messageType, content: incomingText || "", waMessageId: msgId, metadata: { jid: senderJid, mime: mimeType },
      });
    }

    if (convoExisting?.blocked) return new Response(JSON.stringify({ status: "blocked" }), { headers: corsHeaders });

    const botSay = async (text: string) => {
      if (!text || !apiUrl || !apiKey) return;
      if (isEchoOfLastReply(lastBotReply, senderJid, text)) {
        console.log("[anti-eco] resposta idêntica suprimida para", senderJid);
        return;
      }
      lastBotReply.set(senderJid, { text, ts: Date.now() });
      await sendText(apiUrl, apiKey, instanceName, senderJid, text);
      if (convoId) {
        await logMessage(supabase, { conversationId: convoId, userId, direction: "out", sender: "bot", messageType: "text", content: text });
        await supabase.from("whatsapp_conversations").update({
          last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 200), last_message_from: "bot", updated_at: new Date().toISOString(),
        }).eq("id", convoId);
      }
    };

    if (convoExisting?.bot_paused) return new Response(JSON.stringify({ status: "paused" }), { headers: corsHeaders });
    if (apiUrl && apiKey) sendPresence(apiUrl, apiKey, instanceName, senderJid, "composing").catch(() => {});

    if (!client) {
      const { data: recentLead } = await supabase.from("audit_logs").select("created_at").eq("user_id", userId).eq("entity_type", "whatsapp_lead").eq("action", "lead_message").ilike("details->>phone", senderPhone).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!recentLead || Date.now() - new Date(recentLead.created_at).getTime() > 60 * 60 * 1000) {
        await botSay(pickGreeting(settings.company_name || profile?.name || "nossa empresa"));
        await supabase.from("notifications").insert({ user_id: userId, title: "Novo contato", message: `Número ${senderPhone} não cadastrado.`, type: "info" });
      }
      await supabase.from("audit_logs").insert({ user_id: userId, entity_type: "whatsapp_lead", action: "lead_message", details: { phone: senderPhone, message: incomingText } });
      return new Response(JSON.stringify({ status: "lead" }), { headers: corsHeaders });
    }

    if (isRateLimited(senderJid)) return new Response(JSON.stringify({ status: "rate_limit" }), { headers: corsHeaders });

    // DEBOUNCE
    {
      const buf = messageBuffer.get(senderJid) || { texts: [], lastTs: 0 };
      if (messageType === "text" && incomingText) buf.texts.push(incomingText);
      buf.lastTs = Date.now();
      messageBuffer.set(senderJid, buf);
      const myTs = buf.lastTs;
      await new Promise(r => setTimeout(r, BUFFER_WAIT_MS));
      const current = messageBuffer.get(senderJid);
      if (!current || current.lastTs > myTs) return new Response(JSON.stringify({ status: "debounced" }), { headers: corsHeaders });
      if (messageType === "text") incomingText = current.texts.join("\n").slice(0, 2000);
      messageBuffer.delete(senderJid);
    }

    // LOCK (try/finally garante liberação mesmo em erro)
    const lockHeld = jidLock.get(senderJid) || 0;
    if (lockHeld && Date.now() - lockHeld < LOCK_TTL_MS) return new Response(JSON.stringify({ status: "locked" }), { headers: corsHeaders });
    jidLock.set(senderJid, Date.now());
    try {


    // COMMANDS
    if (matchesAny(incomingText, STOP_WORDS)) {
      await supabase.from("audit_logs").insert({ user_id: userId, entity_type: "whatsapp_bot", action: "paused", entity_id: client.id, details: { reason: "client_stop" } });
      await logBotAction(supabase, { userId, clientId: client.id, conversationId: convoId, toolName: "pause_bot", toolInput: { reason: "client_stop_command" } });
      await botSay("🤖 Bot pausado. Um atendente humano falará com você em breve.");
      await supabase.from("whatsapp_conversations").update({ bot_paused: true, bot_status: "paused" }).eq("id", convoId);
      return new Response(JSON.stringify({ status: "stopped" }), { headers: corsHeaders });
    }
    if (matchesAny(incomingText, HUMAN_WORDS)) {
      await logBotAction(supabase, { userId, clientId: client.id, conversationId: convoId, toolName: "escalate_to_human", toolInput: { reason: "client_requested_human" } });
      await botSay("👤 Chamando um atendente humano...");
      await escalateToHuman(supabase, convoId!, "Cliente pediu atendente humano");
      await supabase.from("notifications").insert({ user_id: userId, title: "🚨 Atendimento humano solicitado", message: `${client.name} pediu para falar com um humano.`, type: "warning" });
      return new Response(JSON.stringify({ status: "human" }), { headers: corsHeaders });
    }
    if (matchesAny(incomingText, PIX_WORDS) && profile?.pix_key) {
      await botSay(`Chave PIX: *${profile.pix_key}* (${profile.pix_key_type || "PIX"}). Aguardo o comprovante! ✅`);
      return new Response(JSON.stringify({ status: "pix" }), { headers: corsHeaders });
    }

    if (!isWithinBusinessHours(settings)) {
      await botSay(`Olá! Recebi sua mensagem fora do horário (${settings.bot_business_start || "08:00"} às ${settings.bot_business_end || "18:00"}). Retorno em breve! 🙏`);
      return new Response(JSON.stringify({ status: "off_hours" }), { headers: corsHeaders });
    }

    // DOWNLOAD MEDIA
    if (messageType !== "text" && apiUrl && apiKey) {
      const resp = await evolutionFetch(apiUrl, apiKey, `/chat/getBase64FromMediaMessage/${instanceName}`, { message: { key, message: msgContent }, convertToMp4: false });
      if (resp?.ok) mediaData = (await resp.json()).base64;
    }

    // ENRICH DATA (contexto rico p/ a IA)
    const [
      { data: activeContracts },
      { data: installments },
      { data: interactionLogs },
      { data: allPaid },
      { data: recentPaid },
      { data: humanNotes },
      { data: openPromises },
      { data: messageTemplates },
    ] = await Promise.all([
      supabase.from("contracts").select("id, capital, total_amount, start_date, status, loan_mode, frequency, interest_rate, num_installments").eq("client_id", client.id).eq("status", "active"),
      supabase.from("contract_installments").select("id, amount, due_date, status, late_fee, installment_number, contract_id").eq("client_id", client.id).in("status", ["pending", "overdue"]).order("due_date", { ascending: true }),
      supabase.from("audit_logs").select("action, created_at, details").eq("entity_id", client.id).eq("entity_type", "whatsapp_bot").order("created_at", { ascending: false }).limit(10),
      supabase.from("contract_installments").select("id").eq("client_id", client.id).eq("status", "paid"),
      supabase.from("contract_installments").select("amount, paid_amount, paid_at, installment_number, payment_method").eq("client_id", client.id).eq("status", "paid").order("paid_at", { ascending: false }).limit(5),
      supabase.from("whatsapp_notes").select("content, created_by, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(8),
      supabase.from("audit_logs").select("created_at, details").eq("entity_id", client.id).eq("entity_type", "whatsapp_bot").eq("action", "promise_to_pay").order("created_at", { ascending: false }).limit(5),
      supabase.from("message_templates").select("name, content").eq("user_id", userId).limit(8),
    ]);

    const paidCount = allPaid?.length || 0;

    const now = new Date();
    const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
    const todayStr = brDate.toISOString().split('T')[0];

    const daysBetween = (a: string, b: string) => {
      const da = new Date(a + "T12:00:00"); const db = new Date(b + "T12:00:00");
      return Math.round((db.getTime() - da.getTime()) / 86400000);
    };

    const overdue = (installments || []).filter(i => {
      const dueDate = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return dueDate < todayStr;
    });
    const dueToday = (installments || []).filter(i => {
      const dueDate = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return dueDate === todayStr;
    });
    const upcoming = (installments || []).filter(i => {
      const dueDate = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return dueDate > todayStr;
    }).slice(0, 3);

    const totalOverdue = overdue.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
    const totalDueToday = dueToday.reduce((s, i) => s + Number(i.amount), 0);

    // Renovação (pagar só juros) — usa cálculo estável (capital × taxa)
    const rolloverOptions = (activeContracts || []).map(c => {
      const inst = installments?.find(i => i.contract_id === c.id);
      if (!inst) return null;
      return {
        contractId: c.id,
        interestOnly: computeRolloverInterest({
          capital: Number(c.capital),
          interestRate: Number(c.interest_rate),
          installmentAmount: Number(inst.amount),
          numInstallments: Number(c.num_installments),
        }),
        totalAmount: Number(inst.amount),
        frequency: c.frequency,
      };
    }).filter(Boolean);

    // Histórico de conversa (mais largo)
    const conversationHistory: any[] = [];
    if (convoId) {
      const { data: msgHistory } = await supabase
        .from("whatsapp_messages")
        .select("direction, content, message_type, metadata, created_at")
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: false })
        .limit(80);
      (msgHistory || []).reverse().forEach(h => {
        const txt = h.content || h.metadata?.transcript || `[${h.message_type}]`;
        conversationHistory.push({ role: h.direction === "in" ? "user" : "assistant", content: txt });
      });
    }

    // Memória de longo prazo — JSON estruturado (com fallback p/ texto legado)
    const memoryObj = parseMemory(client.bot_memory);
    const memoryPretty = JSON.stringify(memoryObj, null, 2);

    // Promessas pendentes (audit_logs) ainda não concluídas
    const pendingPromises = (openPromises || []).map(p => ({
      date: p.details?.promise_date,
      created_at: p.created_at,
      message: p.details?.message,
    })).filter(p => p.date && p.date >= todayStr);

    // Notas humanas e templates como referência
    const humanNotesText = (humanNotes || []).map(n => `- [${n.created_by || 'humano'} em ${(n.created_at || '').slice(0,10)}] ${n.content}`).join("\n").slice(0, 1500);
    const recentPaidText = (recentPaid || []).map(p => `- Parcela #${p.installment_number}: R$ ${Number(p.paid_amount || p.amount).toFixed(2)} em ${(p.paid_at || '').slice(0,10)}${p.payment_method ? ` (${p.payment_method})` : ''}`).join("\n");
    const templatesText = (messageTemplates || []).map(t => `• ${t.name}: ${t.content.slice(0, 120)}`).join("\n").slice(0, 800);

    const contractShort = (id?: string) => id ? `#${String(id).slice(0,6)}` : '';

    const overdueDetail = overdue.map(i => {
      const d = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      const days = daysBetween(d, todayStr);
      return `- [Contrato ${contractShort(i.contract_id)}] Parcela #${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} (${days}d em atraso, desde ${d}${i.late_fee ? `, multa R$ ${Number(i.late_fee).toFixed(2)}` : ''})`;
    }).join('\n');

    const upcomingDetail = upcoming.map(i => {
      const d = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return `- [Contrato ${contractShort(i.contract_id)}] Parcela #${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} (vence em ${d})`;
    }).join('\n');

    const addr: any = client.address || {};
    const addressLine = (typeof addr === "object" && (addr.street || addr.city))
      ? `${addr.street || ''}${addr.number ? ', ' + addr.number : ''}${addr.city ? ' - ' + addr.city : ''}${addr.state ? '/' + addr.state : ''}`.trim()
      : (typeof addr === "string" ? addr : "");

    const scoreNum = client.credit_score ?? 50;
    const perfilPagador = scoreNum > 80 ? 'EXCELENTE' : scoreNum >= 60 ? 'BOM' : scoreNum >= 40 ? 'MEDIANO' : 'RISCO ALTO';
    const maxDiasAtraso = overdue.reduce((max, i) => {
      const d = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return Math.max(max, daysBetween(d, todayStr));
    }, 0);
    const estagio = maxDiasAtraso === 0 ? 'em dia' : maxDiasAtraso <= 3 ? 'lembrete amigável' : maxDiasAtraso <= 10 ? 'cobrança padrão' : maxDiasAtraso <= 30 ? 'cobrança firme' : 'pré-jurídico';

    const systemPrompt = `Você é o Atendente Virtual Sênior da "${settings.company_name || 'nossa empresa'}", especialista em recuperação de crédito com 10 anos de experiência. Sua missão: RECUPERAR VALORES com máxima eficiência, mantendo o relacionamento com o cliente. Você é PRECISO, EMPÁTICO e NUNCA inventa fatos.

═══ 👤 PERFIL DO CLIENTE ═══
Nome: ${client.name}
CPF: ${client.cpf_cnpj || 'n/d'} | Nascimento: ${client.birth_date || 'n/d'}
Telefone: ${client.phone || senderPhone} | WhatsApp: ${client.whatsapp || senderPhone}
E-mail: ${client.email || 'n/d'} | Endereço: ${addressLine || 'n/d'}
Profissão: ${client.occupation || 'n/d'} | Renda mensal: ${client.monthly_income ? `R$ ${Number(client.monthly_income).toFixed(2)}` : 'n/d'}
Status: ${client.status || 'Ativo'} | Score: ${scoreNum}/100 → PERFIL ${perfilPagador}
Parcelas já pagas no histórico: ${paidCount}
Notas de cadastro: ${client.notes || '(nenhuma)'}

═══ 📂 CONTRATOS ATIVOS (${activeContracts?.length || 0}) ═══
⚠️ CADA CONTRATO É INDEPENDENTE. NUNCA some parcelas entre contratos. Sempre cite o ID curto (#abc123) e o número da parcela ao mencionar valores.
${(activeContracts || []).map(c => `- Contrato ${contractShort(c.id)}: Capital R$ ${Number(c.capital).toFixed(2)} | ${c.num_installments || '?'}x | modo ${c.loan_mode || 'normal'} | ${c.frequency} | taxa ${c.interest_rate}% | início ${c.start_date}`).join('\n') || '(nenhum)'}

═══ 💰 SITUAÇÃO FINANCEIRA — HOJE ${brDate.toLocaleDateString('pt-BR')} ═══
📅 Vence HOJE: R$ ${totalDueToday.toFixed(2)} (${dueToday.length} parcela(s))
⚠️ EM ATRASO: R$ ${totalOverdue.toFixed(2)} (${overdue.length} parcela(s)) — maior atraso: ${maxDiasAtraso}d
💯 TOTAL para quitar pendências AGORA: R$ ${(totalDueToday + totalOverdue).toFixed(2)}
🎯 ESTÁGIO DE COBRANÇA sugerido: ${estagio}

Detalhe ATRASADAS (fonte de verdade — copie os valores LITERAL):
${overdueDetail || '(sem atrasos)'}

Detalhe VENCE HOJE:
${dueToday.map(i => `- [Contrato ${contractShort(i.contract_id)}] Parcela #${i.installment_number}: R$ ${Number(i.amount).toFixed(2)}`).join('\n') || '(nenhuma)'}

Próximas (preview, NÃO cobrar ainda):
${upcomingDetail || '(sem próximas pendentes)'}

═══ 🔄 OPÇÕES DE RENOVAÇÃO (só juros) — por contrato ═══
${rolloverOptions.map((o: any) => `- Contrato ${contractShort(o.contractId)}: juros de R$ ${o.interestOnly.toFixed(2)} → empurra o principal p/ próximo ciclo (${o.frequency})`).join('\n') || '(n/d)'}

═══ ✅ ÚLTIMOS PAGAMENTOS ═══
${recentPaidText || '(nenhum pagamento ainda)'}

═══ 📝 NOTAS HUMANAS (operador/CRM) ═══
${humanNotesText || '(nenhuma)'}

═══ 🤝 PROMESSAS PENDENTES ═══
${pendingPromises.length ? pendingPromises.map(p => `- Promete pagar até ${p.date} ${p.message ? `("${String(p.message).slice(0,120)}")` : ''}`).join('\n') : '(nenhuma)'}

═══ 🧠 MEMÓRIA DE LONGO PRAZO (JSON) ═══
${memoryPretty}

═══ ✍️ TEMPLATES DA EMPRESA (inspiração de tom) ═══
${templatesText || '(sem templates cadastrados)'}

═══ ⚙️ CONFIGURAÇÕES ═══
Multa: ${settings.default_late_fee || 0}% | Juros diários pós-vencimento: ${settings.default_daily_interest || 0}%/dia
Horário comercial: ${settings.bot_business_start || '08:00'}–${settings.bot_business_end || '18:00'}
PIX: ${profile?.pix_key || '(sem chave cadastrada)'} ${profile?.pix_key_type ? `(${profile.pix_key_type})` : ''} | Recebedor: ${profile?.name || settings.company_name}

═══ 🧭 FRAMEWORK DE RACIOCÍNIO (siga SEMPRE nesta ordem, no campo "thought") ═══
1. OBSERVAR: O que o cliente escreveu? Qual a intenção real (não apenas literal)? Há anexo (comprovante)?
2. RECUPERAR CONTEXTO: Última interação, promessas pendentes, último pagamento, o que já foi cobrado nas últimas mensagens. NUNCA repita cobrança já feita há < 3 mensagens sem novo motivo.
3. VALIDAR NÚMEROS: Se você vai citar QUALQUER valor, localize-o EXATAMENTE nas seções acima (ATRASADAS / VENCE HOJE / RENOVAÇÃO). Se não achar bater LITERAL, escale (needs_human=true). Confira: valor de cada parcela + soma total.
4. DECIDIR AÇÃO: Baseado no estágio "${estagio}" e perfil "${perfilPagador}", escolha o playbook (ver abaixo).
5. RESPONDER: Máx 5 linhas, tom humano, PT-BR coloquial brasileiro, 1–2 emojis no máximo.

═══ 🎭 PLAYBOOKS por cenário ═══
▸ CLIENTE EM DIA ("oi", dúvida): Atenda a dúvida direto, sem cobrar. Seja prestativo.
▸ LEMBRETE AMIGÁVEL (0–3d atraso): Tom leve. "Oi Fulano, tudo bem? Notei que a parcela de R$ X (contrato #abc) venceu ${maxDiasAtraso === 0 ? 'hoje' : 'ontem'}. Já tem previsão pra acertar? PIX: ${profile?.pix_key || '(chave)'}"
▸ COBRANÇA PADRÃO (4–10d): Direto ao ponto. Lista atrasos em bullets, informa total, envia PIX, pede prazo.
▸ COBRANÇA FIRME (11–30d): Cordial mas firme. Mencione que juros/multa acumulam a cada dia. Ofereça renovação (só juros) se cliente sinalizar dificuldade.
▸ PRÉ-JURÍDICO (>30d): Tom sério, sem ameaças vazias. Peça posicionamento hoje. Se cliente não responder ou for hostil → needs_human=true.
▸ PROMESSA QUEBRADA: Reconheça a promessa anterior ("você havia combinado pagar até DD/MM"), pergunte o que houve, ofereça nova data OU renovação. Sem julgamento.
▸ COMPROVANTE recebido: Confirme o que viu ("Recebi seu comprovante de R$ X em DD/MM 👍"), agradeça pelo nome, encerre bem. is_receipt=true APENAS se houver imagem/PDF real anexado.
▸ NEGOCIAÇÃO / PEDIDO DE DESCONTO: Descontos ≤10% da multa: pode ofertar. Descontos >10% ou parcelamento atípico: needs_human=true.
▸ CLIENTE HOSTIL / OFENSAS / PEDE HUMANO: needs_human=true, resposta curta e educada dizendo que um atendente humano assumirá.

═══ 🚨 REGRAS INVIOLÁVEIS ═══
✗ NUNCA invente valor, contrato, parcela, taxa ou política. Se não está listado acima, não existe.
✗ NUNCA some parcelas de contratos diferentes como se fossem o mesmo débito.
✗ NUNCA prometa desconto/prazo sem estar no seu escopo (regra 8 do playbook).
✗ NUNCA marque is_receipt=true por texto ("já paguei") sem imagem/PDF anexado.
✗ NUNCA cumprimente 2x na mesma conversa. Se já falou "oi/bom dia", vá direto ao ponto.
✗ NUNCA peça dado que já está no perfil (nome, CPF, endereço).
✗ NUNCA repita a mesma cobrança em 2 mensagens seguidas — se cliente ignorou, responda o novo assunto e cite a pendência UMA vez ao final.

═══ ✅ EXEMPLOS DE RESPOSTAS IDEAIS ═══
Ex1 — Cliente manda "oi" com 1 parcela 5d atrasada:
"Oi ${client.name.split(' ')[0]}! Tudo bem? 👋 Deu uma olhada aqui e a parcela #3 do contrato #abc123 (R$ 320,00) venceu há 5 dias. Consegue resolver hoje? PIX ${profile?.pix_key || 'chave'}. Qualquer coisa me avisa 🙌"

Ex2 — Cliente diz "paguei" sem enviar comprovante:
"Beleza! Pra confirmar aqui no sistema, manda o comprovante (print ou PDF) por favor? Assim que chegar eu dou baixa na hora 👍"

Ex3 — Cliente pede parcelar atraso de 3 parcelas:
"Entendo, ${client.name.split(' ')[0]}. Deixa eu ver a melhor forma pra você — vou passar pro time comercial validar as condições e já te retorno por aqui, ok? 🤝" [needs_human=true]

═══ 📤 FORMATO DE SAÍDA (JSON puro, SEM markdown, SEM cercas de código) ═══
{
  "thought": "1)OBSERVAR: ... 2)CONTEXTO: ... 3)VALIDAÇÃO NUMÉRICA: cheguei R$ X copiando parcela #N do contrato #abc — bate com a lista ✓ 4)AÇÃO: playbook X 5)RESPOSTA: rascunho",
  "reply": "sua resposta final ao cliente em PT-BR (máx 5 linhas)",
  "is_receipt": boolean,
  "is_rollover": boolean,
  "is_promise": boolean,
  "promise_date": "YYYY-MM-DD ou null",
  "receipt_value": number,
  "receipt_date": "YYYY-MM-DD lido do comprovante, senão null",
  "needs_human": boolean,
  "intent": "saudacao|pagamento|comprovante|renovacao|promessa|reclamacao|duvida|negociacao|atualizacao_dados|outro",
  "summary": "resumo 1 linha do status",
  "memory_update": {
    "fatos": ["fatos consolidados, máx 12"],
    "preferencias": ["ex: prefere PIX de manhã"],
    "motivos_atraso": ["ex: desemprego desde MM/AAAA"],
    "contatos_alternativos": ["ex: esposa Maria 9999-9999"],
    "promessas": [{"data":"YYYY-MM-DD","valor":0,"contexto":"o que prometeu"}],
    "ultima_interacao": "${todayStr}"
  }
}`;

    const anthMessages = conversationHistory.map(m => ({ role: m.role, content: m.content }));
    if (messageType === "text") anthMessages.push({ role: "user", content: incomingText });
    else if (mediaData && mimeType) {
      const blocks: any[] = [{ type: "text", text: incomingText || `[Enviou ${messageType}]` }];
      if (messageType === "image") blocks.unshift({ type: "image", source: { type: "base64", media_type: mimeType, data: mediaData } });
      else if (mimeType === "application/pdf") blocks.unshift({ type: "document", source: { type: "base64", media_type: "application/pdf", data: mediaData } });
      anthMessages.push({ role: "user", content: blocks });
    }

    // Retry com backoff exponencial em 429/5xx/529 (Anthropic overloaded)
    let aiResp: Response | null = null;
    let aiErrBody = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        aiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 2200, temperature: 0.25, top_p: 0.85, system: systemPrompt, messages: anthMessages }),
        });
        if (aiResp.ok) break;
        aiErrBody = await aiResp.text();
        const retriable = aiResp.status === 429 || aiResp.status === 529 || aiResp.status >= 500;
        if (!retriable) throw new Error(`anthropic_${aiResp.status}: ${aiErrBody.slice(0,200)}`);
        console.warn(`[ai] tentativa ${attempt + 1} falhou (${aiResp.status}), retry em breve`);
        await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
      }
    }
    if (!aiResp || !aiResp.ok) {
      console.error("[ai] falhou após retries:", aiErrBody);
      await botSay("Desculpe, estou com uma instabilidade momentânea. Pode me mandar sua mensagem em alguns instantes? 🙏");
      return new Response(JSON.stringify({ status: "ai_unavailable" }), { headers: corsHeaders });
    }
    const aiData = await aiResp.json();
    const rawText = aiData?.content?.[0]?.text ?? "";
    let parsed = extractJsonObject(rawText);
    if (!parsed) {
      console.warn("[ai] resposta sem JSON válido, devolvendo fallback:", rawText.slice(0, 200));
      // Extrai texto legível como reply em vez de dump bruto
      const cleaned = rawText.replace(/```[a-z]*|```/gi, "").replace(/[{}\[\]"]/g, " ").trim();
      parsed = { reply: cleaned.slice(0, 400) || "Desculpe, tive um problema técnico. Pode repetir, por favor?" };
    }
    const result = sanitizeAiResult(parsed);

    // ─── Validação de PIX e valores antes de enviar ──────────────────────
    if (result.reply) {
      const v = validatePixReply({
        reply: result.reply,
        pixKey: profile?.pix_key,
        pixKeyType: profile?.pix_key_type,
        installments: (installments || []) as any,
        overdue: overdue as any,
        dueToday: dueToday as any,
        totalOverdue,
        totalDueToday,
        rolloverOptions: rolloverOptions as any,
      });
      if (v.fixed) {
        result.reply = v.reply;
        await supabase.from("audit_logs").insert({
          user_id: userId,
          entity_type: "whatsapp_bot",
          action: "pix_reply_corrected",
          entity_id: client.id,
          details: { reasons: v.reasons },
        });
        // Se detectou valor inventado ou chave PIX errada, notifica o operador
        // (o cliente já recebe a versão corrigida, mas o operador precisa saber)
        const critical = v.reasons.some(r => r.startsWith("invented_values") || r.startsWith("pix_key_mismatch"));
        if (critical) {
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "⚠️ IA quase enviou dado incorreto",
            message: `Cliente ${client.name}: bot corrigido automaticamente (${v.reasons.slice(0,2).join("; ")}). Revise a conversa.`,
            type: "warning",
          });
        }
      }
    }

    if (result.reply) await botSay(result.reply);

    // Merge inteligente da memória (validado + dedup + limite por seção, ver _shared/memory.ts)
    if (result.memory_update) {
      try {
        const merged = mergeMemory(memoryObj, result.memory_update, todayStr);
        const serialized = serializeMemory(merged);
        // Garantia final: só grava se for JSON parseável (nunca corrompe a coluna)
        JSON.parse(serialized);
        await supabase.from("clients").update({ bot_memory: serialized }).eq("id", client.id);
      } catch (e) {
        console.error("[memory] merge falhou, mantendo memória anterior:", e);
      }
    }

    await supabase.from("audit_logs").insert({ user_id: userId, entity_type: "whatsapp_bot", action: "replied", entity_id: client.id, details: { intent: result.intent, thought: result.thought, reply: result.reply } });

    // ─── Validação avançada de comprovante ─────────────────────────────────
    // Camadas: evidência mínima, sanidade do valor, competência da data, anti-reuso (hash), fraude textual.
    let mediaHash: string | null = null;
    const seenHashes = new Set<string>();
    if (mediaData) {
      try { mediaHash = await sha256Hex(mediaData); } catch (e) { console.warn("[hash] falhou:", e); }
      // Busca hashes já utilizados para este user (últimos 90 dias) → anti-reuso
      const { data: prevHashes } = await supabase
        .from("audit_logs")
        .select("details")
        .eq("user_id", userId)
        .eq("entity_type", "whatsapp_receipt")
        .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
        .limit(500);
      for (const row of (prevHashes || [])) {
        const h = (row as any)?.details?.hash;
        if (typeof h === "string") seenHashes.add(h);
      }
    }

    const receiptCheck = result.is_receipt ? validateReceipt({
      messageType,
      hasMedia: !!mediaData,
      incomingText,
      receiptValue: result.receipt_value,
      receiptDate: (result as any).receipt_date || null,
      installments: (installments || []) as any,
      todayStr,
      mediaHash,
      seenHashes,
    }) : null;

    const trustedReceipt = !!receiptCheck?.trusted;

    if (result.is_receipt && !trustedReceipt) {
      console.log("[receipt] rejeitado:", receiptCheck?.reasons.join(",") || "n/d", "risk=", receiptCheck?.riskScore);
      const reasonsTxt = receiptCheck?.reasons.join(", ") || "sem evidência";
      await supabase.from("notifications").insert({
        user_id: userId,
        title: receiptCheck?.duplicate ? "⚠️ Comprovante reutilizado" : "Possível pagamento — revisar",
        message: `Cliente ${client.name}: ${reasonsTxt} (risco ${receiptCheck?.riskScore || 0}/100). Confirme manualmente.`,
        type: receiptCheck?.duplicate ? "error" : "warning",
      });
      // Registra a tentativa (com hash, se houver) para auditoria/anti-replay
      await supabase.from("audit_logs").insert({
        user_id: userId, entity_type: "whatsapp_receipt", action: "rejected", entity_id: client.id,
        details: { hash: mediaHash, reasons: receiptCheck?.reasons, risk: receiptCheck?.riskScore, value: result.receipt_value },
      });
    }

    if (trustedReceipt && installments?.length) {
      const receiptValue = result.receipt_value;
      // Registra hash do comprovante aceito (anti-reuso futuro)
      if (mediaHash) {
        await supabase.from("audit_logs").insert({
          user_id: userId, entity_type: "whatsapp_receipt", action: "accepted", entity_id: client.id,
          details: { hash: mediaHash, value: receiptValue, match: receiptCheck?.matchType, installment_id: receiptCheck?.matchedInstallmentId },
        });
      }


      
      if (result.is_rollover) {
        // Lógica de Renovação (Pagar apenas Juros)
        const target = installments[0]; // Pega a mais antiga/atual
        const contract = activeContracts?.find(c => c.id === target.contract_id);
        
        let nextDate = new Date(target.due_date);
        const freq = contract?.frequency || 'daily';
        
        if (freq === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (freq === 'daily_mon-sat') {
          nextDate.setDate(nextDate.getDate() + 1);
          if (nextDate.getDay() === 0) nextDate.setDate(nextDate.getDate() + 1); // Pula domingo
        }
        else if (freq === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (freq === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
        else if (freq === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else nextDate.setDate(nextDate.getDate() + 1); // Default +1 day

        await supabase.from("contract_installments").update({ 
          due_date: nextDate.toISOString(),
          notes: `Renovação via juros: R$ ${receiptValue}. Próximo venc: ${nextDate.toLocaleDateString('pt-BR')}`
        }).eq("id", target.id);

        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Renovação de Contrato",
          message: `Cliente ${client.name} pagou juros de R$ ${receiptValue.toFixed(2)}. Dívida renovada para ${nextDate.toLocaleDateString('pt-BR')}.`,
          type: "info"
        });
        await logBotAction(supabase, { userId, clientId: client.id, conversationId: convoId, toolName: "renew_contract_interest_only", toolInput: { contract_id: target.contract_id, installment_id: target.id, valor: receiptValue, nova_data: nextDate.toISOString() } });
      } else {
        // Pagamento Normal (Amortização/Liquidação)
        let target = installments.find(i => Number(i.amount) === receiptValue);
        if (!target) target = installments[0];

        await supabase.from("contract_installments").update({ 
          status: "paid", 
          paid_at: new Date().toISOString(), 
          paid_amount: receiptValue || target.amount, 
          notes: `Confirmado via IA. Valor Rec: ${receiptValue}` 
        }).eq("id", target.id);
        
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Pagamento Recebido",
          message: `Cliente ${client.name} pagou R$ ${receiptValue.toFixed(2)}. Parcela #${target.installment_number} baixada.`,
          type: "success"
        });
        await logBotAction(supabase, { userId, clientId: client.id, conversationId: convoId, toolName: "mark_installment_paid", toolInput: { installment_id: target.id, valor: receiptValue, parcela: target.installment_number } });
      }

      // Se não houver mais parcelas atrasadas, volta o cliente para 'active'
      const { data: stillOverdue } = await supabase.from("contract_installments").select("id").eq("client_id", client.id).eq("status", "overdue");
      if (!stillOverdue?.length) {
        await supabase.from("clients").update({ status: 'active' }).eq("id", client.id);
      }
    }

    if (result.needs_human) {
      await escalateToHuman(supabase, convoId!, result.summary || "IA detectou necessidade de humano");
      await supabase.from("notifications").insert({ user_id: userId, title: "🚨 Intervenção Humana", message: `Cliente ${client.name} solicita atendimento humano ou negociação.`, type: "warning" });
      await logBotAction(supabase, { userId, clientId: client.id, conversationId: convoId, toolName: "escalate_to_human", toolInput: { reason: result.summary || "ai_detected" } });
    }

    if (result.is_promise && result.promise_date) {
      await supabase.from("audit_logs").insert({
        user_id: userId, entity_type: "whatsapp_bot", action: "promise_to_pay", entity_id: client.id,
        details: { promise_date: result.promise_date, message: incomingText }
      });
      // Adiciona uma nota na conversa
      await supabase.from("whatsapp_notes").insert({
        user_id: userId, client_id: client.id, content: `Promessa de pagamento para: ${result.promise_date}`, created_by: 'bot'
      });
      await logBotAction(supabase, { userId, clientId: client.id, conversationId: convoId, toolName: "register_payment_promise", toolInput: { data: result.promise_date, contexto: incomingText.slice(0,200) } });
    }

    // Aumento de Score por bom comportamento (pagou em dia ou renovou)
    if (result.is_receipt) {
      const currentScore = client.credit_score || 50;
      let newScore = currentScore;
      if (result.is_rollover) newScore = Math.min(100, currentScore + 2); // Renovação = +2
      else newScore = Math.min(100, currentScore + 5); // Pagamento = +5
      
      if (newScore !== currentScore) {
        await supabase.from("clients").update({ credit_score: newScore }).eq("id", client.id);
      }
    }

      return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
    } finally {
      jidLock.delete(senderJid);
    }

  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: corsHeaders });
  }
});
