import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, start_date, end_date } = await req.json();
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 1. Get Base Data
    let client = null;
    if (client_id) {
      const { data } = await supabase.from("clients").select("*").eq("id", client_id).maybeSingle();
      client = data;
    }

    const [profits, expenses, contracts, installments] = await Promise.all([
      supabase.from("profits").select("*").eq("user_id", user.id).gte("date", start_date).lte("date", end_date),
      supabase.from("expenses").select("*").eq("user_id", user.id).gte("date", start_date).lte("date", end_date),
      supabase.from("contracts").select("*, clients(name)").eq("user_id", user.id),
      supabase.from("contract_installments").select("*, contracts(capital, frequency), clients(name)").eq("user_id", user.id).gte("due_date", start_date).lte("due_date", end_date),
    ]);

    const summary = {
      period: { start: start_date, end: end_date },
      client: client?.name || "Geral",
      total_profit: profits.data?.reduce((a, p) => a + Number(p.amount), 0) || 0,
      total_expense: expenses.data?.reduce((a, e) => a + Number(e.amount), 0) || 0,
      active_contracts: contracts.data?.filter(c => c.status === "active").length || 0,
      paid_installments: installments.data?.filter(i => i.status === "paid").length || 0,
      overdue_installments: installments.data?.filter(i => i.status !== "paid" && new Date(i.due_date) < new Date()).length || 0,
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
            content: "Você é um consultor financeiro sênior especializado em microcrédito e empréstimos pessoais. Analise os dados do período e gere um sumário executivo com insights estratégicos, pontos de atenção e recomendações para o próximo mês. Seja profissional, direto e em português brasileiro.",
          },
          {
            role: "user",
            content: `Analise este resumo financeiro:\n${JSON.stringify(summary, null, 2)}\n\nGere um título impactante, análise de saúde do negócio, 3 insights baseados em dados e 3 recomendações prioritárias.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_analysis",
              description: "Análise executiva do relatório",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  business_health: { type: "string", enum: ["excelente", "bom", "estavel", "atencao", "critico"] },
                  health_label: { type: "string", description: "Texto curto explicando a saúde" },
                  summary_text: { type: "string", description: "Resumo de 2-3 frases" },
                  insights: { type: "array", items: { type: "string" } },
                  recommendations: { type: "array", items: { type: "string" } },
                },
                required: ["title", "business_health", "health_label", "summary_text", "insights", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_analysis" } },
      }),
    });

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({ analysis, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("report-ai error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});