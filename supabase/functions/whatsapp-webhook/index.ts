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
    const message = data?.message;
    if (!message || message.key?.fromMe) {
      return new Response(JSON.stringify({ status: "ignored_self_or_empty" }), { headers: corsHeaders });
    }

    const senderJid = message.key.remoteJid;
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");
    const instanceName = payload.instance;

    // Detect message type and content
    let messageType = "text";
    let incomingText = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
    let mediaData: string | null = null;
    let mimeType: string | null = null;

    if (message.message?.imageMessage) {
      messageType = "image";
      mimeType = message.message.imageMessage.mimetype;
      incomingText = message.message.imageMessage.caption || "";
    } else if (message.message?.audioMessage) {
      messageType = "audio";
      mimeType = message.message.audioMessage.mimetype;
    }

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

    // Prepare AI Prompt
    const systemPrompt = `Você é o bot de cobrança e atendimento inteligente da empresa ${settings.company_name || profile?.name}.
Tom de voz: ${settings.bot_tone || 'profissional'}.

Dados do cliente ${client.name}:
- Total em atraso: R$ ${totalOverdue.toFixed(2)}
- Parcelas pendentes: ${installments?.length || 0}
${installments?.length ? `- Próxima/Última parcela: R$ ${installments[0].amount} (Venc: ${new Date(installments[0].due_date).toLocaleDateString('pt-BR')})` : ''}
- Chave PIX: ${profile?.pix_key || "Não disponível"}

Funcionalidades:
1. AUDIO: Se receber um áudio, transcreva mentalmente e responda ao que o cliente disse.
2. COMPROVANTE: Se receber uma imagem, analise se é um comprovante de transferência/PIX. 
   - Se for um comprovante válido, identifique o valor e a data.
   - Responda confirmando que recebeu o comprovante e que o financeiro irá baixar o pagamento.
   - Retorne no JSON final o campo "is_receipt": true e "receipt_value": valor_do_comprovante.
3. NEGOCIAÇÃO: Você pode oferecer isenção de juros para pagamento HOJE.
4. ATENDIMENTO: Responda dúvidas gerais sobre o contrato.

REGRAS DE RESPOSTA:
- Seja educado e empático.
- Máximo 3 parágrafos.
- Se for comprovante, seja entusiasta e agradeça.

IMPORTANTE: Responda em formato JSON:
{
  "reply": "sua resposta aqui",
  "is_receipt": boolean,
  "receipt_value": number | null,
  "summary": "resumo do que o cliente disse/pediu"
}`;

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (messageType === "text") {
      messages.push({ role: "user", content: incomingText });
    } else if (mediaData && mimeType) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: incomingText || (messageType === "audio" ? "O cliente enviou um áudio." : "O cliente enviou uma imagem.") },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${mediaData}` }
          }
        ]
      } as any);
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
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
