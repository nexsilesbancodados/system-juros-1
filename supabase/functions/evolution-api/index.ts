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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Evolution API settings
    const { data: settings } = await supabase
      .from("settings")
      .select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance")
      .eq("user_id", user.id)
      .single();

    if (!settings?.whatsapp_api_url || !settings?.whatsapp_api_key) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada. Vá em Configurações > WhatsApp e preencha a URL e API Key." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = settings.whatsapp_api_url.replace(/\/$/, "");
    const apiKey = settings.whatsapp_api_key;
    const instanceName = settings.whatsapp_instance || `systemjuros_${user.id.substring(0, 8)}`;

    const { action, ...body } = await req.json();

    switch (action) {
      case "create_instance": {
        // First try to check if instance exists
        const checkResp = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: apiKey },
        });

        if (checkResp.ok) {
          const state = await checkResp.json();
          if (state?.instance?.state === "open") {
            return new Response(JSON.stringify({ status: "connected", instance: instanceName }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Create instance
        const createResp = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            instanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            reject_call: false,
            always_online: true,
          }),
        });

        const createData = await createResp.json();

        // Save instance name to settings
        await supabase
          .from("settings")
          .update({ whatsapp_instance: instanceName })
          .eq("user_id", user.id);

        // If QR is in the create response
        if (createData?.qrcode?.base64) {
          return new Response(
            JSON.stringify({
              status: "qr_ready",
              qrcode: createData.qrcode.base64,
              instance: instanceName,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ status: "created", instance: instanceName, data: createData }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_qr": {
        const qrResp = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
          headers: { apikey: apiKey },
        });
        const qrData = await qrResp.json();

        return new Response(
          JSON.stringify({
            status: qrData?.base64 ? "qr_ready" : "waiting",
            qrcode: qrData?.base64 || null,
            instance: instanceName,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_status": {
        const statusResp = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: apiKey },
        });

        if (!statusResp.ok) {
          return new Response(
            JSON.stringify({ status: "disconnected", instance: instanceName }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const statusData = await statusResp.json();
        const state = statusData?.instance?.state || "disconnected";

        return new Response(
          JSON.stringify({ status: state === "open" ? "connected" : state, instance: instanceName }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "send_message": {
        const { phone, message } = body;
        if (!phone || !message) {
          return new Response(JSON.stringify({ error: "phone e message são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const cleanPhone = phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        const sendResp = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        const sendData = await sendResp.json();
        return new Response(JSON.stringify({ success: sendResp.ok, data: sendData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "logout": {
        const logoutResp = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: { apikey: apiKey },
        });
        const logoutData = await logoutResp.json();
        return new Response(JSON.stringify({ success: logoutResp.ok, data: logoutData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("evolution-api error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
