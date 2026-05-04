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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();

    const systemPrompt = `Você é o assistente IA do System Juros, um sistema avançado de gestão de crédito e cobranças.
    
    Contexto do Negócio:
    ${context ? `
    - Total de clientes: ${context.totalClients}
    - Clientes ativos: ${context.activeClients}
    - Total de contratos: ${context.totalContracts}
    - Contratos ativos: ${context.activeContracts}
    - Parcelas atrasadas: ${context.overdueCount}
    - Valor total atrasado: R$ ${context.overdueAmount}
    - Capital na rua: R$ ${context.capitalOnStreet}
    - Lucro total em juros: R$ ${context.totalProfit}
    - Parcelas vencendo hoje: ${context.dueTodayCount}
    ${context.clientsList ? `\nLista de clientes:\n${context.clientsList}` : ""}
    ${context.overdueDetails ? `\nDetalhes das parcelas atrasadas:\n${context.overdueDetails}` : ""}
    ` : "Dados do sistema não fornecidos."}

    Instruções:
    - Responda de forma executiva, profissional e estratégica.
    - Ajude o usuário a analisar riscos de crédito e sugerir estratégias de cobrança.
    - Use tabelas markdown para comparar dados quando possível.
    - Se o usuário pedir para enviar mensagens, explique que ele pode fazer isso na aba "WhatsApp" ou configurar o bot automático.
    - Nunca invente dados que não estão no contexto.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify({ error: errorData?.error?.message || "Erro na Lovable AI API" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("agent-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});