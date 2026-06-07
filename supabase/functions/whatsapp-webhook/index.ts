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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { data: convoExisting } = await supabase.from("whatsapp_conversations").select("id, client_id, bot_paused, blocked").eq("user_id", userId).eq("phone", senderPhone).maybeSingle();
    if (convoExisting?.client_id) {
      const { data: c } = await supabase.from("clients").select("id, name, phone, whatsapp, cpf_cnpj, status").eq("id", convoExisting.client_id).maybeSingle();
      if (c) client = c;
    }
    if (!client) {
      const tail = senderPhone.slice(-9);
      const { data: clients } = await supabase.from("clients").select("id, name, phone, whatsapp, cpf_cnpj, status").eq("user_id", userId);
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

    // LOCK
    const lockHeld = jidLock.get(senderJid) || 0;
    if (lockHeld && Date.now() - lockHeld < LOCK_TTL_MS) return new Response(JSON.stringify({ status: "locked" }), { headers: corsHeaders });
    jidLock.set(senderJid, Date.now());

    // COMMANDS
    if (matchesAny(incomingText, STOP_WORDS)) {
      await supabase.from("audit_logs").insert({ user_id: userId, entity_type: "whatsapp_bot", action: "paused", entity_id: client.id, details: { reason: "client_stop" } });
      await botSay("🤖 Bot pausado. Um atendente humano falará com você em breve.");
      await supabase.from("whatsapp_conversations").update({ bot_paused: true }).eq("id", convoId);
      return new Response(JSON.stringify({ status: "stopped" }), { headers: corsHeaders });
    }
    if (matchesAny(incomingText, HUMAN_WORDS)) {
      await botSay("👤 Chamando um atendente humano...");
      await supabase.from("whatsapp_conversations").update({ bot_paused: true }).eq("id", convoId);
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

    // ENRICH DATA
    const { data: activeContracts } = await supabase.from("contracts").select("id, capital, total_amount, start_date, status, loan_mode, frequency, interest_rate").eq("client_id", client.id).eq("status", "active");
    const { data: installments } = await supabase.from("contract_installments").select("id, amount, due_date, status, late_fee, installment_number, contract_id").eq("client_id", client.id).in("status", ["pending", "overdue"]).order("due_date", { ascending: true });
    const { data: interactionLogs } = await supabase.from("audit_logs").select("action, created_at, details").eq("entity_id", client.id).eq("entity_type", "whatsapp_bot").order("created_at", { ascending: false }).limit(10);
    const { data: allPaid } = await supabase.from("contract_installments").select("id").eq("client_id", client.id).eq("status", "paid");
    const paidCount = allPaid?.length || 0;

    const now = new Date();
    const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3
    const todayStr = brDate.toISOString().split('T')[0];

    const overdue = (installments || []).filter(i => {
      const dueDate = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return dueDate < todayStr;
    });
    const dueToday = (installments || []).filter(i => {
      const dueDate = typeof i.due_date === 'string' ? i.due_date.split('T')[0] : i.due_date;
      return dueDate === todayStr;
    });
    
    const totalOverdue = overdue.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
    const totalDueToday = dueToday.reduce((s, i) => s + Number(i.amount), 0);

    // Calculate rollover/interest only options
    const rolloverOptions = (activeContracts || []).map(c => {
      const inst = installments?.find(i => i.contract_id === c.id);
      if (!inst) return null;
      const interestOnly = Number(inst.amount) - Number(c.capital);
      return {
        contractId: c.id,
        interestOnly: interestOnly > 0 ? interestOnly : (Number(c.capital) * (Number(c.interest_rate) / 100)),
        totalAmount: Number(inst.amount),
        frequency: c.frequency
      };
    }).filter(Boolean);

    const conversationHistory: any[] = [];
    if (convoId) {
      const { data: msgHistory } = await supabase.from("whatsapp_messages").select("direction, content, message_type, metadata").eq("conversation_id", convoId).order("created_at", { ascending: false }).limit(20);
      (msgHistory || []).reverse().forEach(h => {
        const txt = h.content || h.metadata?.transcript || `[${h.message_type}]`;
        conversationHistory.push({ role: h.direction === "in" ? "user" : "assistant", content: txt });
      });
    }

    const systemPrompt = `Você é o Atendente Virtual de Cobrança Inteligente e Empático da "${settings.company_name || 'nossa empresa'}". Seu objetivo é RECUPERAR VALORES HOJE de forma estratégica.

  ═══ PERFIL DO CLIENTE ═══
Nome: ${client.name}
Status: ${client.status || 'Ativo'}
Score de Crédito: ${client.credit_score || 50}/100
Parcelas Pagas no Histórico: ${paidCount}
Contratos Ativos: ${activeContracts?.length || 0}
${activeContracts?.map(c => `- R$ ${Number(c.capital).toFixed(2)} (${c.loan_mode || 'Normal'}, ${c.frequency})`).join('\n')}

═══ SITUAÇÃO FINANCEIRA (ATUALIZADO) ═══
📅 VENCE HOJE: R$ ${totalDueToday.toFixed(2)} (${dueToday.length} parcelas)
⚠️ EM ATRASO: R$ ${totalOverdue.toFixed(2)} (${overdue.length} parcelas)
💰 TOTAL PARA QUITAR PENDÊNCIAS: R$ ${(totalDueToday + totalOverdue).toFixed(2)}
⚖️ COMPORTAMENTO: ${client.credit_score > 80 ? 'Excelente pagador. Seja flexível.' : client.credit_score < 40 ? 'Risco alto. Seja firme e direto.' : 'Padrão.'}


DETALHAMENTO:
${dueToday.map(i => `- Parcela #${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} (VENCE HOJE)`).join('\n')}
${overdue.map(i => `- Parcela #${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} (VENCIDA DESDE ${i.due_date})`).join('\n')}

═══ OPÇÕES DE RENOVAÇÃO (PAGAR SÓ JUROS) ═══
Se o cliente não puder pagar o valor total, ofereça a RENOVAÇÃO (Rollover):
${rolloverOptions.map(o => `- Pagar APENAS OS JUROS de R$ ${o.interestOnly.toFixed(2)}. O valor principal continua para a próxima data (${o.frequency}).`).join('\n')}

═══ ESTRATÉGIA DE ATENDIMENTO ═══
1. TOM DE VOZ: Profissional, prestativo e persuasivo. Use emojis moderadamente.
2. ABORDAGEM: Se houver atrasos, foque na regularização. Se o cliente for "Bom Pagador" (Score > 70), agradeça a parceria.
3. FLEXIBILIDADE: Se o cliente disser que está difícil, apresente a opção de "Pagar só os Juros" (Renovação).
4. COMPROVANTES: Sempre peça o comprovante. Se receber um, valide o valor.
5. FIDELIZAÇÃO: Se o cliente estiver quitando o último contrato e tiver score bom, sugira que ele pode solicitar um novo limite maior em breve.
6. PROMESSAS: Se o cliente prometer pagar em uma data específica, identifique isso.

Data Atual: ${brDate.toLocaleDateString('pt-BR')}
CHAVE PIX: ${profile?.pix_key || "Solicitar ao gerente"} (${profile?.pix_key_type || "PIX"})

Responda em JSON puro:
{
  "thought": "análise lógica da conversa e próxima ação",
  "reply": "sua resposta ao cliente (em português)",
  "is_receipt": boolean (se o cliente enviou comprovante ou confirmou pagamento),
  "is_rollover": boolean (se o pagamento é APENAS de juros para renovação),
  "is_promise": boolean (se o cliente prometeu pagar em uma data futura),
  "promise_date": "YYYY-MM-DD" (data da promessa, se houver),
  "receipt_value": number (valor identificado),
  "needs_human": boolean (se o cliente pediu atendente),
  "intent": "saudacao|pagamento|comprovante|renovacao|promessa|reclamacao|duvida",
  "summary": "resumo do status"
}
  "is_rollover": boolean (se o pagamento é APENAS de juros para renovação),
  "receipt_value": number (valor identificado no comprovante ou mensagem),
  "needs_human": boolean (se o cliente pediu atendente ou o caso é complexo),
  "intent": "saudacao|pagamento|comprovante|renovacao|reclamacao|duvida",
  "summary": "resumo do status do atendimento"
}`;

    const anthMessages = conversationHistory.map(m => ({ role: m.role, content: m.content }));
    if (messageType === "text") anthMessages.push({ role: "user", content: incomingText });
    else if (mediaData && mimeType) {
      const blocks: any[] = [{ type: "text", text: incomingText || `[Enviou ${messageType}]` }];
      if (messageType === "image") blocks.unshift({ type: "image", source: { type: "base64", media_type: mimeType, data: mediaData } });
      else if (mimeType === "application/pdf") blocks.unshift({ type: "document", source: { type: "base64", media_type: "application/pdf", data: mediaData } });
      anthMessages.push({ role: "user", content: blocks });
    }

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-3-7-sonnet-20250219", max_tokens: 1000, temperature: 0.5, system: systemPrompt, messages: anthMessages }),
    });

    if (!aiResp.ok) throw new Error(await aiResp.text());
    const aiData = await aiResp.json();
    const result = JSON.parse(aiData.content[0].text.match(/\{[\s\S]*\}/)[0]);

    if (result.reply) await botSay(result.reply);
    
    await supabase.from("audit_logs").insert({ user_id: userId, entity_type: "whatsapp_bot", action: "replied", entity_id: client.id, details: { intent: result.intent, thought: result.thought, reply: result.reply } });

    if (result.is_receipt && installments?.length) {
      const receiptValue = Number(result.receipt_value);
      
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
      }
    }

    if (result.needs_human) {
      await supabase.from("whatsapp_conversations").update({ bot_paused: true }).eq("id", convoId);
      await supabase.from("notifications").insert({ user_id: userId, title: "Intervenção Humana", message: `Cliente ${client.name} solicita atendimento humano ou negociação.`, type: "warning" });
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

    jidLock.delete(senderJid);
    return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });

  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
