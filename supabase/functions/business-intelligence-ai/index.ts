import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error("User ID is required");
    }

    // 1. Fetch Global Data for Analysis
    const [contracts, installments, clients, transactions] = await Promise.all([
      supabaseClient.from("contracts").select("*").eq("user_id", user_id),
      supabaseClient.from("contract_installments").select("*").eq("user_id", user_id),
      supabaseClient.from("clients").select("*").eq("user_id", user_id),
      supabaseClient.from("transactions").select("*").eq("user_id", user_id),
    ]);

    const data = {
      contracts: contracts.data || [],
      installments: installments.data || [],
      clients: clients.data || [],
      transactions: transactions.data || [],
    };

    // Calculate basic stats for the prompt
    const totalCapital = data.contracts.reduce((s, c) => s + Number(c.capital), 0);
    const overdueAmount = data.installments
      .filter(i => i.status === "pending" && new Date(i.due_date) < new Date())
      .reduce((s, i) => s + Number(i.amount), 0);
    
    const delinquencyRate = data.installments.length > 0 
      ? (data.installments.filter(i => i.status === "pending" && new Date(i.due_date) < new Date()).length / data.installments.length) * 100 
      : 0;

    // AI Intelligence prompt
    const prompt = `
      Você é um especialista sênior em análise de crédito e BI para empresas de fomento e crédito privado.
      Analise os seguintes dados agregados de uma carteira de crédito:
      - Capital Total Emprestado: R$ ${totalCapital.toFixed(2)}
      - Valor em Atraso: R$ ${overdueAmount.toFixed(2)}
      - Taxa de Inadimplência Atual: ${delinquencyRate.toFixed(1)}%
      - Total de Clientes: ${data.clients.length}
      - Total de Contratos: ${data.contracts.length}
      
      Histórico Recente de Pagamentos (Atrasos médios, frequências):
      ${JSON.stringify(data.installments.filter(i => i.status === 'paid').slice(0, 50).map(i => ({
        due: i.due_date,
        paid: i.paid_at,
        amount: i.amount
      })))}

      Com base nisso, forneça em JSON:
      1. predictive_cashflow: Uma projeção para os próximos 4 meses (vencimento_esperado vs recebimento_provavel baseado no comportamento de atraso).
      2. risk_assessment: Uma classificação de risco global (Low, Medium, High, Critical) e o motivo.
      3. strategic_advice: 3 recomendações práticas para reduzir a inadimplência e aumentar a rentabilidade.
      4. top_client_segments: Onde está o maior risco (ex: contratos semanais, clientes novos, etc).
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um analista de BI financeiro que responde apenas em JSON estruturado." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiResult = await response.json();
    const content = JSON.parse(aiResult.choices[0].message.content);

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
