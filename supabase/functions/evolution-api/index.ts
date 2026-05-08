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
            qrcode: true
          })
        });
        break;

      case "getInstance":
        endpoint = `${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`;
        response = await fetch(endpoint, {
          method: "GET",
          headers: { "apikey": apiKey }
        });
        break;

      case "connectInstance":
        endpoint = `${baseUrl}/instance/connect/${instanceName}`;
        response = await fetch(endpoint, {
          method: "GET",
          headers: { "apikey": apiKey }
        });
        break;

      case "logoutInstance":
        endpoint = `${baseUrl}/instance/logout/${instanceName}`;
        response = await fetch(endpoint, {
          method: "DELETE",
          headers: { "apikey": apiKey }
        });
        break;

      case "deleteInstance":
        endpoint = `${baseUrl}/instance/delete/${instanceName}`;
        response = await fetch(endpoint, {
          method: "DELETE",
          headers: { "apikey": apiKey }
        });
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.status,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
