// Follow-up automático: cutuca clientes que pararam de responder no meio da conversa.
// Disparado por pg_cron a cada 30min.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOLLOWUPS = [
  "Oi! 👋 Você ainda está aí? Posso te ajudar com mais alguma coisa?",
  "Olá! Só passando pra saber se você precisa de algo mais. 😊",
  "Oi, tudo bem? Notei que paramos de conversar. Posso ajudar em algo? 🤝",
];
const pick = () => FOLLOWUPS[Math.floor(Math.random() * FOLLOWUPS.length)];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // SEGURANÇA (M4): cron protegido por segredo. FAIL-SAFE: só exige quando
  // CRON_SECRET estiver configurado nos secrets (senão apenas roda, como antes).
  if (Deno.env.get("CRON_SECRET") &&
      (req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret") ?? "") !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Conversas com cliente parado entre 6h e 48h, sem follow-up enviado, bot ativo, não bloqueada
    const now = Date.now();
    const minAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const maxAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();

    const { data: convos } = await supabase
      .from("whatsapp_conversations")
      .select("id, user_id, jid, instance, contact_name, last_message_from")
      .eq("last_message_from", "client")
      .eq("bot_paused", false)
      .eq("blocked", false)
      .eq("needs_human", false)
      .is("followup_sent_at", null)
      .gte("last_message_at", minAgo)
      .lte("last_message_at", maxAgo)
      .limit(50);

    if (!convos?.length) {
      return new Response(JSON.stringify({ status: "ok", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    for (const c of convos) {
      // Busca settings do dono da conversa
      const { data: settings } = await supabase
        .from("settings")
        .select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance, bot_enabled")
        .eq("user_id", c.user_id)
        .single();

      if (!settings?.bot_enabled || !settings.whatsapp_api_url || !settings.whatsapp_api_key) continue;

      const instance = c.instance || settings.whatsapp_instance;
      if (!instance) continue;

      const text = pick();
      try {
        const res = await fetch(
          `${settings.whatsapp_api_url.replace(/\/$/, "")}/message/sendText/${instance}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: settings.whatsapp_api_key },
            body: JSON.stringify({ number: c.jid, text, delay: 500 }),
          },
        );
        if (!res.ok) {
          console.error("send fail", c.id, await res.text());
          continue;
        }

        await supabase.from("whatsapp_messages").insert({
          conversation_id: c.id,
          user_id: c.user_id,
          direction: "out",
          sender: "bot",
          message_type: "text",
          content: text,
          metadata: { followup: true },
        });

        await supabase.from("whatsapp_conversations").update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 200),
          last_message_from: "bot",
          followup_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);

        sent++;
      } catch (e) {
        console.error("followup error", c.id, e);
      }
    }

    return new Response(JSON.stringify({ status: "ok", processed: sent, candidates: convos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-followup error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "internal" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
