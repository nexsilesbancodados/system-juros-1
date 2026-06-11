import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAnthropicJSON } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).eq("user_id", user.id).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "client not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: insts } = await supabase
      .from("contract_installments")
      .select("status, due_date, paid_at, amount")
      .eq("client_id", client_id)
      .eq("user_id", user.id);

    const { data: contracts } = await supabase
      .from("contracts")
      .select("capital, status, total_amount")
      .eq("client_id", client_id)
      .eq("user_id", user.id);

    const now = Date.now();
    let onTime = 0, late = 0, overdueNow = 0, totalLateDays = 0, paidValue = 0, pendingValue = 0;
    for (const i of insts || []) {
      const due = new Date(i.due_date).getTime();
      if (i.status === "paid" && i.paid_at) {
        const paid = new Date(i.paid_at).getTime();
        const diff = (paid - due) / 86400000;
        if (diff <= 1) onTime++;
        else { late++; totalLateDays += Math.floor(diff); }
        paidValue += Number(i.amount || 0);
      } else if (i.status === "pending") {
        if (due < now) { overdueNow++; totalLateDays += Math.floor((now - due) / 86400000); }
        pendingValue += Number(i.amount || 0);
      }
    }

    const totalContracts = contracts?.length || 0;
    const completedContracts = contracts?.filter(c => c.status === "completed").length || 0;
    const totalCapital = contracts?.reduce((a, c) => a + Number(c.capital || 0), 0) || 0;
    const avgLate = late + overdueNow > 0 ? totalLateDays / (late + overdueNow) : 0;

    const summary = {
      name: client.name,
      total_contracts: totalContracts,
      completed_contracts: completedContracts,
      total_borrowed: totalCapital,
      installments_total: insts?.length || 0,
      installments_on_time: onTime,
      installments_late_history: late,
      installments_overdue_now: overdueNow,
      avg_days_late: Math.round(avgLate),
      paid_value: paidValue,
      pending_value: pendingValue,
      current_score: client.credit_score || 100,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um analista de crédito brasileiro especializado em empréstimos pessoais. Analise o histórico do cliente e gere um score de 0 a 1000, classificação de risco e recomendações práticas. Seja direto, em português brasileiro.",
          },
          {
            role: "user",
            content: `Analise este cliente:\n${JSON.stringify(summary, null, 2)}\n\nGere score (0-1000), risco, limite recomendado e justificativa curta.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "credit_analysis",
              description: "Análise de crédito completa",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score 0-1000" },
                  risk_level: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
                  risk_label: { type: "string", description: "Texto curto: Excelente / Bom / Regular / Ruim / Crítico" },
                  recommended_limit: { type: "number", description: "Limite máximo recomendado em R$" },
                  recommended_max_installments: { type: "number" },
                  reasoning: { type: "string", description: "Justificativa em 1-2 frases" },
                  positive_points: { type: "array", items: { type: "string" } },
                  red_flags: { type: "array", items: { type: "string" } },
                  recommendations: { type: "array", items: { type: "string" }, description: "3-4 ações práticas para o operador" },
                },
                required: ["score", "risk_level", "risk_label", "recommended_limit", "recommended_max_installments", "reasoning", "positive_points", "red_flags", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "credit_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos no workspace Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    if (!analysis) throw new Error("AI did not return structured analysis");

    return new Response(JSON.stringify({ analysis, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("credit-score-ai error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
