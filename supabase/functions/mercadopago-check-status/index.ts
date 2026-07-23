// Consulta pública do status de um pagamento no Mercado Pago
// Usada pelas telas de sucesso/pendente para fazer polling e mostrar estado real
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, 500);

  let id: string | null = null;
  try {
    if (req.method === "POST") {
      const b = await req.json();
      id = b?.id ? String(b.id) : null;
    } else {
      id = new URL(req.url).searchParams.get("id");
    }
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (!id) return json({ error: "missing_id" }, 400);

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return json({ error: "mp_error", details: data }, 502);
    // SEGURANÇA (M2): endpoint é público (polling do checkout antes do login), então
    // NÃO retornamos payer_email — isso permitia enumerar IDs e vazar e-mails de
    // clientes. Devolvemos apenas o necessário para a tela de status.
    return json({
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      payment_method_id: data.payment_method_id,
      transaction_amount: data.transaction_amount,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
