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

    // Handle Evolution API Webhook format
    if (payload.event !== "messages.upsert") {
      return new Response(JSON.stringify({ status: "ignored_event" }), { headers: corsHeaders });
    }

    const message = payload.data?.message;
    if (!message || message.key?.fromMe) {
      return new Response(JSON.stringify({ status: "ignored_self_or_empty" }), { headers: corsHeaders });
    }

    const senderJid = message.key.remoteJid;
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");
    const incomingText = message.message?.conversation || message.message?.extendedTextMessage?.text || "";

    if (!incomingText) {
      return new Response(JSON.stringify({ status: "no_text" }), { headers: corsHeaders });
    }

    // Find instance and user_id by instance name from payload
    const instanceName = payload.instance;
    const { data: settings } = await supabase
      .from("settings")
      .select("*")
      .eq("whatsapp_instance", instanceName)
      .single();

    if (!settings || !settings.bot_enabled || !settings.bot_negotiation_enabled) {
      return new Response(JSON.stringify({ status: "bot_disabled_or_no_negotiation" }), { headers: corsHeaders });
    }

    const userId = settings.user_id;

    // Find client by phone
    // We try to match the last 8 digits to handle variations in international formats
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

    // Get debt context
    const { data: installments } = await supabase
      .from("contract_installments")
      .select("amount, due_date, status, late_fee")
      .eq("client_id", client.id)
      .eq("status", "pending")
      .lt("due_date", new Date().toISOString());

    const totalOverdue = installments?.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0) || 0;

    // Get profile for PIX key
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, pix_key")
      .eq("id", userId)
      .single();

    // Use AI to generate response
    if (lovableApiKey) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { 
              role: "system", 
              content: `Você é o bot de cobrança inteligente da empresa ${settings.company_name || profile?.name}. Tom de voz: ${settings.bot_tone || 'profissional'}.
              
              Dados do cliente ${client.name}:
              - Valor total em atraso: R$ ${totalOverdue.toFixed(2)}
              - Quantidade de parcelas: ${installments?.length || 0}
              - Chave PIX da empresa: ${profile?.pix_key || "Não disponível"}
              
              Instruções:
              1. Responda à mensagem do cliente de forma educada.
              2. Se o cliente prometer pagar, agradeça e peça para enviar o comprovante assim que possível.
              3. Se o cliente pedir mais tempo, você pode dar uma tolerância de até 3 dias se for a primeira vez.
              4. Se o cliente pedir desconto, diga que precisa verificar com o financeiro, mas ofereça a isenção de parte dos juros se pagar hoje.
              5. Mantenha a resposta curta (máximo 3 parágrafos).
              6. Use emojis de forma moderada.`
            },
            { role: "user", content: incomingText }
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const replyText = aiData.choices?.[0]?.message?.content?.trim();

        if (replyText) {
          // Send back via Evolution API
          const apiUrl = (settings.whatsapp_api_url || "").replace(/\/$/, "");
          const apiKey = settings.whatsapp_api_key;

          await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: senderJid, text: replyText }),
          });

          // Log in audit logs
          await supabase.from("audit_logs").insert({
            user_id: userId,
            entity_type: "whatsapp_bot",
            action: "replied_to_client",
            entity_id: client.id,
            details: {
              incoming: incomingText,
              reply: replyText,
              client_name: client.name
            }
          });

          return new Response(JSON.stringify({ status: "replied", text: replyText }), { headers: corsHeaders });
        }
      }
    }

    return new Response(JSON.stringify({ status: "no_reply_generated" }), { headers: corsHeaders });
  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});