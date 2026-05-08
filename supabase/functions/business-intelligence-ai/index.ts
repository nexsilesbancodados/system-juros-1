import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { generateText, Output } from "npm:ai";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { z } from "npm:zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

const BiInsightsSchema = z.object({
  predictive_cashflow: z.array(z.object({
    month: z.string(),
    expected: z.number(),
    likely: z.number(),
  })).length(4),
  risk_assessment: z.enum(["Baixo", "Médio", "Alto", "Crítico"]),
  risk_reason: z.string(),
  strategic_advice: z.array(z.string()).length(3),
  top_client_segments: z.array(z.string()).length(3),
});

const buildLocalInsights = (data: { contracts: any[]; installments: any[]; clients: any[] }) => {
  const now = new Date();
  const overdue = data.installments.filter((i) => i.status === "pending" && new Date(i.due_date) < now);
  const overdueAmount = overdue.reduce((s, i) => s + Number(i.amount || 0), 0);
  const delinquencyRate = data.installments.length > 0 ? (overdue.length / data.installments.length) * 100 : 0;
  const activeCapital = data.contracts
    .filter((c) => c.status === "active" || c.status === "overdue")
    .reduce((s, c) => s + Number(c.capital || 0), 0);

  const predictive_cashflow = Array.from({ length: 4 }, (_, index) => {
    const target = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const expected = data.installments
      .filter((i) => {
        const due = new Date(i.due_date);
        return i.status === "pending" && due.getMonth() === target.getMonth() && due.getFullYear() === target.getFullYear();
      })
      .reduce((s, i) => s + Number(i.amount || 0), 0);
    const estimated = expected || activeCapital / 4;
    const riskAdjustment = Math.min(delinquencyRate / 100, 0.6);
    return {
      month: target.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      expected: Number(estimated.toFixed(2)),
      likely: Number((estimated * (1 - riskAdjustment)).toFixed(2)),
    };
  });

  const risk_assessment = delinquencyRate >= 35 ? "Crítico" : delinquencyRate >= 20 ? "Alto" : delinquencyRate >= 10 ? "Médio" : "Baixo";

  return {
    predictive_cashflow,
    risk_assessment,
    risk_reason: `${overdue.length} parcela(s) em atraso, somando R$ ${overdueAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    strategic_advice: [
      overdue.length > 0 ? "Priorize a cobrança dos contratos com maior valor vencido hoje." : "Mantenha a régua preventiva ativa antes dos próximos vencimentos.",
      delinquencyRate >= 20 ? "Reduza novas liberações para perfis com histórico recente de atraso." : "Acompanhe a expansão da carteira sem elevar concentração de risco.",
      "Revise diariamente a projeção de caixa e ajuste metas de recuperação por faixa de atraso.",
    ],
    top_client_segments: ["Atraso recorrente", "Alto valor em aberto", "Sem pagamento recente"],
    source: "local",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    let userId = claimsData?.claims?.sub as string | undefined;

    if (!userId) {
      const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
      userId = authData?.user?.id;
      if (authError || !userId) {
        console.warn("BI auth rejected:", claimsError?.message ?? authError?.message ?? "missing user");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }


    // 1. Fetch Global Data for Analysis
    const [contracts, installments, clients] = await Promise.all([
      supabaseClient.from("contracts").select("*").eq("user_id", userId),
      supabaseClient.from("contract_installments").select("*").eq("user_id", userId),
      supabaseClient.from("clients").select("*").eq("user_id", userId),
    ]);

    const queryError = contracts.error || installments.error || clients.error;
    if (queryError) {
      console.error("BI data query error:", queryError.message);
      return jsonResponse({ error: "Não foi possível carregar os dados da análise" }, 500);
    }

    const data = {
      contracts: contracts.data || [],
      installments: installments.data || [],
      clients: clients.data || [],
    };

    // Calculate basic stats
    const totalCapital = data.contracts.reduce((s, c) => s + Number(c.capital), 0);
    const overdueAmount = data.installments
      .filter(i => i.status === "pending" && new Date(i.due_date) < new Date())
      .reduce((s, i) => s + Number(i.amount), 0);
    
    const delinquencyRate = data.installments.length > 0 
      ? (data.installments.filter(i => i.status === "pending" && new Date(i.due_date) < new Date()).length / data.installments.length) * 100 
      : 0;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY not configured; returning local BI insights");
      return jsonResponse(buildLocalInsights(data));
    }

    const prompt = `
      Você é um especialista sênior em BI financeiro. 
      Analise os dados abaixo de uma empresa de crédito:
      - Capital Total: R$ ${totalCapital.toFixed(2)}
      - Em Atraso: R$ ${overdueAmount.toFixed(2)}
      - Inadimplência: ${delinquencyRate.toFixed(1)}%
      - Total Clientes: ${data.clients.length}
      
      Gere um relatório JSON estruturado com:
      1. predictive_cashflow: Array de 4 meses {month: string, expected: number, likely: number}
      2. risk_assessment: "Baixo", "Médio", "Alto" ou "Crítico"
      3. risk_reason: Justificativa curta
      4. strategic_advice: Array de 3 strings com conselhos táticos
      5. top_client_segments: Array de 3 strings com os segmentos de maior risco.
    `;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista de BI financeiro. Responda apenas com JSON puro, sem markdown." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return jsonResponse(buildLocalInsights(data));
    }

    const aiResult = await response.json();
    let content;
    try {
      content = JSON.parse(aiResult.choices[0].message.content);
    } catch (e) {
      // Fallback if not valid JSON
      console.error("Failed to parse AI response as JSON:", aiResult.choices[0].message.content);
      return jsonResponse(buildLocalInsights(data));
    }

    return jsonResponse(content);
  } catch (error) {
    console.error("Function error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
