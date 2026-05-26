import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EscalationRule {
  days: number;
  channel: string; // whatsapp | email | both
  template: string;
}

// ---------- PIX ----------
function generatePixCopyPaste(pixKey: string, amount: number, merchantName = "SISTEMA JUROS") {
  const gui = "000201";
  const pixGui = "0014br.gov.bcb.pix";
  const pixKeyTag = `01${pixKey.length.toString().padStart(2, "0")}${pixKey}`;
  const merchantAccountInfo = `26${(pixGui.length + pixKeyTag.length).toString().padStart(2, "0")}${pixGui}${pixKeyTag}`;
  const merchantCategory = "52040000";
  const currency = "5303986";
  const amountStr = amount.toFixed(2);
  const transactionAmount = `54${amountStr.length.toString().padStart(2, "0")}${amountStr}`;
  const countryCode = "5802BR";
  const name = merchantName.substring(0, 25).toUpperCase();
  const merchantNameTag = `59${name.length.toString().padStart(2, "0")}${name}`;
  const merchantCity = "6009SAO PAULO";
  const additionalData = "62070503***";
  const payload = `${gui}${merchantAccountInfo}${merchantCategory}${currency}${transactionAmount}${countryCode}${merchantNameTag}${merchantCity}${additionalData}6304`;
  let crc = 0xFFFF;
  for (const b of new TextEncoder().encode(payload)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}

// ---------- Negotiation offer ----------
function buildNegotiationOffer(totalAmount: number, daysOverdue: number) {
  // More aggressive discounts for longer overdue periods
  let discount = 0;
  let installments = 0;
  if (daysOverdue >= 60) { discount = 25; installments = 6; }
  else if (daysOverdue >= 30) { discount = 15; installments = 4; }
  else if (daysOverdue >= 15) { discount = 10; installments = 3; }
  else return null;

  const cashAmount = totalAmount * (1 - discount / 100);
  const perInstallment = totalAmount / installments;
  return {
    discount,
    cashAmount,
    installments,
    perInstallment,
    text: `\n\n💡 *Proposta de acordo:*\n• À vista com ${discount}% OFF: *R$ ${cashAmount.toFixed(2)}*\n• Em ${installments}x de R$ ${perInstallment.toFixed(2)}\n\nResponda *ACORDO* para negociar.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];

    const { data: allSettings } = await supabase.from("settings").select("*").eq("bot_enabled", true);
    if (!allSettings?.length) {
      return new Response(JSON.stringify({ message: "Nenhum bot ativo", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalEmail = 0;
    let totalSkipped = 0;
    const results: any[] = [];

    for (const settings of allSettings) {
      const userId = settings.user_id;
      const errors: string[] = [];
      let sent = 0;
      let emailSent = 0;
      let skipped = 0;

      const workDays = (settings.bot_work_days as string[]) || ["mon", "tue", "wed", "thu", "fri"];
      if (!workDays.includes(dayOfWeek)) {
        results.push({ user_id: userId, sent: 0, skipped: 1, errors: ["Dia não útil"] });
        continue;
      }

      const apiUrl = (settings.whatsapp_api_url || "").replace(/\/$/, "");
      const apiKey = settings.whatsapp_api_key || "";
      const instanceName = settings.whatsapp_instance || "";
      const waConfigured = apiUrl && apiKey && instanceName;

      const { count: sentToday } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("entity_type", "auto_collection")
        .eq("action", "message_sent")
        .gte("created_at", `${todayStr}T00:00:00Z`);

      const maxPerDay = settings.bot_max_messages_per_day ?? 50;
      if ((sentToday || 0) >= maxPerDay) {
        results.push({ user_id: userId, sent: 0, skipped: 1, errors: ["Limite diário atingido"] });
        continue;
      }
      const remaining = maxPerDay - (sentToday || 0);

      const escalationRules = (settings.bot_escalation_rules as EscalationRule[]) || [];
      if (!escalationRules.length) {
        results.push({ user_id: userId, sent: 0, skipped: 0, errors: ["Sem regras"] });
        continue;
      }

      const { data: overdueInstallments } = await supabase
        .from("contract_installments")
        .select("id, amount, due_date, client_id, installment_number, late_fee")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lt("due_date", now.toISOString());

      if (!overdueInstallments?.length) {
        results.push({ user_id: userId, sent: 0, skipped: 0, errors: [] });
        continue;
      }

      const clientIds = [...new Set(overdueInstallments.map(i => i.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, phone, whatsapp, email, credit_score")
        .in("id", clientIds);
      const clientMap = new Map((clients || []).map(c => [c.id, c]));

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, billing_message, pix_key, pix_key_type")
        .eq("id", userId)
        .single();

      const { data: templates } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      const companyName = settings.company_name || profile?.name || "Sistema Juros";

      // Group by client
      const byClient = new Map<string, typeof overdueInstallments>();
      for (const inst of overdueInstallments) {
        const list = byClient.get(inst.client_id) || [];
        list.push(inst);
        byClient.set(inst.client_id, list);
      }

      for (const [clientId, installments] of byClient) {
        if (sent + emailSent >= remaining) break;
        const client = clientMap.get(clientId);
        if (!client) continue;

        const phone = client.whatsapp || client.phone;
        const email = client.email;

        const mostOverdue = installments.reduce((max, inst) => {
          const days = Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / 86400000);
          return days > max.days ? { days, inst } : max;
        }, { days: 0, inst: installments[0] });

        const matchingRule = escalationRules
          .sort((a, b) => b.days - a.days)
          .find(r => mostOverdue.days >= r.days);
        if (!matchingRule) continue;

        // Aggressive cooldown: based on overdue severity
        // 0-7d: 1x/day; 8-29d: 2x/day (8h); 30+d: 3x/day (5h)
        const cooldownHours = mostOverdue.days >= 30 ? 5 : mostOverdue.days >= 8 ? 8 : 24;
        const cutoff = new Date(now.getTime() - cooldownHours * 3600000).toISOString();

        const { data: alreadySent } = await supabase
          .from("audit_logs")
          .select("id, created_at")
          .eq("user_id", userId)
          .eq("entity_type", "auto_collection")
          .eq("entity_id", clientId)
          .gte("created_at", cutoff)
          .limit(1);

        if (alreadySent?.length) { skipped++; continue; }

        // ----- Payment history context for AI -----
        const { data: history } = await supabase
          .from("contract_installments")
          .select("status, paid_at, due_date")
          .eq("user_id", userId)
          .eq("client_id", clientId)
          .order("due_date", { ascending: false })
          .limit(20);

        const paidCount = history?.filter(h => h.status === "paid").length || 0;
        const lateCount = history?.filter(h =>
          h.status === "paid" && h.paid_at && new Date(h.paid_at) > new Date(h.due_date)
        ).length || 0;
        const totalHist = history?.length || 0;
        const reliability = totalHist ? Math.round((paidCount / totalHist) * 100) : 0;

        const totalAmount = installments.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
        let message = "";

        // ----- AI generation -----
        if (settings.bot_use_ai && lovableApiKey) {
          try {
            const tone = settings.bot_tone || "profissional";
            const severity = mostOverdue.days >= 30 ? "FIRME e direta"
              : mostOverdue.days >= 15 ? "assertiva mas respeitosa"
              : mostOverdue.days >= 7 ? "preocupada e clara"
              : "amigável e gentil";

            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  {
                    role: "system",
                    content: `Você é especialista em recuperação de crédito da empresa ${companyName}. Tom: ${tone}. Severidade atual: ${severity}. NUNCA diga que é uma IA. Use português brasileiro. Máximo 4 linhas curtas. Emojis discretos (1-2).`,
                  },
                  {
                    role: "user",
                    content: `Gere mensagem WhatsApp personalizada para cobrança:

CLIENTE: ${client.name}
DÍVIDA: R$ ${totalAmount.toFixed(2)} (${installments.length} parcela(s))
ATRASO: ${mostOverdue.days} dia(s)
SCORE INTERNO: ${client.credit_score ?? 100}/100
HISTÓRICO: ${paidCount} pagas de ${totalHist} (${reliability}% confiabilidade), ${lateCount} pagas em atraso
${settings.bot_negotiation_enabled && mostOverdue.days >= 15 ? "MENCIONE que há proposta de acordo abaixo." : ""}
${reliability >= 80 ? "Cliente bom pagador — reconheça isso." : reliability < 40 && totalHist > 3 ? "Cliente recorrente em atraso — seja mais firme." : ""}

Gere APENAS o texto da mensagem, sem aspas, sem comentários.`,
                  },
                ],
                temperature: 0.75,
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              message = aiData.choices?.[0]?.message?.content?.trim() || "";
            }
          } catch (aiErr) {
            console.error("AI fail:", aiErr);
          }
        }

        // Fallback
        if (!message) {
          const template = templates?.find(t =>
            t.name.toLowerCase().includes(matchingRule.template.toLowerCase())
          );
          if (template) {
            message = template.content
              .replace(/\{nome\}/gi, client.name)
              .replace(/\{empresa\}/gi, companyName)
              .replace(/\{valor\}/gi, `R$ ${totalAmount.toFixed(2)}`)
              .replace(/\{parcelas\}/gi, String(installments.length))
              .replace(/\{dias\}/gi, String(mostOverdue.days));
          } else {
            const greeting = settings.bot_greeting_message
              ?.replace(/\{nome\}/gi, client.name)
              ?.replace(/\{empresa\}/gi, companyName) || `Olá ${client.name}`;
            message = `${greeting}\n\nIdentificamos ${installments.length} parcela(s) pendente(s) totalizando R$ ${totalAmount.toFixed(2)}.\n`;
            if (mostOverdue.days > 0) message += `Atraso de ${mostOverdue.days} dia(s).\n`;
            message += `\n${settings.bot_closing_message || "Qualquer dúvida, entre em contato."}`;
          }
        }

        // ----- Negotiation offer -----
        if (settings.bot_negotiation_enabled) {
          const offer = buildNegotiationOffer(totalAmount, mostOverdue.days);
          if (offer) message += offer.text;
        }

        // ----- PIX -----
        if (settings.bot_send_pix && profile?.pix_key) {
          try {
            const pixCode = generatePixCopyPaste(profile.pix_key, totalAmount, companyName);
            message += `\n\n💳 *PIX para pagamento*\nChave: ${profile.pix_key}\n\n*Copia e Cola:*\n\`${pixCode}\``;
          } catch {
            message += `\n\n💰 PIX: ${profile.pix_key}`;
          }
        }

        // ----- Send WhatsApp -----
        let waOk = false;
        if (waConfigured && phone && (matchingRule.channel === "whatsapp" || matchingRule.channel === "both" || !matchingRule.channel)) {
          const cleanPhone = phone.replace(/\D/g, "");
          const recipient = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
          try {
            const sendResp = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: recipient, text: message }),
            });
            if (sendResp.ok) {
              waOk = true;
              sent++;
              await supabase.from("audit_logs").insert({
                user_id: userId,
                entity_type: "auto_collection",
                action: "message_sent",
                entity_id: clientId,
                details: {
                  client_name: client.name, phone: recipient, channel: "whatsapp",
                  rule: matchingRule, days_overdue: mostOverdue.days, amount: totalAmount,
                  reliability, ai_generated: !!settings.bot_use_ai,
                },
              });
            } else {
              errors.push(`${client.name}: ${await sendResp.text()}`);
            }
          } catch (err) {
            errors.push(`${client.name}: ${err instanceof Error ? err.message : "Erro envio"}`);
          }
        }

        // ----- Email fallback / parallel -----
        const shouldEmail =
          email && (
            matchingRule.channel === "email" ||
            matchingRule.channel === "both" ||
            (!waOk && !waConfigured) ||                       // WA não configurado
            (!waOk && mostOverdue.days >= 15) ||              // WA falhou e atraso alto
            mostOverdue.days >= 30                            // sempre dispara para 30+ dias
          );

        if (shouldEmail) {
          const subject = mostOverdue.days >= 30
            ? `⚠️ Pendência ${mostOverdue.days} dias em atraso - ${companyName}`
            : `Lembrete de pagamento - ${companyName}`;
          const html = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px">
              <h2 style="color:#1e293b">Olá, ${client.name}</h2>
              <div style="background:white;padding:20px;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap;line-height:1.6;color:#334155">${message.replace(/</g, "&lt;")}</div>
              <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:24px">Mensagem automática de ${companyName}.</p>
            </div>`;
          try {
            const res = await sendEmail({ to: [{ email, name: client.name }], subject, htmlContent: html });
            if (!res.error) {
              emailSent++;
              await supabase.from("audit_logs").insert({
                user_id: userId,
                entity_type: "auto_collection",
                action: "message_sent",
                entity_id: clientId,
                details: {
                  client_name: client.name, email, channel: "email",
                  rule: matchingRule, days_overdue: mostOverdue.days, amount: totalAmount,
                  reliability, ai_generated: !!settings.bot_use_ai,
                },
              });
            } else {
              errors.push(`${client.name} (email): ${JSON.stringify(res.error).slice(0, 120)}`);
            }
          } catch (err) {
            errors.push(`${client.name} (email): ${err instanceof Error ? err.message : "Erro"}`);
          }
        }
      }

      totalSent += sent;
      totalEmail += emailSent;
      totalSkipped += skipped;
      results.push({ user_id: userId, sent, email_sent: emailSent, skipped, errors });

      if ((sent + emailSent) > 0 && settings.bot_notify_owner) {
        await supabase.from("notifications").insert({
          user_id: userId,
          message: `🤖 Bot: ${sent} WhatsApp + ${emailSent} email enviados${settings.bot_use_ai ? " (IA)" : ""}.`,
          type: "collection_auto",
          from: "Bot de Cobranças",
          link: "/auditoria",
        });
      }
    }

    return new Response(
      JSON.stringify({ message: "Sucesso", total_sent: totalSent, total_email: totalEmail, total_skipped: totalSkipped, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-collection error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
