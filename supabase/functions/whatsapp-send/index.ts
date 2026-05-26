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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no_auth" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { conversation_id, text } = body;
    if (!conversation_id || !text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: corsHeaders });
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

    const apiUrl = (settings?.whatsapp_api_url || "").replace(/\/$/, "");
    const apiKey = settings?.whatsapp_api_key;
    const instance = convo.instance || settings?.whatsapp_instance;

    if (!apiUrl || !apiKey || !instance) {
      return new Response(JSON.stringify({ error: "whatsapp_not_configured" }), { status: 400, headers: corsHeaders });
    }

    const sendRes = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: convo.jid, text, delay: 600 }),
    });

    if (!sendRes.ok) {
      const errTxt = await sendRes.text();
      console.error("Evolution send error", sendRes.status, errTxt);
      return new Response(JSON.stringify({ error: "send_failed", detail: errTxt }), { status: 502, headers: corsHeaders });
    }

    await supabase.from("whatsapp_messages").insert({
      conversation_id, user_id: user.id,
      direction: "out", sender: "human",
      message_type: "text", content: text,
    });
    await supabase.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 200),
      last_message_from: "human",
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
