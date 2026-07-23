import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 86400000);

    // 1) Bloquear contas com assinatura vencida
    const { data: expired } = await supabase
      .from("profiles")
      .select("id, name, email, subscription_expires_at, is_blocked")
      .lt("subscription_expires_at", now.toISOString())
      .eq("is_blocked", false);

    let blocked = 0;
    for (const p of expired || []) {
      await supabase.from("profiles").update({ is_blocked: true }).eq("id", p.id);
      await supabase.from("notifications").insert({
        user_id: p.id,
        message: "Sua assinatura expirou. Renove para continuar usando o sistema.",
        type: "subscription_expired",
        from: "Sistema",
        link: "/configuracoes",
      });
      blocked++;
    }

    // 2) Avisar quem vence em até 7 dias (1 vez/dia)
    const { data: expiring } = await supabase
      .from("profiles")
      .select("id, name, subscription_expires_at")
      .gte("subscription_expires_at", now.toISOString())
      .lte("subscription_expires_at", in7days.toISOString())
      .eq("is_blocked", false);

    const todayStr = now.toISOString().split("T")[0];
    let warned = 0;
    for (const p of expiring || []) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", p.id)
        .eq("type", "subscription_expiring")
        .gte("created_at", `${todayStr}T00:00:00Z`)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const expDate = new Date(p.subscription_expires_at!);
      const days = Math.ceil((expDate.getTime() - now.getTime()) / 86400000);
      await supabase.from("notifications").insert({
        user_id: p.id,
        message: `Sua assinatura vence em ${days} dia(s). Renove para evitar bloqueio.`,
        type: "subscription_expiring",
        from: "Sistema",
        link: "/configuracoes",
      });
      warned++;
    }

    return new Response(
      JSON.stringify({ message: `${blocked} bloqueada(s), ${warned} avisada(s)`, blocked, warned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("auto-subscription-check error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
