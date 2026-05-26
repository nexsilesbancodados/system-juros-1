// Envio manual do inbox + agendamento + mídia + quick actions.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no_auth" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const {
      conversation_id, text, action,
      schedule_for,                 // ISO string => agenda
      media_url, media_type, caption, // imagem/doc/audio
    } = body as {
      conversation_id: string; text?: string; action?: string;
      schedule_for?: string;
      media_url?: string; media_type?: "image" | "document" | "audio"; caption?: string;
    };

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "missing_conversation" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: convo, error: convoErr } = await supabase
      .from("whatsapp_conversations").select("*")
      .eq("id", conversation_id).eq("user_id", user.id).single();
    if (convoErr || !convo) {
      return new Response(JSON.stringify({ error: "conversation_not_found" }), { status: 404, headers: corsHeaders });
    }

    const { data: settings } = await supabase
      .from("settings").select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
      .eq("user_id", user.id).single();
    const { data: profile } = await supabase
      .from("profiles").select("pix_key, pix_key_type, name").eq("id", user.id).single();

    const apiUrl = (settings?.whatsapp_api_url || "").replace(/\/$/, "");
    const apiKey = settings?.whatsapp_api_key;
    const instance = convo.instance || settings?.whatsapp_instance;

    // --- Quick action: mark_resolved (sem envio) ---
    if (action === "mark_resolved") {
      await supabase.from("whatsapp_conversations").update({
        needs_human: false, unread_count: 0, updated_at: new Date().toISOString(),
      }).eq("id", conversation_id);
      return new Response(JSON.stringify({ ok: true, resolved: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Resolver texto a partir da action ---
    let finalText = (text || "").trim();
    if (action === "send_pix" && profile?.pix_key) {
      finalText = `Segue a chave PIX:\n\n*${profile.pix_key}*\n(${profile.pix_key_type || "PIX"})\n\nApós o pagamento, é só me enviar o comprovante por aqui. ✅`;
    } else if (action === "send_receipt_request") {
      finalText = `Você pode me enviar o comprovante do pagamento? 📄`;
    }

    const hasMedia = !!media_url && !!media_type;

    if (!finalText && !hasMedia) {
      return new Response(JSON.stringify({ error: "missing_content" }), { status: 400, headers: corsHeaders });
    }

    // --- AGENDAMENTO ---
    if (schedule_for) {
      const when = new Date(schedule_for);
      if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
        return new Response(JSON.stringify({ error: "invalid_schedule" }), { status: 400, headers: corsHeaders });
      }
      await supabase.from("whatsapp_scheduled_messages").insert({
        conversation_id, user_id: user.id,
        text: finalText || caption || "[mídia agendada]",
        scheduled_for: when.toISOString(),
        status: "pending",
      });
      return new Response(JSON.stringify({ ok: true, scheduled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiUrl || !apiKey || !instance) {
      return new Response(JSON.stringify({ error: "whatsapp_not_configured" }), { status: 400, headers: corsHeaders });
    }

    // --- ENVIO ---
    let messageType = "text";
    let storedContent = finalText;

    if (hasMedia) {
      // Evolution sendMedia
      messageType = media_type!;
      const path = media_type === "audio" ? "sendWhatsAppAudio" : "sendMedia";
      const payload: any = media_type === "audio"
        ? { number: convo.jid, audio: media_url, delay: 600 }
        : {
            number: convo.jid,
            mediatype: media_type,
            mimetype: media_type === "image" ? "image/jpeg" : "application/pdf",
            media: media_url,
            caption: caption || finalText || "",
            fileName: media_type === "document" ? "documento.pdf" : undefined,
            delay: 600,
          };
      const sendRes = await fetch(`${apiUrl}/message/${path}/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify(payload),
      });
      if (!sendRes.ok) {
        const t = await sendRes.text();
        return new Response(JSON.stringify({ error: "media_send_failed", detail: t }), { status: 502, headers: corsHeaders });
      }
      storedContent = caption || finalText || `[${media_type}]`;
    } else {
      const sendRes = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: convo.jid, text: finalText, delay: 600 }),
      });
      if (!sendRes.ok) {
        const t = await sendRes.text();
        return new Response(JSON.stringify({ error: "send_failed", detail: t }), { status: 502, headers: corsHeaders });
      }
    }

    await supabase.from("whatsapp_messages").insert({
      conversation_id, user_id: user.id,
      direction: "out", sender: "human",
      message_type: messageType,
      content: storedContent,
      media_url: hasMedia ? media_url : null,
      metadata: action ? { action } : (hasMedia ? { media_type } : {}),
    });
    await supabase.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: (storedContent || "[mídia]").slice(0, 200),
      last_message_from: "human",
      needs_human: false,
      bot_paused: true,
      updated_at: new Date().toISOString(),
    }).eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-send error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
