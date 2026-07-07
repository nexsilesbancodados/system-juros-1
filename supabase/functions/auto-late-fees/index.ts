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
    const todayStr = now.toISOString().split("T")[0];

    // Todas as parcelas ainda não pagas/canceladas cujo vencimento já passou.
    // Cobre TODOS os tipos de empréstimo (installments, percentage, etc.) — todos
    // gravam suas parcelas na mesma tabela contract_installments.
    const { data: overdueInstallments, error: fetchErr } = await supabase
      .from("contract_installments")
      .select("id, amount, due_date, late_fee, contract_id, user_id, client_id, installment_number, status")
      .not("status", "in", "(paid,cancelled)")
      .lt("due_date", todayStr);

    if (fetchErr) {
      throw new Error(`Erro ao buscar parcelas: ${fetchErr.message}`);
    }

    if (!overdueInstallments || overdueInstallments.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma parcela atrasada encontrada", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configuração por contrato (multa e juros diários)
    const contractIds = [...new Set(overdueInstallments.map((i) => i.contract_id))];
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, user_id, loan_mode, late_fee_percent, daily_interest_percent")
      .in("id", contractIds);

    const contractMap = new Map<string, { user_id: string; loan_mode: string | null; late_fee_percent: number; daily_interest_percent: number }>();
    for (const c of contracts || []) {
      contractMap.set(c.id, {
        user_id: c.user_id,
        loan_mode: c.loan_mode,
        late_fee_percent: Number(c.late_fee_percent) || 0,
        daily_interest_percent: Number(c.daily_interest_percent) || 0,
      });
    }

    // Fallback global do credor: settings.default_late_fee / default_daily_interest.
    // Garante que mesmo contratos antigos (sem multa configurada) apliquem a política padrão.
    const userIds = [...new Set((contracts || []).map((c) => c.user_id))];
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("user_id, default_late_fee, default_daily_interest")
      .in("user_id", userIds);
    const settingsMap = new Map<string, { late_fee: number; daily_interest: number }>();
    for (const s of settingsRows || []) {
      settingsMap.set(s.user_id, {
        late_fee: Number(s.default_late_fee) || 0,
        daily_interest: Number(s.default_daily_interest) || 0,
      });
    }

    let feesUpdated = 0;
    let statusUpdated = 0;
    const errors: string[] = [];
    const clientNotifications: Array<Record<string, unknown>> = [];

    for (const inst of overdueInstallments) {
      const config = contractMap.get(inst.contract_id);
      if (!config) continue;

      const dueDate = new Date(inst.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) continue;

      const baseAmount = Number(inst.amount) || 0;

      // Aplica config do contrato; se faltar, cai para o padrão do credor.
      const defaults = settingsMap.get(config.user_id) || { late_fee: 0, daily_interest: 0 };
      const lateFeePct = config.late_fee_percent > 0 ? config.late_fee_percent : defaults.late_fee;
      const dailyPct = config.daily_interest_percent > 0 ? config.daily_interest_percent : defaults.daily_interest;

      // Multa (aplicada 1x) + juros diários acumulados sobre o valor da parcela.
      // Vale para qualquer tipo de empréstimo — cada parcela tem seu próprio `amount`.
      const multa = baseAmount * (lateFeePct / 100);
      const juros = baseAmount * (dailyPct / 100) * daysOverdue;
      const totalLateFee = Math.round((multa + juros) * 100) / 100;

      const patch: Record<string, unknown> = {};
      const currentFee = Number(inst.late_fee) || 0;
      if (Math.abs(totalLateFee - currentFee) >= 0.01 && (lateFeePct > 0 || dailyPct > 0)) {
        patch.late_fee = totalLateFee;
      }
      // Marca a parcela como overdue automaticamente se ainda estiver pendente.
      if (inst.status === "pending") {
        patch.status = "overdue";
      }

      if (Object.keys(patch).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("contract_installments")
        .update(patch)
        .eq("id", inst.id);

      if (updateErr) {
        errors.push(`Parcela ${inst.id}: ${updateErr.message}`);
      } else {
        if (patch.late_fee !== undefined) feesUpdated++;
        if (patch.status !== undefined) statusUpdated++;
      }
    }

    // Notifica cada credor 1x por dia sobre as multas atualizadas
    const affectedUsers = [...new Set(overdueInstallments.map((i) => i.user_id))];
    for (const userId of affectedUsers) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "late_fees_auto")
        .gte("created_at", `${todayStr}T00:00:00Z`)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const userOverdue = overdueInstallments.filter((i) => i.user_id === userId);
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
        message: `Multas: ${feesUpdated} atualizadas · ${statusUpdated} marcadas como atrasadas`,
        fees_updated: feesUpdated,
        status_updated: statusUpdated,
        total_overdue: overdueInstallments.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("auto-late-fees error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
