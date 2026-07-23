import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "clients", "contracts", "contract_installments", "transactions",
  "expenses", "profits", "goals", "notes", "todos", "settings",
  "collectors", "collector_assignments", "vehicles", "rentals", "stock_items",
];

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

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_blocked", false);

    const today = new Date().toISOString().split("T")[0];
    let backedUp = 0;
    const errors: string[] = [];

    for (const p of profiles || []) {
      try {
        const dump: Record<string, unknown[]> = {};
        for (const t of TABLES) {
          const { data } = await supabase.from(t).select("*").eq("user_id", p.id);
          dump[t] = data || [];
        }
        const path = `${p.id}/${today}.json`;
        const blob = new Blob([JSON.stringify(dump)], { type: "application/json" });
        const { error: upErr } = await supabase.storage
          .from("backups")
          .upload(path, blob, { upsert: true, contentType: "application/json" });
        if (upErr) throw upErr;
        backedUp++;
      } catch (e) {
        errors.push(`${p.id}: ${e instanceof Error ? e.message : "?"}`);
      }
    }

    return new Response(
      JSON.stringify({ message: `Backup de ${backedUp} usuário(s)`, backedUp, errors: errors.length ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
