// AI Simulator: returns smart insights and 3 alternative scenarios for a loan setup.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { valor, taxa, parcelas, loanMode, frequency, dailyMode, totalReceber, jurosTotal, valorParcela, numParcelas } = body || {};

    if (!valor || !taxa) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um analista de crédito especialista em empréstimos pessoais no Brasil.
Analise a simulação fornecida e gere insights práticos e cenários alternativos.
Considere risco de inadimplência, capacidade de pagamento típica do cliente e taxa de mercado.
Seja direto, objetivo e use linguagem simples. Valores sempre em R$.`;

    const userPrompt = `Simulação atual:
- Capital emprestado: R$ ${valor}
- Taxa: ${taxa}% (${frequency === "daily" ? "ao dia" : frequency === "weekly" ? "por semana" : "ao mês"})
- Modo: ${loanMode === "percentage" ? "Por porcentagem" : "Por parcelas"}
- Frequência: ${frequency}${frequency === "daily" ? ` (${dailyMode})` : ""}
- Nº de períodos: ${numParcelas}
- Valor por período: R$ ${valorParcela?.toFixed(2)}
- Juros total: R$ ${jurosTotal?.toFixed(2)}
- Total a receber: R$ ${totalReceber?.toFixed(2)}

Gere uma análise + 3 cenários alternativos (mais conservador, equilibrado, mais lucrativo).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "loan_analysis",
            description: "Análise estruturada do empréstimo com cenários alternativos",
            parameters: {
              type: "object",
              properties: {
                risk_level: { type: "string", enum: ["baixo", "moderado", "alto"], description: "Nível de risco da operação" },
                risk_reason: { type: "string", description: "Justificativa curta (1 frase) do nível de risco" },
                summary: { type: "string", description: "Análise em 2-3 frases sobre rentabilidade e viabilidade" },
                recommendations: {
                  type: "array",
                  items: { type: "string" },
                  description: "3 a 4 dicas práticas para o emprestador",
                },
                scenarios: {
                  type: "array",
                  description: "Exatamente 3 cenários alternativos",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nome curto: 'Conservador', 'Equilibrado' ou 'Lucrativo'" },
                      taxa: { type: "number", description: "Taxa de juros sugerida em %" },
                      parcelas: { type: "number", description: "Número de parcelas sugerido" },
                      reason: { type: "string", description: "Por que esse cenário (1 frase curta)" },
                    },
                    required: ["name", "taxa", "parcelas", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["risk_level", "risk_reason", "summary", "recommendations", "scenarios"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "loan_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Falha no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Resposta inesperada da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("simulator-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
