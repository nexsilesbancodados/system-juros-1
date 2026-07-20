import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendEmail } from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email = "lopesgutsavo4377@gmail.com", name } = await req.json().catch(() => ({}));
    const displayName = name || email.split("@")[0];
    const siteUrl = Deno.env.get("SITE_URL") || "https://credmaisapp.com.br";
    const generatedPassword = "Teste1234!Ab";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 16px;">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="display:inline-block; padding:8px 16px; background:#EFF6FF; color:#1D4ED8; border-radius:999px; font-weight:700; font-size:12px; letter-spacing:1px;">CREDMAIS APP</div>
        </div>
        <h2 style="color: #0F172A; margin:0 0 12px;">Olá, ${displayName}! 👋</h2>
        <p style="color: #475569; line-height: 1.6; font-size:15px;">
          Este é um <strong>e-mail de teste</strong> mostrando exatamente o que o cliente recebe após a aprovação do pagamento no <strong>CredMais App</strong>.
        </p>
        <div style="margin:24px 0; padding:20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px;">
          <p style="margin:0 0 10px; font-size:12px; letter-spacing:1px; color:#64748B; font-weight:700;">SEUS DADOS DE ACESSO</p>
          <p style="margin:4px 0; color:#0F172A; font-size:15px;"><strong>E-mail:</strong> ${email}</p>
          <p style="margin:4px 0; color:#0F172A; font-size:15px;"><strong>Senha provisória:</strong>
            <code style="background:#0F172A; color:#F8FAFC; padding:4px 10px; border-radius:6px; font-size:15px; letter-spacing:1px;">${generatedPassword}</code>
          </p>
          <p style="margin:12px 0 0; font-size:12px; color:#DC2626;">⚠️ Por segurança, altere sua senha no primeiro acesso em <em>Configurações → Conta</em>.</p>
        </div>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${siteUrl}/auth" style="background: #3B82F6; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; font-size:15px;">Fazer login agora</a>
        </div>
        <p style="font-size: 12px; color: #94A3B8; text-align:center; margin-top:24px;">Precisa de ajuda? Responda este e-mail que nosso time atende você.</p>
      </div>
    `;

    const result = await sendEmail({
      to: [{ email, name: displayName }],
      subject: "🎉 [TESTE] Bem-vindo ao CredMais App — Seus dados de acesso",
      htmlContent: html,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
