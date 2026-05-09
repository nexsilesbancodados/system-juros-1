
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
}

export async function sendEmail(payload: EmailPayload) {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY not set");
    return { error: "BREVO_API_KEY not set" };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "System Juros", email: "noreply@systemjuros.com.br" }, // TODO: Make dynamic if needed
      ...payload,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("Brevo API Error:", result);
    return { error: result };
  }

  return { success: true, result };
}

export const templates = {
  welcome: (name: string) => ({
    subject: "Bem-vindo ao System Juros! 🚀",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Olá, ${name}!</h2>
        <p>Estamos muito felizes em ter você conosco no <strong>System Juros</strong>.</p>
        <p>Sua conta foi criada com sucesso e seu <strong>teste grátis de 3 dias</strong> já está ativo!</p>
        <p>Aproveite todas as ferramentas de gestão de cobranças e automações para escalar seu negócio.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="https://app.systemjuros.com.br" style="background: #fbbf24; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Dashboard</a>
        </div>
        <p style="font-size: 12px; color: #666;">Se precisar de ajuda, responda a este e-mail.</p>
      </div>
    `
  }),
  trialExpiring: (name: string, daysLeft: number) => ({
    subject: `Seu teste grátis expira em ${daysLeft} dias! ⏳`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Olá, ${name}!</h2>
        <p>Passando para avisar que seu período de teste no <strong>System Juros</strong> termina em <strong>${daysLeft} dias</strong>.</p>
        <p>Para não perder o acesso às suas automações e dados, recomendamos que assine um de nossos planos agora mesmo.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="https://app.systemjuros.com.br/checkout" style="background: #fbbf24; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Renovar Assinatura</a>
        </div>
        <p style="font-size: 12px; color: #666;">Qualquer dúvida, estamos à disposição.</p>
      </div>
    `
  }),
  subscriptionActive: (name: string) => ({
    subject: "Assinatura Confirmada! 🎉",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Olá, ${name}!</h2>
        <p>Seu pagamento foi aprovado e sua assinatura no <strong>System Juros</strong> está <strong>Ativa</strong>!</p>
        <p>Agora você tem acesso ilimitado a todas as funcionalidades do sistema.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="https://app.systemjuros.com.br" style="background: #fbbf24; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir para o Sistema</a>
        </div>
      </div>
    `
  })
};
