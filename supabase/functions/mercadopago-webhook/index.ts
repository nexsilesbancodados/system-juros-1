import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendEmail } from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

// Map Mercado Pago statuses -> our internal subscription status
function statusFromMP(status: string | undefined, statusDetail?: string): string {
  if (!status) return "inactive";
  if (status === "approved" || status === "authorized") return "active";
  if (status === "refunded" || status === "charged_back") return "refunded";
  if (status === "cancelled" || status === "rejected") return "canceled";
  return "inactive";
}

async function verifySignature(
  req: Request,
  rawBody: string,
  dataId: string | null,
  secret: string,
): Promise<boolean> {
  // Mercado Pago x-signature: "ts=xxxxx,v1=hash"
  const sigHeader = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Manifest per MP docs: id:{dataId};request-id:{requestId};ts:{ts};
  const manifest = `id:${dataId ?? ""};request-id:${requestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === v1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "";

    if (!accessToken || !webhookSecret) {
      console.error("MERCADOPAGO_ACCESS_TOKEN / MERCADOPAGO_WEBHOOK_SECRET not set");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const url = new URL(req.url);
    // data.id may come in body or querystring
    let dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
    let topic = url.searchParams.get("type") ?? url.searchParams.get("topic");

    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = {};
    }
    if (!dataId) dataId = payload?.data?.id?.toString() ?? payload?.id?.toString() ?? null;
    if (!topic) topic = payload?.type ?? payload?.topic ?? null;

    // Signature validation
    const valid = await verifySignature(req, rawBody, dataId, webhookSecret);
    if (!valid) {
      console.error("Invalid Mercado Pago signature");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`MP webhook: topic=${topic} id=${dataId}`);

    let email: string | undefined;
    let subscriptionStatus = "inactive";
    let orderId: string | undefined = dataId ?? undefined;
    let planName: string | undefined;
    let amountPaid: number | undefined;

    // Fetch full resource from MP API to trust its state
    if (topic === "payment" && dataId) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`MP payment lookup failed [${res.status}]:`, errText);
        return new Response(JSON.stringify({ error: "Provider lookup failed", details: errText }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payment = await res.json();
      email = payment?.payer?.email;
      subscriptionStatus = statusFromMP(payment?.status, payment?.status_detail);
      amountPaid = Number(payment?.transaction_amount ?? 0);
      planName = payment?.description ?? payment?.additional_info?.items?.[0]?.title;
      orderId = String(payment?.id ?? dataId);
    } else if ((topic === "subscription_preapproval" || topic === "preapproval") && dataId) {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`MP preapproval lookup failed [${res.status}]:`, errText);
        return new Response(JSON.stringify({ error: "Provider lookup failed", details: errText }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sub = await res.json();
      email = sub?.payer_email;
      const s = sub?.status;
      if (s === "authorized") subscriptionStatus = "active";
      else if (s === "paused") subscriptionStatus = "inactive";
      else if (s === "cancelled") subscriptionStatus = "canceled";
      amountPaid = Number(sub?.auto_recurring?.transaction_amount ?? 0);
      planName = sub?.reason;
      orderId = String(sub?.id ?? dataId);
    } else {
      console.log("Unhandled MP topic, acknowledging:", topic);
      return new Response(JSON.stringify({ message: "Ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email) {
      console.warn("No email in MP payload, ignoring");
      return new Response(JSON.stringify({ message: "No email found, ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("email", email)
      .maybeSingle();

    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          email,
          user_id: userData?.id || null,
          status: subscriptionStatus,
          mercadopago_payment_id: orderId,
          plan_name: planName,
          amount_paid: amountPaid,
          provider: "mercadopago",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

    if (subError) throw subError;

    // Send activation email
    if (subscriptionStatus === "active") {
      let actionLink: string | null = null;
      const siteUrl = Deno.env.get("SITE_URL") || "https://credmaisapp.com.br";
      try {
        const { data: linkData } = await (supabase as any).auth.admin.generateLink({
          type: userData ? "magiclink" : "invite",
          email,
          options: { redirectTo: `${siteUrl}/dashboard` },
        });
        actionLink = linkData?.properties?.action_link || null;
      } catch (e) {
        console.error("magic link generation failed:", e);
      }

      const displayName = (userData as any)?.name || email.split("@")[0];
      const ctaUrl = actionLink || siteUrl;
      const subject = userData
        ? "Assinatura ativa! Acesse sua conta — CredMais App 🎉"
        : "Bem-vindo ao CredMais App! Ative sua conta 🎉";
      const intro = userData
        ? "Seu pagamento foi aprovado e sua assinatura está <strong>Ativa</strong>! Clique no botão abaixo para entrar sem precisar de senha."
        : "Seu pagamento foi aprovado! Clique no botão abaixo para criar sua senha e acessar o <strong>CredMais App</strong>.";

      await sendEmail({
        to: [{ email, name: displayName }],
        subject,
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 16px;">
            <div style="text-align:center; margin-bottom:24px;">
              <div style="display:inline-block; padding:8px 16px; background:#EFF6FF; color:#1D4ED8; border-radius:999px; font-weight:700; font-size:12px; letter-spacing:1px;">CREDMAIS APP</div>
            </div>
            <h2 style="color: #0F172A; margin:0 0 12px;">Olá, ${displayName}!</h2>
            <p style="color: #475569; line-height: 1.6; font-size:15px;">${intro}</p>
            <div style="margin: 32px 0; text-align: center;">
              <a href="${ctaUrl}" style="background: #3B82F6; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; font-size:15px;">
                ${userData ? "Acessar Dashboard" : "Ativar minha conta"}
              </a>
            </div>
            <p style="font-size: 12px; color: #94A3B8; text-align:center;">Este link é único e expira em breve. Se precisar de ajuda, responda este e-mail.</p>
          </div>
        `,
      });
    }

    return new Response(
      JSON.stringify({ message: "Webhook processed", status: subscriptionStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("MP webhook error:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
