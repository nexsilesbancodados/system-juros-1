import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN = {
  id: "credmais-mensal",
  title: "CredMais App — Acesso Ilimitado (Mensal)",
  price: 99.9,
  currency: "BRL",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body.email;
    const name: string | undefined = body.name;
    const origin = req.headers.get("origin") ?? "https://credmaisapp.lovable.app";

    const preference = {
      items: [
        {
          id: PLAN.id,
          title: PLAN.title,
          description: "Assinatura mensal do CredMais App — gestão profissional de empréstimos.",
          quantity: 1,
          currency_id: PLAN.currency,
          unit_price: PLAN.price,
        },
      ],
      payer: email ? { email, name: name ?? undefined } : undefined,
      back_urls: {
        success: `${origin}/checkout/sucesso`,
        failure: `${origin}/checkout/erro`,
        pending: `${origin}/checkout/pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "CREDMAIS",
      metadata: { plan: PLAN.id, email: email ?? null },
      notification_url: `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/mercadopago-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error:", data);
      return new Response(
        JSON.stringify({ error: "Falha ao criar preferência.", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
