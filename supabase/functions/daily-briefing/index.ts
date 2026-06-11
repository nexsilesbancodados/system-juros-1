// Daily AI briefing for the dashboard top card
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAnthropicJSON } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in7 = new Date(today.getTime() + 7 * 86400000);

    const [{ data: installments }, { data: contracts }, { data: profile }] = await Promise.all([
      admin.from("contract_installments").select("*").eq("user_id", user.id),
      admin.from("contracts").select("*, clients(name)").eq("user_id", user.id),
      admin.from("profiles").select("name").eq("id", user.id).single(),
    ]);

    const inst = installments || [];
    const overdue = inst.filter((i: any) => i.status === "pending" && new Date(i.due_date) < today);
    const dueToday = inst.filter((i: any) => i.status === "pending" && i.due_date.startsWith(todayStr));
    const next7 = inst.filter((i: any) => i.status === "pending" && new Date(i.due_date) > today && new Date(i.due_date) <= in7);

    const overdueAmount = overdue.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const dueTodayAmount = dueToday.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const next7Amount = next7.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    const topOverdue = overdue
      .map((i: any) => {
        const c = (contracts || []).find((c: any) => c.id === i.contract_id);
        const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000);
        return { name: c?.clients?.name || "—", amount: Number(i.amount), days };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 3);

    const userPrompt = `Dados de hoje (${today.toLocaleDateString("pt-BR")}):
- Parcelas atrasadas: ${overdue.length} (R$ ${overdueAmount.toFixed(2)})
- Vencendo hoje: ${dueToday.length} (R$ ${dueTodayAmount.toFixed(2)})
- Próximos 7 dias: ${next7.length} (R$ ${next7Amount.toFixed(2)})
- Top 3 críticos: ${topOverdue.map(t => `${t.name} (${t.days}d, R$${t.amount.toFixed(0)})`).join("; ") || "nenhum"}

Nome do usuário: ${profile?.name?.split(" ")[0] || "Operador"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um assistente executivo de cobranças. Gere um briefing curto, motivador e prático em português brasileiro. Seja direto. Use 'você'. NÃO use markdown nem emojis em excesso (no máximo 1)." },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "daily_briefing",
            description: "Briefing executivo do dia",
            parameters: {
              type: "object",
              properties: {
                greeting: { type: "string", description: "Saudação curta (1 frase) personalizada com nome" },
                summary: { type: "string", description: "Resumo do dia em 1-2 frases destacando o número mais importante" },
                priorities: {
                  type: "array",
                  description: "2 a 3 prioridades acionáveis para hoje",
                  items: { type: "string" },
                },
                tone: { type: "string", enum: ["positivo", "neutro", "alerta"], description: "Tom geral do dia" },
              },
              required: ["greeting", "summary", "priorities", "tone"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "daily_briefing" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Sem créditos de IA" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No tool call");
    const briefing = JSON.parse(tc.function.arguments);

    return new Response(JSON.stringify({
      briefing,
      stats: { overdueCount: overdue.length, overdueAmount, dueTodayCount: dueToday.length, dueTodayAmount, next7Count: next7.length, next7Amount },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("daily-briefing error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
