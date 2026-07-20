// Checkout Transparente — processa pagamento gerado pelo Payment Brick do Mercado Pago
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/introduction
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN = {
  id: "credmais-mensal",
  title: "CredMais App — Acesso Ilimitado (Mensal)",
  amount: 79.0,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, 500);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Payload vem do Payment Brick { formData, selectedPaymentMethod }
  const formData = payload?.formData ?? payload;
  const selected: string = payload?.selectedPaymentMethod ?? formData?.payment_method_id ?? "";
  const extraEmail: string | undefined = payload?.email;
  const extraName: string | undefined = payload?.name;

  if (!formData) return json({ error: "missing_form_data" }, 400);

  // Monta corpo /v1/payments conforme docs (cartão, PIX ou boleto)
  const body: Record<string, unknown> = {
    transaction_amount: Number(formData.transaction_amount ?? PLAN.amount),
    description: PLAN.title,
    external_reference: PLAN.id,
    statement_descriptor: "CREDMAIS",
    metadata: { plan: PLAN.id, email: formData?.payer?.email ?? extraEmail ?? null },
    notification_url: `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/mercadopago-webhook`,
  };

  const method = (formData.payment_method_id ?? selected ?? "").toString();

  if (formData.token) {
    // Cartão de crédito/débito (token gerado pelo Brick)
    body.token = formData.token;
    body.installments = Number(formData.installments ?? 1);
    if (formData.payment_method_id) body.payment_method_id = formData.payment_method_id;
    if (formData.issuer_id) body.issuer_id = formData.issuer_id;
  } else if (method === "pix" || selected === "pix") {
    body.payment_method_id = "pix";
  } else if (method === "bolbradesco" || selected === "bolbradesco" || method === "boleto") {
    body.payment_method_id = "bolbradesco";
  } else if (method) {
    body.payment_method_id = method;
  }

  // Payer é obrigatório
  const payerIn = formData.payer ?? {};
  body.payer = {
    email: payerIn.email ?? extraEmail ?? "cliente@credmaisapp.com",
    first_name: payerIn.first_name ?? (extraName ? extraName.split(" ")[0] : undefined),
    last_name: payerIn.last_name ?? (extraName ? extraName.split(" ").slice(1).join(" ") || undefined : undefined),
    identification: payerIn.identification,
  };

  try {
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP /v1/payments error:", data);
      return json({ error: "mp_error", details: data }, 502);
    }

    // Retorna dados úteis: PIX (qr_code/qr_base64), boleto (external_resource_url), cartão (status)
    return json({
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      payment_method_id: data.payment_method_id,
      point_of_interaction: data.point_of_interaction ?? null,
      transaction_details: data.transaction_details ?? null,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
