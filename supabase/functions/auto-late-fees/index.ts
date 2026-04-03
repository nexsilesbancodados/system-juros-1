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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    // Get all overdue contract installments that are still pending
    const { data: overdueInstallments, error: fetchErr } = await supabase
      .from("contract_installments")
      .select("id, amount, due_date, late_fee, contract_id, user_id, client_id, installment_number")
      .eq("status", "pending")
      .lt("due_date", now.toISOString());

    if (fetchErr) {
      throw new Error(`Erro ao buscar parcelas: ${fetchErr.message}`);
    }

    if (!overdueInstallments || overdueInstallments.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma parcela atrasada encontrada", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique contract IDs to fetch their fee configs
    const contractIds = [...new Set(overdueInstallments.map(i => i.contract_id))];
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, late_fee_percent, daily_interest_percent")
      .in("id", contractIds);

    const contractMap = new Map<string, { late_fee_percent: number; daily_interest_percent: number }>();
    for (const c of contracts || []) {
      contractMap.set(c.id, {
        late_fee_percent: Number(c.late_fee_percent) || 0,
        daily_interest_percent: Number(c.daily_interest_percent) || 0,
      });
    }

    let updated = 0;
    const errors: string[] = [];

    for (const inst of overdueInstallments) {
      const config = contractMap.get(inst.contract_id);
      if (!config) continue;

      const dueDate = new Date(inst.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) continue;

      const baseAmount = Number(inst.amount);

      // Calculate fees:
      // Late fee (multa): one-time percentage on the base amount
      const lateFeeAmount = baseAmount * (config.late_fee_percent / 100);
      // Daily interest (juros diários): daily percentage * days overdue
      const dailyInterestAmount = baseAmount * (config.daily_interest_percent / 100) * daysOverdue;
      // Total late fee = multa + juros diários acumulados
      const totalLateFee = Math.round((lateFeeAmount + dailyInterestAmount) * 100) / 100;

      // Only update if the fee changed
      const currentFee = Number(inst.late_fee) || 0;
      if (Math.abs(totalLateFee - currentFee) < 0.01) continue;

      const { error: updateErr } = await supabase
        .from("contract_installments")
        .update({ late_fee: totalLateFee })
        .eq("id", inst.id);

      if (updateErr) {
        errors.push(`Parcela ${inst.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    }

    // Create notification for each user about updated fees
    const userIds = [...new Set(overdueInstallments.map(i => i.user_id))];
    const todayStr = now.toISOString().split("T")[0];

    for (const userId of userIds) {
      // Check if already notified today
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "late_fees_auto")
        .gte("created_at", `${todayStr}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const userOverdue = overdueInstallments.filter(i => i.user_id === userId);
      if (userOverdue.length === 0) continue;

      await supabase.from("notifications").insert({
        user_id: userId,
        message: `Multas e juros atualizados automaticamente em ${userOverdue.length} parcela(s) atrasada(s).`,
        type: "late_fees_auto",
        from: "Automação",
        link: "/cobrancas",
      });
    }

    return new Response(
      JSON.stringify({
        message: `Multas atualizadas: ${updated} parcelas`,
        updated,
        total_overdue: overdueInstallments.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-late-fees error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
