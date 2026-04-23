import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Score 0-100 baseado em:
 * - Base 100
 * - -5 por parcela atrasada atualmente
 * - -2 por cada dia médio de atraso histórico
 * - +5 por cada parcela paga em dia (cap +20)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clients } = await supabase.from("clients").select("id, user_id, credit_score");
    const now = Date.now();
    let updated = 0;

    for (const c of clients || []) {
      const { data: insts } = await supabase
        .from("contract_installments")
        .select("status, due_date, paid_at")
        .eq("client_id", c.id);

      if (!insts || insts.length === 0) continue;

      let score = 100;
      let onTime = 0;
      let lateDaysSum = 0;
      let lateCount = 0;

      for (const i of insts) {
        const due = new Date(i.due_date).getTime();
        if (i.status === "pending" && due < now) {
          score -= 5;
          lateDaysSum += Math.floor((now - due) / 86400000);
          lateCount++;
        } else if (i.status === "paid" && i.paid_at) {
          const paid = new Date(i.paid_at).getTime();
          if (paid <= due + 86400000) onTime++;
          else {
            const d = Math.floor((paid - due) / 86400000);
            lateDaysSum += d;
            lateCount++;
          }
        }
      }

      if (lateCount > 0) score -= Math.min(30, Math.floor(lateDaysSum / lateCount) * 2);
      score += Math.min(20, onTime * 5);
      score = Math.max(0, Math.min(100, score));

      if (score !== c.credit_score) {
        await supabase.from("clients").update({ credit_score: score }).eq("id", c.id);
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ message: `${updated} score(s) atualizado(s)`, updated, total: clients?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
