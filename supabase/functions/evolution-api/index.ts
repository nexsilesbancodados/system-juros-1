import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, instanceName, data } = await req.json();

    const { data: settings, error: settingsError } = await supabaseClient
      .from("settings")
      .select("whatsapp_api_url, whatsapp_api_key")
      .eq("user_id", user.id)
      .single();

    if (settingsError || !settings?.whatsapp_api_url || !settings?.whatsapp_api_key) {
      return new Response(JSON.stringify({ error: "WhatsApp settings not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = settings.whatsapp_api_url.endsWith("/") 
      ? settings.whatsapp_api_url.slice(0, -1) 
      : settings.whatsapp_api_url;
    
    const apiKey = settings.whatsapp_api_key;

    let response;
    let endpoint = "";

    switch (action) {
      case "createInstance":
        endpoint = `${baseUrl}/instance/create`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            instanceName: instanceName,
            token: user.id.split("-")[0],
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            syncFullHistory: true,
            alwaysOnline: true
          })
        });
        break;

      case "update_settings":
        endpoint = `${baseUrl}/settings/set/${instanceName}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": apiKey },
          body: JSON.stringify({
            rejectCall: false,
            groupsIgnore: false,
            alwaysOnline: true,
            readMessages: false,
            readStatus: false,
            syncFullHistory: true
          })
        });
        break;

      case "getInstance":
      case "check_status": // Alias
        endpoint = `${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`;
        response = await fetch(endpoint, {
          method: "GET",
          headers: { "apikey": apiKey }
        });
        break;

      case "connectInstance":
      case "get_qr": // Alias
        endpoint = `${baseUrl}/instance/connect/${instanceName}`;
        response = await fetch(endpoint, {
          method: "GET",
          headers: { "apikey": apiKey }
        });
        break;

      case "logoutInstance":
      case "logout": // Alias
        endpoint = `${baseUrl}/instance/logout/${instanceName}`;
        response = await fetch(endpoint, {
          method: "DELETE",
          headers: { "apikey": apiKey }
        });
        break;

      case "find_chats":
        endpoint = `${baseUrl}/chat/findChats/${instanceName}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": apiKey },
          body: JSON.stringify({})
        });
        break;

      case "fetch_messages":
      case "find_messages":
        endpoint = `${baseUrl}/chat/findMessages/${instanceName}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            where: data?.remoteJid ? { key: { remoteJid: data.remoteJid } } : {},
            limit: data?.count || 50
          })
        });
        break;

      case "send_message":
        endpoint = `${baseUrl}/message/sendText/${instanceName}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            number: data.phone,
            text: data.message
          })
        });
        break;

      case "setWebhook":
        endpoint = `${baseUrl}/webhook/instance/set/${instanceName}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            url: data.url,
            enabled: true,
            events: [
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "MESSAGES_DELETE",
              "SEND_MESSAGE",
              "CONNECTION_UPDATE",
              "TYPE_MESSAGE"
            ]
          })
        });
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log(`[Evolution API] Action: ${action}, Endpoint: ${endpoint}, Status: ${response.status}`);
    const result = await response.json().catch(() => ({}));
    console.log(`[Evolution API] Result:`, JSON.stringify(result));
    
    // Always return 200 to avoid runtime error overlays; embed upstream status in body
    return new Response(JSON.stringify({ ...result, upstream_status: response.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
