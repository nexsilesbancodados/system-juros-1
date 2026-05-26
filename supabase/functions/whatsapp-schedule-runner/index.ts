// Roda a cada minuto: envia mensagens agendadas cujo scheduled_for já passou.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const nowIso = new Date().toISOString();
  const { data: jobs } = await supabase
    .from("whatsapp_scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .limit(50);

  let sent = 0;
  let failed = 0;

  for (const job of jobs || []) {
    try {
      const { data: convo } = await supabase
        .from("whatsapp_conversations").select("*").eq("id", job.conversation_id).single();
      if (!convo) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "failed", error: "conversation_not_found",
        }).eq("id", job.id);
        failed++; continue;
      }

      const { data: settings } = await supabase
        .from("settings").select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
        .eq("user_id", job.user_id).single();

      const apiUrl = (settings?.whatsapp_api_url || "").replace(/\/$/, "");
      const apiKey = settings?.whatsapp_api_key;
      const instance = convo.instance || settings?.whatsapp_instance;
      if (!apiUrl || !apiKey || !instance) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "failed", error: "whatsapp_not_configured",
        }).eq("id", job.id);
        failed++; continue;
      }

      const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: convo.jid, text: job.text, delay: 600 }),
      });

      if (!res.ok) {
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "failed", error: `send_failed_${res.status}`,
        }).eq("id", job.id);
        failed++; continue;
      }

      await supabase.from("whatsapp_messages").insert({
        conversation_id: job.conversation_id, user_id: job.user_id,
        direction: "out", sender: "human",
        message_type: "text", content: job.text,
        metadata: { scheduled: true, scheduled_for: job.scheduled_for },
      });
      await supabase.from("whatsapp_conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: job.text.slice(0, 200),
        last_message_from: "human",
        updated_at: new Date().toISOString(),
      }).eq("id", job.conversation_id);
      await supabase.from("whatsapp_scheduled_messages").update({
        status: "sent", sent_at: new Date().toISOString(),
      }).eq("id", job.id);
      sent++;
    } catch (e) {
      await supabase.from("whatsapp_scheduled_messages").update({
        status: "failed", error: e instanceof Error ? e.message : "unknown",
      }).eq("id", job.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: jobs?.length || 0, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
