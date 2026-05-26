import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const RATE_MAX = 6;

// Buffer de mensagens (debounce) — agrupa mensagens consecutivas do mesmo contato
const messageBuffer = new Map<string, { texts: string[]; lastTs: number }>();
const BUFFER_WAIT_MS = 4500;

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

const STOP_WORDS = ["parar bot", "pare bot", "cancelar bot", "desativar bot", "silenciar bot", "stop bot"];
const HUMAN_WORDS = ["atendente", "humano", "pessoa de verdade", "falar com alguem", "falar com alguém", "operador", "gerente", "responsavel", "responsável"];
const PIX_WORDS = ["qual o pix", "qual a chave pix", "me passa o pix", "manda o pix", "envia o pix", "me manda a chave pix"];

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
  // Quebra textos longos em parágrafos (mais natural)
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

// === Inbox helpers ===
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const payload = await req.json();
    console.log("Webhook event:", payload?.event, "instance:", payload?.instance);

    if (payload.event !== "messages.upsert" && payload.event !== "MESSAGES_UPSERT") {
      return new Response(JSON.stringify({ status: "ignored_event" }), { headers: corsHeaders });
    }

    const data = payload.data;
    const key = data?.key ?? data?.message?.key;
    const msgContent = data?.message?.message ?? data?.message;
    if (!key || key.fromMe) {
      return new Response(JSON.stringify({ status: "ignored_self_or_empty" }), { headers: corsHeaders });
    }

    // Dedupe
    const msgId = key.id;
    if (msgId && processedMessages.has(msgId)) {
      return new Response(JSON.stringify({ status: "duplicate" }), { headers: corsHeaders });
    }
    if (msgId) rememberMessage(msgId);

    const senderJid = key.remoteJid;
    if (!senderJid) {
      return new Response(JSON.stringify({ status: "no_jid" }), { headers: corsHeaders });
    }
    if (senderJid.includes("@g.us") || senderJid.includes("@broadcast") || senderJid.includes("status@") || senderJid.includes("@newsletter")) {
      return new Response(JSON.stringify({ status: "ignored_group_or_broadcast" }), { headers: corsHeaders });
    }
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");
    const instanceName = payload.instance;

    // Tipo de mensagem
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

    const message = { key, message: msgContent };

    const { data: settings } = await supabase
      .from("settings")
      .select("*")
      .eq("whatsapp_instance", instanceName)
      .single();

    if (!settings || !settings.bot_enabled) {
      return new Response(JSON.stringify({ status: "bot_disabled" }), { headers: corsHeaders });
    }

    const apiUrl = (settings.whatsapp_api_url || "").replace(/\/$/, "");
    const apiKey = settings.whatsapp_api_key;

    // Marcar como lido imediatamente
    if (apiUrl && apiKey) {
      markAsRead(apiUrl, apiKey, instanceName, key).catch(() => {});
    }

    if (messageType === "audio" && !settings.bot_process_audio) {
      return new Response(JSON.stringify({ status: "audio_processing_disabled" }), { headers: corsHeaders });
    }
    if (messageType === "image" && !settings.bot_process_receipts) {
      return new Response(JSON.stringify({ status: "receipt_processing_disabled" }), { headers: corsHeaders });
    }

    const userId = settings.user_id;

    // Busca cliente
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, phone, whatsapp, cpf_cnpj, status")
      .eq("user_id", userId);

    const client = clients?.find(c => {
      const cPhone = (c.whatsapp || c.phone || "").replace(/\D/g, "");
      if (!cPhone) return false;
      return cPhone.endsWith(senderPhone.slice(-8)) || senderPhone.endsWith(cPhone.slice(-8));
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, pix_key, pix_key_type")
      .eq("id", userId)
      .single();

    // === INBOX: upsert conversation + log incoming ===
    const pushName = data?.pushName || data?.message?.pushName || null;
    const incomingPreview = incomingText || `[${messageType}]`;
    const convoId = await upsertConversation(supabase, {
      userId, phone: senderPhone, jid: senderJid, instance: instanceName,
      clientId: client?.id ?? null,
      contactName: client?.name || pushName,
      preview: incomingPreview, from: "client", incrementUnread: true,
    });
    if (convoId) {
      await logMessage(supabase, {
        conversationId: convoId, userId, direction: "in", sender: "client",
        messageType, content: incomingText || "", waMessageId: msgId,
        metadata: { jid: senderJid, mime: mimeType },
      });
    }

    // Conversation-level pause/block (set manually pelo operador)
    let conversationPaused = false;
    let conversationBlocked = false;
    if (convoId) {
      const { data: convoRow } = await supabase
        .from("whatsapp_conversations").select("bot_paused, blocked").eq("id", convoId).single();
      conversationPaused = !!convoRow?.bot_paused;
      conversationBlocked = !!convoRow?.blocked;
    }

    // BLACKLIST — não responde nada, mas mantém log da msg recebida
    if (conversationBlocked) {
      return new Response(JSON.stringify({ status: "conversation_blocked" }), { headers: corsHeaders });
    }

    // Helper para o bot responder + persistir
    const botSay = async (text: string) => {
      if (!text || !apiUrl || !apiKey) return;
      await sendText(apiUrl, apiKey, instanceName, senderJid, text);
      if (convoId) {
        await logMessage(supabase, {
          conversationId: convoId, userId, direction: "out", sender: "bot",
          messageType: "text", content: text,
        });
        await supabase.from("whatsapp_conversations").update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 200),
          last_message_from: "bot",
          followup_sent_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", convoId);
      }
    };

    if (conversationPaused) {
      return new Response(JSON.stringify({ status: "conversation_paused" }), { headers: corsHeaders });
    }

    // Presence "digitando"
    if (apiUrl && apiKey) {
      sendPresence(apiUrl, apiKey, instanceName, senderJid, "composing").catch(() => {});
    }


    // === CLIENTE NÃO ENCONTRADO: tratar como lead ===
    if (!client) {
      // Cooldown: evitar spammar lead a cada msg
      const { data: recentLead } = await supabase
        .from("audit_logs")
        .select("created_at")
        .eq("user_id", userId)
        .eq("entity_type", "whatsapp_lead")
        .eq("action", "lead_message")
        .ilike("details->>phone", senderPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const recentLeadTime = recentLead ? new Date(recentLead.created_at).getTime() : 0;
      const shouldReply = Date.now() - recentLeadTime > 60 * 60 * 1000; // 1h cooldown

      if (shouldReply && apiUrl && apiKey) {
        const greeting = pickGreeting(settings.company_name || profile?.name || "nossa empresa");
        await botSay(greeting);

        // Notifica o dono
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Novo contato no WhatsApp",
          message: `Número ${senderPhone} entrou em contato e não está cadastrado. Mensagem: "${incomingText?.slice(0, 100) || `[${messageType}]`}"`,
          type: "info",
        });
      }

      await supabase.from("audit_logs").insert({
        user_id: userId,
        entity_type: "whatsapp_lead",
        action: "lead_message",
        details: { phone: senderPhone, message: incomingText, message_type: messageType, replied: shouldReply },
      });

      return new Response(JSON.stringify({ status: "lead_handled" }), { headers: corsHeaders });
    }

    // Cliente pausado individualmente?
    const { data: pauseFlag } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("entity_type", "whatsapp_bot")
      .eq("entity_id", client.id)
      .eq("action", "paused")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pauseFlag) {
      // Bot está pausado para esse cliente — apenas registra
      await supabase.from("audit_logs").insert({
        user_id: userId,
        entity_type: "whatsapp_bot",
        action: "message_while_paused",
        entity_id: client.id,
        details: { client_message: incomingText || `[${messageType}]` },
      });
      return new Response(JSON.stringify({ status: "client_paused" }), { headers: corsHeaders });
    }

    // === Rate limit por contato (anti-loop) ===
    if (isRateLimited(senderJid)) {
      console.log("rate limited:", senderJid);
      return new Response(JSON.stringify({ status: "rate_limited" }), { headers: corsHeaders });
    }

    // === Anti-eco: ignora se cliente repetiu (copiou) exatamente a última resposta do bot ===
    if (messageType === "text" && incomingText) {
      const last = lastBotReply.get(senderJid);
      if (last && Date.now() - last.ts < 5 * 60 * 1000 && norm(last.text).includes(norm(incomingText)) && incomingText.length > 20) {
        console.log("ignored echo from", senderJid);
        return new Response(JSON.stringify({ status: "ignored_echo" }), { headers: corsHeaders });
      }
    }

    // === Truncamento: clientes que mandam paredes de texto ===
    if (incomingText && incomingText.length > 1500) {
      incomingText = incomingText.slice(0, 1500) + " …[mensagem truncada]";
    }

    // === Debounce: agrupa mensagens consecutivas de texto em ~4.5s ===
    if (messageType === "text" && incomingText) {
      const buf = messageBuffer.get(senderJid) || { texts: [], lastTs: 0 };
      buf.texts.push(incomingText);
      buf.lastTs = Date.now();
      messageBuffer.set(senderJid, buf);
      const myTs = buf.lastTs;
      await new Promise(r => setTimeout(r, BUFFER_WAIT_MS));
      const current = messageBuffer.get(senderJid);
      if (!current || current.lastTs > myTs) {
        // chegou mensagem mais nova — essa requisição abdica
        return new Response(JSON.stringify({ status: "debounced" }), { headers: corsHeaders });
      }
      incomingText = current.texts.join("\n").slice(0, 2000);
      messageBuffer.delete(senderJid);
    }


    // === Comando do cliente: PARAR BOT ===
    if (matchesAny(incomingText, STOP_WORDS)) {
      await supabase.from("audit_logs").insert({
        user_id: userId, entity_type: "whatsapp_bot", action: "paused",
        entity_id: client.id, details: { reason: "client_request", message: incomingText },
      });
      if (apiUrl && apiKey) {
        await botSay("Tudo bem! 🤖 Vou parar de responder por aqui. Um atendente humano vai te chamar em breve. 🙏");
      }
      await supabase.from("notifications").insert({
        user_id: userId, title: "Bot pausado pelo cliente",
        message: `${client.name} pediu para parar o bot.`, type: "warning",
      });
      return new Response(JSON.stringify({ status: "paused_by_client" }), { headers: corsHeaders });
    }

    // === Cliente pediu humano explicitamente ===
    if (matchesAny(incomingText, HUMAN_WORDS)) {
      if (apiUrl && apiKey) {
        await botSay(`Claro, ${(client.name || "").split(" ")[0]}! 👤\n\nJá estou avisando um atendente. Você será respondido em instantes. 🙏`);
      }
      await supabase.from("notifications").insert({
        user_id: userId, title: "🆘 Cliente pediu atendente humano",
        message: `${client.name} pediu para falar com humano. Mensagem: "${incomingText?.slice(0,120)}"`, type: "warning",
      });
      await supabase.from("audit_logs").insert({
        user_id: userId, entity_type: "whatsapp_bot", action: "human_requested",
        entity_id: client.id, details: { client_message: incomingText },
      });
      return new Response(JSON.stringify({ status: "human_requested" }), { headers: corsHeaders });
    }

    // === Atalho: cliente pediu PIX direto ===
    if (matchesAny(incomingText, PIX_WORDS) && profile?.pix_key) {
      const txt = `Claro! Segue a chave PIX:\n\n*${profile.pix_key}*\n(${profile.pix_key_type || "PIX"})\n\nApós o pagamento, é só me enviar o comprovante por aqui que eu confirmo. ✅`;
      if (apiUrl && apiKey) await botSay(txt);
      await supabase.from("audit_logs").insert({
        user_id: userId, entity_type: "whatsapp_bot", action: "replied",
        entity_id: client.id, details: { intent: "pagamento", client_message: incomingText, ai_reply: txt, shortcut: "pix" },
      });
      return new Response(JSON.stringify({ status: "pix_shortcut" }), { headers: corsHeaders });
    }

    // === Fora do horário de atendimento ===
    if (!isWithinBusinessHours(settings)) {
      const start = settings.bot_business_start || "08:00";
      const end = settings.bot_business_end || "18:00";
      if (apiUrl && apiKey) {
        await botSay(`Olá, ${(client.name || "").split(" ")[0]}! 👋\n\nRecebi sua mensagem fora do nosso horário de atendimento (${start} às ${end}).\n\nRetornarei assim que possível. 🙏`);
      }
      await supabase.from("audit_logs").insert({
        user_id: userId, entity_type: "whatsapp_bot", action: "off_hours",
        entity_id: client.id, details: { client_message: incomingText },
      });
      return new Response(JSON.stringify({ status: "off_hours" }), { headers: corsHeaders });
    }


    // Download de mídia
    if (messageType !== "text" && apiUrl && apiKey) {
      try {
        const response = await fetch(`${apiUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ message: message, convertToMp4: false }),
        });
        if (response.ok) {
          const mediaResponse = await response.json();
          mediaData = mediaResponse.base64;
        } else {
          // Fallback rota antiga
          const fallback = await fetch(`${apiUrl}/message/getBase64FromMediaMessage/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ message }),
          });
          if (fallback.ok) {
            const j = await fallback.json();
            mediaData = j.base64;
          }
        }
      } catch (e) {
        console.error("Error downloading media:", e);
      }
    }

    // Contexto financeiro completo
    const { data: installments } = await supabase
      .from("contract_installments")
      .select("id, amount, due_date, status, late_fee, installment_number, contract_id")
      .eq("client_id", client.id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueList = (installments || []).filter(i => new Date(i.due_date) < today);
    const dueTodayList = (installments || []).filter(i => {
      const d = new Date(i.due_date);
      return d.toDateString() === today.toDateString();
    });
    const upcomingList = (installments || []).filter(i => new Date(i.due_date) > today);

    const totalOverdue = overdueList.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
    const totalPending = (installments || []).reduce((s, i) => s + Number(i.amount), 0);

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500, headers: corsHeaders });
    }

    // Histórico conversacional persistente (lê do banco — sobrevive a restart)
    const conversationHistory: any[] = [];
    if (convoId) {
      const { data: msgHistory } = await supabase
        .from("whatsapp_messages")
        .select("direction, content, message_type, metadata, created_at")
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: false })
        .limit(20);
      (msgHistory || []).reverse().forEach((h: any) => {
        const txt = h.content || h.metadata?.transcript || "";
        if (!txt) return;
        if (h.direction === "in") {
          conversationHistory.push({ role: "user", content: String(txt).slice(0, 600) });
        } else {
          conversationHistory.push({ role: "assistant", content: String(txt).slice(0, 800) });
        }
      });
      // remove a última msg "user" porque é a atual (será adicionada abaixo)
      if (conversationHistory.length && conversationHistory[conversationHistory.length - 1].role === "user") {
        conversationHistory.pop();
      }
    }

    const fmtList = (arr: any[], max = 5) => arr.slice(0, max).map(i =>
      `  • Parc. ${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} - Venc: ${new Date(i.due_date).toLocaleDateString('pt-BR')}${Number(i.late_fee) > 0 ? ` (+ multa R$ ${Number(i.late_fee).toFixed(2)})` : ""}`
    ).join("\n");

    const firstName = (client.name || "").split(" ")[0];

    const systemPrompt = `Você é o atendente virtual oficial da empresa "${settings.company_name || profile?.name || 'nossa empresa'}".
Tom: ${settings.bot_tone || 'profissional, empático, próximo e cordial — como um bom atendente humano'}.
Data de hoje: ${today.toLocaleDateString('pt-BR')}.

═══ DADOS DO CLIENTE ═══
Nome: ${client.name} (use "${firstName}" no tratamento)
Status: ${client.status || 'ativo'}
Total em ATRASO: R$ ${totalOverdue.toFixed(2)} (${overdueList.length} parcela(s))
Total pendente: R$ ${totalPending.toFixed(2)} (${installments?.length || 0} parcela(s))
Vence HOJE: ${dueTodayList.length} parcela(s)

${overdueList.length ? `🔴 PARCELAS ATRASADAS:\n${fmtList(overdueList)}\n` : ''}${dueTodayList.length ? `🟡 VENCE HOJE:\n${fmtList(dueTodayList)}\n` : ''}${upcomingList.length ? `🟢 PRÓXIMAS:\n${fmtList(upcomingList, 3)}\n` : ''}
Chave PIX (${profile?.pix_key_type || 'PIX'}): ${profile?.pix_key || "(solicitar à equipe)"}

═══ HABILIDADES ═══
1. Atende dúvidas sobre parcelas, valores, vencimentos, formas de pagamento.
2. Cobrança empática (sem agressividade): lembra de pendências, oferece o PIX.
3. Pode negociar: descontos parciais de multa/juros para pagamento HOJE; quitação à vista; reagendamento de 1 parcela. Decisões maiores → marcar needs_human=true.
4. Comprovantes (imagem/PDF): analise, identifique valor e marque is_receipt=true se for válido.
5. Áudio: escute e responda naturalmente.
6. Saudações simples → responda curto e pergunte como pode ajudar.
7. Se cliente já está em dia: agradeça e seja cordial; não invente cobrança.

═══ REGRAS DE OURO ═══
- Português brasileiro, NATURAL, jamais robótico. Evite frases como "Estou aqui para ajudar com sua demanda".
- Mensagens curtas (3-5 linhas). Pode usar 2 parágrafos separados por linha em branco — eles serão enviados como mensagens separadas.
- Emojis com moderação (😊 👍 ✅ 🙏). Nunca exagere.
- NUNCA invente valores, datas, descontos ou políticas que não estejam acima.
- Se cliente pedir 2ª via, boleto físico, mudança contratual, ou reclamar de erro: needs_human=true.
- Se cliente ficar agressivo ou ofensivo: responda com calma 1x e marque needs_human=true.
- Use o histórico para NÃO se repetir. Se já cumprimentou, não cumprimente de novo.
- Se não houver dívida em atraso, NÃO cobre — apenas responda o que foi perguntado.

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO, sem markdown):
{
  "reply": "texto natural para o cliente (use \\n\\n para dividir em msgs)",
  "is_receipt": boolean,
  "receipt_value": number | null,
  "needs_human": boolean,
  "intent": "saudacao|duvida|pagamento|comprovante|negociacao|reclamacao|outro",
  "summary": "1 linha resumindo a interação",
  "transcript": "se cliente mandou áudio, transcreva aqui o que ele disse (texto puro); caso contrário deixe vazio"
}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ];

    if (messageType === "text") {
      messages.push({ role: "user", content: incomingText || "(mensagem vazia)" });
    } else if (mediaData && mimeType) {
      if (messageType === "audio") {
        // Gemini aceita áudio via input_audio (formato OpenAI-compat)
        const format = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp3") || mimeType.includes("mpeg") ? "mp3" : mimeType.includes("wav") ? "wav" : "ogg";
        messages.push({
          role: "user",
          content: [
            { type: "text", text: "[O cliente enviou um áudio. Escute, entenda o que ele quer e responda naturalmente em texto.]" },
            { type: "input_audio", input_audio: { data: mediaData, format } },
          ],
        });
      } else {
        const label = messageType === "image"
          ? "[Imagem enviada — verifique se é comprovante de pagamento. Se for, extraia o valor.]"
          : "[Documento enviado — analise o conteúdo. Se for comprovante, extraia o valor.]";
        messages.push({
          role: "user",
          content: [
            { type: "text", text: incomingText || label },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${mediaData}` } },
          ],
        });
      }
    } else {
      messages.push({ role: "user", content: `[Cliente enviou ${messageType} mas não foi possível baixar o conteúdo. Peça gentilmente para reenviar.]` });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errTxt = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errTxt);
      if (apiUrl && apiKey) {
        await botSay("Desculpe, estou com uma instabilidade no momento. Em instantes alguém da equipe vai te responder. 🙏");
      }
      throw new Error("AI Gateway error: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    let result: any;
    try {
      result = JSON.parse(aiData.choices[0].message.content);
    } catch {
      result = { reply: aiData.choices[0].message.content, is_receipt: false, needs_human: false, intent: "outro", summary: "" };
    }

    // Salva transcrição do áudio na mensagem original (pra exibir no inbox)
    if (messageType === "audio" && result.transcript && convoId && msgId) {
      await supabase.from("whatsapp_messages")
        .update({
          content: `🎙️ ${result.transcript}`,
          metadata: { jid: senderJid, mime: mimeType, transcript: result.transcript },
        })
        .eq("conversation_id", convoId)
        .eq("wa_message_id", msgId);
    }

    // Envia resposta
    if (result.reply && apiUrl && apiKey) {
      await botSay(result.reply);
      lastBotReply.set(senderJid, { text: result.reply, ts: Date.now() });
      sendPresence(apiUrl, apiKey, instanceName, senderJid, "paused").catch(() => {});
    }

    // Comprovante: tenta casar com a parcela de valor mais próximo
    if (result.is_receipt && settings.bot_auto_confirm_payment && installments && installments.length > 0) {
      const value = Number(result.receipt_value) || 0;
      const ordered = [...overdueList, ...dueTodayList, ...upcomingList];
      let matched = ordered[0] || installments[0];
      if (value > 0) {
        let bestDiff = Infinity;
        for (const inst of ordered) {
          const total = Number(inst.amount) + (Number(inst.late_fee) || 0);
          const diff = Math.abs(total - value);
          if (diff < bestDiff - 1) { bestDiff = diff; matched = inst; }
        }
      }

      await supabase.from("contract_installments").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_amount: value || matched.amount,
        payment_method: "pix",
        notes: `Confirmado automaticamente via Bot IA (comprovante WhatsApp).`,
      }).eq("id", matched.id);

      if (settings.bot_notify_owner) {
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "✅ Pagamento confirmado via IA",
          message: `Bot identificou comprovante de R$ ${(value || matched.amount).toFixed(2)} de ${client.name} (parc. ${matched.installment_number}).`,
          type: "payment",
        });
      }
    }

    // Escalação para humano — marca conversa + notifica
    if (result.needs_human) {
      if (convoId) {
        await supabase.from("whatsapp_conversations").update({
          needs_human: true,
          last_human_handoff_at: new Date().toISOString(),
        }).eq("id", convoId);
      }
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "🆘 Atendimento humano solicitado",
        message: `${client.name} precisa de atendimento humano. Resumo: ${result.summary || incomingText?.slice(0, 100)}`,
        type: "warning",
      });
    }

    // Log
    await supabase.from("audit_logs").insert({
      user_id: userId,
      entity_type: "whatsapp_bot",
      action: result.is_receipt ? "receipt_detected" : "replied",
      entity_id: client.id,
      details: {
        message_type: messageType,
        client_message: incomingText || `[${messageType}]`,
        intent: result.intent,
        summary: result.summary,
        is_receipt: !!result.is_receipt,
        receipt_value: result.receipt_value,
        needs_human: !!result.needs_human,
        ai_reply: result.reply,
      },
    });

    return new Response(JSON.stringify({ status: "success", result }), { headers: corsHeaders });

  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
