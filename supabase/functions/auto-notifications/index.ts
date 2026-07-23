import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, templates } from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // SEGURANÇA (M4): cron protegido por segredo. FAIL-SAFE: só exige quando
  // CRON_SECRET estiver configurado nos secrets (senão apenas roda, como antes).
  if (Deno.env.get("CRON_SECRET") &&
      (req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret") ?? "") !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayStart = `${todayStr}T00:00:00Z`;
    const todayEnd = `${todayStr}T23:59:59Z`;

    const created: string[] = [];

    // ==========================================
    // 1. PARCELAS VENCENDO HOJE
    // ==========================================
    const { data: dueToday } = await supabase
      .from("contract_installments")
      .select("id, amount, client_id, user_id, installment_number")
      .eq("status", "pending")
      .gte("due_date", todayStart)
      .lte("due_date", todayEnd);

    if (dueToday && dueToday.length > 0) {
      const byUser = new Map<string, typeof dueToday>();
      for (const inst of dueToday) {
        const list = byUser.get(inst.user_id) || [];
        list.push(inst);
        byUser.set(inst.user_id, list);
      }

      for (const [userId, installments] of byUser) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "due_today")
          .gte("created_at", todayStart)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const total = installments.reduce((s, i) => s + Number(i.amount), 0);
        const clientIds = [...new Set(installments.map(i => i.client_id))];
        const { data: clients } = await supabase
          .from("clients")
          .select("name")
          .in("id", clientIds);

        const names = clients?.map(c => c.name).join(", ") || "";

        await supabase.from("notifications").insert({
          user_id: userId,
          message: `📅 ${installments.length} parcela(s) vencem hoje totalizando R$ ${total.toFixed(2)}. Clientes: ${names}`,
          type: "due_today",
          from: "Automação",
          link: "/cobrancas",
        });
        created.push(`due_today:${userId}`);
      }
    }

    // ==========================================
    // 2. PARCELAS ATRASADAS (resumo)
    // ==========================================
    const { data: overdue } = await supabase
      .from("contract_installments")
      .select("id, amount, client_id, user_id, due_date")
      .eq("status", "pending")
      .lt("due_date", todayStart);

    if (overdue && overdue.length > 0) {
      const byUser = new Map<string, typeof overdue>();
      for (const inst of overdue) {
        const list = byUser.get(inst.user_id) || [];
        list.push(inst);
        byUser.set(inst.user_id, list);
      }

      for (const [userId, installments] of byUser) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "overdue_summary")
          .gte("created_at", todayStart)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const total = installments.reduce((s, i) => s + Number(i.amount), 0);
        const clientIds = [...new Set(installments.map(i => i.client_id))];

        await supabase.from("notifications").insert({
          user_id: userId,
          message: `🚨 ${installments.length} parcela(s) atrasada(s) totalizando R$ ${total.toFixed(2)} de ${clientIds.length} cliente(s).`,
          type: "overdue_summary",
          from: "Automação",
          link: "/cobrancas",
        });
        created.push(`overdue_summary:${userId}`);
      }
    }

    // ==========================================
    // 3. METAS ATINGIDAS
    // ==========================================
    const { data: completedGoals } = await supabase
      .from("goals")
      .select("id, description, user_id, target_amount, current_amount")
      .gte("current_amount", 0); // We'll filter in code

    if (completedGoals) {
      const achieved = completedGoals.filter(g => Number(g.current_amount) >= Number(g.target_amount));

      for (const goal of achieved) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", goal.user_id)
          .eq("type", "goal_achieved")
          .like("message", `%${goal.id.substring(0, 8)}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("notifications").insert({
          user_id: goal.user_id,
          message: `🏆 Meta atingida: "${goal.description}"! Valor: R$ ${Number(goal.current_amount).toFixed(2)} / R$ ${Number(goal.target_amount).toFixed(2)} [${goal.id.substring(0, 8)}]`,
          type: "goal_achieved",
          from: "Automação",
          link: "/ferramentas/metas",
        });
        created.push(`goal_achieved:${goal.id}`);
      }
    }

    // ==========================================
    // 4. CLIENTES INADIMPLENTES (score baixo)
    // ==========================================
    const { data: lowScoreClients } = await supabase
      .from("clients")
      .select("id, name, user_id, credit_score")
      .lte("credit_score", 30)
      .eq("status", "Ativo");

    if (lowScoreClients && lowScoreClients.length > 0) {
      const byUser = new Map<string, typeof lowScoreClients>();
      for (const cl of lowScoreClients) {
        const list = byUser.get(cl.user_id) || [];
        list.push(cl);
        byUser.set(cl.user_id, list);
      }

      for (const [userId, clients] of byUser) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "low_score_alert")
          .gte("created_at", todayStart)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const names = clients.map(c => c.name).join(", ");
        await supabase.from("notifications").insert({
          user_id: userId,
          message: `⚠️ ${clients.length} cliente(s) com score crítico (≤30): ${names}`,
          type: "low_score_alert",
          from: "Automação",
          link: "/clientes",
        });
        created.push(`low_score:${userId}`);
      }
    }

    // ==========================================
    // 5. AVISO EXPIRAÇÃO TESTE (3 dias antes)
    // ==========================================
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

    const { data: expiringSoon } = await supabase
      .from("profiles")
      .select("id, full_name, email, trial_ends_at")
      .gte("trial_ends_at", `${threeDaysStr}T00:00:00Z`)
      .lte("trial_ends_at", `${threeDaysStr}T23:59:59Z`);

    if (expiringSoon) {
      for (const user of expiringSoon) {
        // Send internal notification
        await supabase.from("notifications").insert({
          user_id: user.id,
          message: `⏳ Seu teste grátis expira em 3 dias. Não perca o acesso!`,
          type: "trial_expiring_soon",
          from: "Sistema",
          link: "/configuracoes",
        });

        // Send Email via Brevo
        const emailTemplate = templates.trialExpiring(user.full_name || user.email, 3);
        await sendEmail({
          to: [{ email: user.email, name: user.full_name }],
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.html,
        });
        
        created.push(`trial_expiring_email:${user.id}`);
      }
    }
    // ==========================================
    // 6. RELATÓRIO MENSAL (No dia 1 de cada mês)
    // ==========================================
    if (now.getDate() === 1) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const year = lastMonth.getFullYear();
      const month = lastMonth.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const monthName = lastMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      const { data: users } = await supabase.from("profiles").select("id, full_name, email");

      if (users) {
        for (const user of users) {
          // Fetch metrics for this user
          const [profits, expenses] = await Promise.all([
            supabase.from("profits").select("amount").eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
            supabase.from("expenses").select("amount").eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
          ]);

          const totalProfit = (profits.data || []).reduce((a, p) => a + Number(p.amount), 0);
          const totalExpense = (expenses.data || []).reduce((a, e) => a + Number(e.amount), 0);
          const balance = totalProfit - totalExpense;

          if (totalProfit > 0 || totalExpense > 0) {
            const emailTemplate = templates.monthlyReport(user.full_name || user.email, monthName, {
              profit: totalProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
              expenses: totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
              balance: balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
              insight: balance > 0 
                ? "Seu saldo foi positivo este mês! Ótimo momento para reinvestir em novos contratos." 
                : "Atenção aos custos operacionais. Analise seus gastos para melhorar a margem no próximo mês."
            });

            await sendEmail({
              to: [{ email: user.email, name: user.full_name }],
              subject: emailTemplate.subject,
              htmlContent: emailTemplate.html,
            });
            
            created.push(`monthly_report_email:${user.id}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Notificações criadas: ${created.length}`,
        details: created,
        due_today: dueToday?.length || 0,
        overdue: overdue?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-notifications error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
