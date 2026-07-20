import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const publicKey = Deno.env.get("MERCADOPAGO_PUBLIC_KEY") ?? "";
  return new Response(
    JSON.stringify({
      publicKey,
      currency: "BRL",
      country: "BR",
      locale: "pt-BR",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
