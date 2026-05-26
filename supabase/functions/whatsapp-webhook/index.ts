import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    console.log("Webhook payload received:", JSON.stringify(payload));

    if (payload.event !== "messages.upsert" && payload.event !== "MESSAGES_UPSERT") {
      return new Response(JSON.stringify({ status: "ignored_event" }), { headers: corsHeaders });
    }

    const data = payload.data;
    // Evolution v2 payload: data.key + data.message at the same level.
    // Legacy: data.message.key + data.message.message
    const key = data?.key ?? data?.message?.key;
    const msgContent = data?.message?.message ?? data?.message;
    if (!key || key.fromMe) {
      return new Response(JSON.stringify({ status: "ignored_self_or_empty" }), { headers: corsHeaders });
    }

    const senderJid = key.remoteJid;
    if (!senderJid) {
      return new Response(JSON.stringify({ status: "no_jid" }), { headers: corsHeaders });
    }
    // Ignore groups, broadcasts, status, newsletters
    if (senderJid.includes("@g.us") || senderJid.includes("@broadcast") || senderJid.includes("status@") || senderJid.includes("@newsletter")) {
      return new Response(JSON.stringify({ status: "ignored_group_or_broadcast" }), { headers: corsHeaders });
    }
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");
    const instanceName = payload.instance;

    // Detect message type and content
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
    }

    // Rebuild a "message" object for media download API compatibility
    const message = { key, message: msgContent };

    // Find settings
    const { data: settings } = await supabase
      .from("settings")
      .select("*")
      .eq("whatsapp_instance", instanceName)
      .single();

    if (!settings || !settings.bot_enabled) {
      return new Response(JSON.stringify({ status: "bot_disabled" }), { headers: corsHeaders });
    }

    // Check if we should process this type
    if (messageType === "audio" && !settings.bot_process_audio) {
      return new Response(JSON.stringify({ status: "audio_processing_disabled" }), { headers: corsHeaders });
    }
    if (messageType === "image" && !settings.bot_process_receipts) {
      return new Response(JSON.stringify({ status: "receipt_processing_disabled" }), { headers: corsHeaders });
    }

    const userId = settings.user_id;

    // Find client
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, phone, whatsapp")
      .eq("user_id", userId);

    const client = clients?.find(c => {
      const cPhone = (c.whatsapp || c.phone || "").replace(/\D/g, "");
      return cPhone.endsWith(senderPhone.slice(-8));
    });

    if (!client) {
      return new Response(JSON.stringify({ status: "client_not_found" }), { headers: corsHeaders });
    }

    // If it's media, we need to download it from Evolution API
    if (messageType !== "text" && settings.whatsapp_api_url && settings.whatsapp_api_key) {
      try {
        const apiUrl = settings.whatsapp_api_url.replace(/\/$/, "");
        const response = await fetch(`${apiUrl}/message/getBase64FromMediaMessage/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: settings.whatsapp_api_key },
          body: JSON.stringify({ message: message }),
        });
        if (response.ok) {
          const mediaResponse = await response.json();
          mediaData = mediaResponse.base64;
        }
      } catch (e) {
        console.error("Error downloading media:", e);
      }
    }

    // Get context
    const { data: installments } = await supabase
      .from("contract_installments")
      .select("id, amount, due_date, status, late_fee, installment_number")
      .eq("client_id", client.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    const totalOverdue = installments?.filter(i => new Date(i.due_date) < new Date()).reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0) || 0;
    const { data: profile } = await supabase.from("profiles").select("name, pix_key").eq("id", userId).single();

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500, headers: corsHeaders });
    }

    // Conversation memory: last 10 interactions with this client
    const { data: history } = await supabase
      .from("audit_logs")
      .select("details, created_at")
      .eq("user_id", userId)
      .eq("entity_type", "whatsapp_bot")
      .eq("entity_id", client.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const conversationHistory: any[] = [];
    (history || []).reverse().forEach((h: any) => {
      const d = h.details || {};
      if (d.client_message) {
        conversationHistory.push({ role: "user", content: String(d.client_message).slice(0, 500) });
      }
      if (d.ai_reply) {
        conversationHistory.push({ role: "assistant", content: String(d.ai_reply).slice(0, 800) });
      }
    });

    const installmentsList = (installments || []).slice(0, 5).map(i => {
      const overdue = new Date(i.due_date) < new Date() ? " [ATRASADA]" : "";
      return `  - Parcela ${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} - Venc: ${new Date(i.due_date).toLocaleDateString('pt-BR')}${overdue}`;
    }).join("\n");

    const today = new Date().toLocaleDateString('pt-BR');

    const systemPrompt = `Você é o atendente virtual oficial da empresa "${settings.company_name || profile?.name || 'nossa empresa'}".
Tom de voz: ${settings.bot_tone || 'profissional, empático e cordial'}.
Data de hoje: ${today}.

═══ DADOS DO CLIENTE ═══
Nome: ${client.name}
Total em atraso: R$ ${totalOverdue.toFixed(2)}
Parcelas pendentes: ${installments?.length || 0}
${installmentsList ? `Próximas parcelas:\n${installmentsList}` : 'Nenhuma parcela pendente.'}
Chave PIX para pagamento: ${profile?.pix_key || "Solicitar ao atendimento humano"}

═══ SUAS HABILIDADES ═══
1. ATENDIMENTO INTELIGENTE: Converse naturalmente, responda dúvidas sobre o contrato, parcelas, valores, datas e formas de pagamento. Use o histórico para manter contexto.
2. COBRANÇA EMPÁTICA: Lembre o cliente de parcelas pendentes SEM ser agressivo. Mostre que está ali para ajudar.
3. NEGOCIAÇÃO: Pode oferecer condições especiais para pagamento HOJE (ex: isenção parcial de multa/juros). Use bom senso.
4. COMPROVANTE (imagem): Se for comprovante PIX/transferência, confirme com entusiasmo, identifique o valor e marque is_receipt=true.
5. ÁUDIO: Escute o áudio, entenda o que o cliente disse e responda naturalmente.
6. ESCALAÇÃO: Se o cliente pedir falar com humano, reclamar de algo sério, ou perguntar algo fora do seu escopo, marque "needs_human": true.

═══ REGRAS DE OURO ═══
- SEMPRE em português brasileiro, humano e natural (NÃO pareça robô).
- Use o primeiro nome do cliente quando apropriado.
- Mensagens curtas (máx 4-5 linhas). Use quebras de linha.
- Emojis com moderação (😊 👍 ✅) quando o tom permitir.
- NUNCA invente valores, datas ou informações que não estão acima.
- Se não tiver certeza, diga que vai consultar e marque needs_human=true.
- Não repita a mesma resposta. Olhe o histórico antes de responder.

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
{
  "reply": "sua resposta natural ao cliente",
  "is_receipt": boolean,
  "receipt_value": number | null,
  "needs_human": boolean,
  "summary": "resumo curto do que foi dito/decidido"
}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ];

    if (messageType === "text") {
      messages.push({ role: "user", content: incomingText });
    } else if (mediaData && mimeType) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: incomingText || (messageType === "audio" ? "[O cliente enviou um áudio - escute e responda]" : "[O cliente enviou uma imagem - analise se é comprovante]") },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${mediaData}` }
          }
        ]
      });
    } else {
      messages.push({ role: "user", content: `[Cliente enviou um ${messageType} mas o conteúdo não pôde ser baixado]` });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error("AI Gateway error");
    }

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 1. Send reply to WhatsApp
    if (result.reply) {
      const apiUrl = (settings.whatsapp_api_url || "").replace(/\/$/, "");
      const apiKey = settings.whatsapp_api_key;
      await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: senderJid, text: result.reply }),
      });
    }

    // 2. Handle Receipt Logic
    if (result.is_receipt && settings.bot_auto_confirm_payment && installments && installments.length > 0) {
      // Find the best installment to match
      const matchedInst = installments[0]; // Simple logic: match the oldest pending
      
      await supabase.from("contract_installments").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_amount: result.receipt_value || matchedInst.amount,
        payment_method: "pix",
        notes: `Confirmado automaticamente via Bot IA (Comprovante detectado)`
      }).eq("id", matchedInst.id);

      // Notify owner if enabled
      if (settings.bot_notify_owner) {
        // Here you could send a WhatsApp to the owner or a system notification
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Pagamento Confirmado via IA",
          message: `O bot identificou um comprovante de R$ ${result.receipt_value || matchedInst.amount} para o cliente ${client.name}.`,
          type: "payment",
        });
      }
    }

    // 3. Log interaction
    await supabase.from("audit_logs").insert({
      user_id: userId,
      entity_type: "whatsapp_bot",
      action: messageType === "image" && result.is_receipt ? "receipt_detected" : "replied",
      entity_id: client.id,
      details: {
        message_type: messageType,
        summary: result.summary,
        is_receipt: result.is_receipt,
        receipt_value: result.receipt_value,
        ai_reply: result.reply
      }
    });

    return new Response(JSON.stringify({ status: "success", result }), { headers: corsHeaders });

  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
