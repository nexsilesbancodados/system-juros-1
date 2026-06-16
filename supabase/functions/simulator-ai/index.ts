// AI Simulator: returns smart insights and 3 alternative scenarios for a loan setup.
import { callAnthropicJSON } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check: exige um token de usuário válido (anon ou autenticado) p/ não expor a chave da IA
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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
Seja direto, objetivo e use linguagem simples. Valores sempre em R$.
Responda APENAS com JSON válido no formato:
{
  "risk_level": "baixo"|"moderado"|"alto",
  "risk_reason": string (1 frase),
  "summary": string (2-3 frases),
  "recommendations": string[3-4],
  "scenarios": [
    {"name": "Conservador"|"Equilibrado"|"Lucrativo", "taxa": number, "parcelas": number, "reason": string}
  ] (exatamente 3 cenários)
}`;

    const userPrompt = `Simulação atual:
- Capital emprestado: R$ ${valor}
- Taxa: ${taxa}% (${frequency === "daily" ? "ao dia" : frequency === "weekly" ? "por semana" : "ao mês"})
- Modo: ${loanMode === "percentage" ? "Por porcentagem" : "Por parcelas"}
- Frequência: ${frequency}${frequency === "daily" ? ` (${dailyMode})` : ""}
- Nº de períodos: ${numParcelas}
- Valor por período: R$ ${valorParcela?.toFixed(2)}
- Juros total: R$ ${jurosTotal?.toFixed(2)}
- Total a receber: R$ ${totalReceber?.toFixed(2)}

Gere uma análise + 3 cenários alternativos (Conservador, Equilibrado, Lucrativo). Retorne somente o JSON.`;

    const analysis = await callAnthropicJSON({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 1200,
      temperature: 0.6,
    });

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
