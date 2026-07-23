import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/brevo.ts";
import { callAnthropic } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EscalationRule {
  days: number;   // >0 = dias em atraso; <=0 = dias antes do vencimento (D-3 = -3)
  channel: string; // whatsapp | email | both
  template: string;
}

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

function buildNegotiationOffer(totalAmount: number, daysOverdue: number) {
  let discount = 0;
  let installments = 0;
  if (daysOverdue >= 60) { discount = 25; installments = 6; }
  else if (daysOverdue >= 30) { discount = 15; installments = 4; }
  else if (daysOverdue >= 15) { discount = 10; installments = 3; }
  else return null;
  const cashAmount = totalAmount * (1 - discount / 100);
  const perInstallment = totalAmount / installments;
  return {
    discount, cashAmount, installments, perInstallment,
    text: `\n\n💡 *Proposta de acordo:*\n• À vista com ${discount}% OFF: *R$ ${cashAmount.toFixed(2)}*\n• Em ${installments}x de R$ ${perInstallment.toFixed(2)}\n\nResponda *ACORDO* para negociar.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // SEGURANÇA (M4): cron protegido por segredo. FAIL-SAFE: só exige quando
  // CRON_SECRET estiver configurado nos secrets (senão apenas roda, como antes).
  if (Deno.env.get("CRON_SECRET") &&
      (req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret") ?? "") !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];

    const { data: allSettings } = await supabase.from("settings").select("*").eq("bot_enabled", true);
    if (!allSettings?.length) {
      return new Response(JSON.stringify({ message: "Nenhum bot ativo", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0, totalEmail = 0, totalSkipped = 0;
    const results: any[] = [];

    for (const settings of allSettings) {
      const userId = settings.user_id;
      const errors: string[] = [];
      let sent = 0, emailSent = 0, skipped = 0;

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
        .from("audit_logs").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("entity_type", "auto_collection")
        .eq("action", "message_sent").gte("created_at", `${todayStr}T00:00:00Z`);

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

      // Régua escalonada: separamos regras de pré-vencimento (days<=0) e atraso (days>0)
      const preDueRules  = escalationRules.filter(r => Number(r.days) <= 0).sort((a,b) => a.days - b.days); // -3 antes de -1
      const overdueRules = escalationRules.filter(r => Number(r.days) >  0).sort((a,b) => b.days - a.days); // 30 antes de 3

      // Janela de leitura das parcelas — pega o maior D-N configurado (default 7)
      const maxLookAhead = preDueRules.length
        ? Math.max(7, ...preDueRules.map(r => Math.abs(Number(r.days))))
        : 0;
      const lookAheadDate = new Date(now.getTime() + maxLookAhead * 86400000).toISOString();

      const { data: installments } = await supabase
        .from("contract_installments")
        .select("id, amount, due_date, client_id, installment_number, late_fee")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lte("due_date", lookAheadDate);

      if (!installments?.length) {
        results.push({ user_id: userId, sent: 0, skipped: 0, errors: [] });
        continue;
      }

      const clientIds = [...new Set(installments.map(i => i.client_id))];
      const { data: clients } = await supabase
        .from("clients").select("id, name, phone, whatsapp, email, credit_score").in("id", clientIds);
      const clientMap = new Map((clients || []).map(c => [c.id, c]));

      const { data: profile } = await supabase
        .from("profiles").select("name, billing_message, pix_key, pix_key_type").eq("id", userId).single();

      const { data: templates } = await supabase
        .from("message_templates").select("*").eq("user_id", userId).eq("is_active", true);

      const companyName = settings.company_name || profile?.name || "Sistema Juros";

      // Agrupa por cliente
      const byClient = new Map<string, typeof installments>();
      for (const inst of installments) {
        const list = byClient.get(inst.client_id) || [];
        list.push(inst);
        byClient.set(inst.client_id, list);
      }

      for (const [clientId, insts] of byClient) {
        if (sent + emailSent >= remaining) break;
        const client = clientMap.get(clientId);
        if (!client) continue;

        const phone = client.whatsapp || client.phone;
        const email = client.email;

        // Descobre parcela mais atrasada OU mais próxima do vencimento
        let selectedDays = -9999;   // valor "dias em atraso" (negativo = pré-vencimento)
        let selectedInst = insts[0];
        for (const i of insts) {
          const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
          if (days > selectedDays) { selectedDays = days; selectedInst = i; }
        }

        // Escolhe a regra: se está em atraso, usa a maior faixa vencida atingida;
        // caso contrário, tenta bater com uma regra pré-vencimento (D-N).
        let matchingRule: EscalationRule | undefined;
        let isPreDue = false;
        if (selectedDays > 0) {
          matchingRule = overdueRules.find(r => selectedDays >= r.days);
        } else {
          // pré-vencimento — só dispara EXATAMENTE no dia D-N configurado
          const daysUntilDue = Math.abs(selectedDays); // 0,1,2,3...
          matchingRule = preDueRules.find(r => Math.abs(Number(r.days)) === daysUntilDue);
          isPreDue = !!matchingRule;
        }
        if (!matchingRule) continue;

        // Cooldown: pré-vencimento = 1x/dia; atraso segue severidade
        const cooldownHours = isPreDue ? 20
          : selectedDays >= 30 ? 5
          : selectedDays >= 8 ? 8 : 24;
        const cutoff = new Date(now.getTime() - cooldownHours * 3600000).toISOString();

        const { data: alreadySent } = await supabase
          .from("audit_logs").select("id, created_at")
          .eq("user_id", userId).eq("entity_type", "auto_collection")
          .eq("entity_id", clientId).gte("created_at", cutoff).limit(1);
        if (alreadySent?.length) { skipped++; continue; }

        const { data: history } = await supabase
          .from("contract_installments").select("status, paid_at, due_date")
          .eq("user_id", userId).eq("client_id", clientId)
          .order("due_date", { ascending: false }).limit(20);

        const paidCount = history?.filter(h => h.status === "paid").length || 0;
        const lateCount = history?.filter(h =>
          h.status === "paid" && h.paid_at && new Date(h.paid_at) > new Date(h.due_date)
        ).length || 0;
        const totalHist = history?.length || 0;
        const reliability = totalHist ? Math.round((paidCount / totalHist) * 100) : 0;

        const totalAmount = insts.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
        let message = "";
        const daysOverdue = Math.max(0, selectedDays);
        const daysUntilDue = Math.max(0, -selectedDays);

        if (settings.bot_use_ai && anthropicKey) {
          try {
            const tone = settings.bot_tone || "profissional";
            const severity = isPreDue ? "AMIGÁVEL — só um lembrete gentil"
              : selectedDays >= 30 ? "FIRME e direta"
              : selectedDays >= 15 ? "assertiva mas respeitosa"
              : selectedDays >= 7 ? "preocupada e clara"
              : "amigável e gentil";
            const systemPrompt = `Você é especialista em recuperação de crédito da empresa ${companyName}. Tom: ${tone}. Severidade atual: ${severity}. NUNCA diga que é uma IA. Use português brasileiro. Máximo 4 linhas curtas. Emojis discretos (1-2). Gere APENAS o texto da mensagem, sem aspas, sem comentários.`;
            const userPrompt = `Gere mensagem WhatsApp personalizada:
CLIENTE: ${client.name}
${isPreDue ? `PARCELA VENCE EM ${daysUntilDue} DIA(S)` : `PARCELA EM ATRASO: ${daysOverdue} DIA(S)`}
VALOR: R$ ${totalAmount.toFixed(2)} (${insts.length} parcela(s))
SCORE: ${client.credit_score ?? 100}/100
HISTÓRICO: ${paidCount}/${totalHist} pagas (${reliability}% confiabilidade)
${isPreDue ? "Apenas LEMBRE, sem cobrar. Sugira o pagamento antecipado via PIX." : ""}
${settings.bot_negotiation_enabled && selectedDays >= 15 ? "MENCIONE proposta de acordo abaixo." : ""}`;
            message = await callAnthropic({
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }],
              temperature: 0.75, maxTokens: 400,
            });
            message = (message || "").trim();
          } catch (aiErr) { console.error("Anthropic fail:", aiErr); }
        }

        if (!message) {
          const template = templates?.find(t => t.name.toLowerCase().includes(matchingRule.template.toLowerCase()));
          if (template) {
            message = template.content
              .replace(/\{nome\}/gi, client.name).replace(/\{empresa\}/gi, companyName)
              .replace(/\{valor\}/gi, `R$ ${totalAmount.toFixed(2)}`)
              .replace(/\{parcelas\}/gi, String(insts.length))
              .replace(/\{dias\}/gi, String(isPreDue ? daysUntilDue : daysOverdue));
          } else {
            const greeting = settings.bot_greeting_message
              ?.replace(/\{nome\}/gi, client.name)?.replace(/\{empresa\}/gi, companyName) || `Olá ${client.name}`;
            if (isPreDue) {
              message = `${greeting}\n\n⏰ Só um lembrete: sua parcela de R$ ${totalAmount.toFixed(2)} vence em ${daysUntilDue} dia(s).\nSe preferir, já deixe o pagamento agendado.`;
            } else {
              message = `${greeting}\n\nIdentificamos ${insts.length} parcela(s) pendente(s) totalizando R$ ${totalAmount.toFixed(2)}.\nAtraso de ${daysOverdue} dia(s).\n\n${settings.bot_closing_message || "Qualquer dúvida, entre em contato."}`;
            }
          }
        }

        if (!isPreDue && settings.bot_negotiation_enabled) {
          const offer = buildNegotiationOffer(totalAmount, daysOverdue);
          if (offer) message += offer.text;
        }

        if (settings.bot_send_pix && profile?.pix_key) {
          try {
            const pixCode = generatePixCopyPaste(profile.pix_key, totalAmount, companyName);
            message += `\n\n💳 *PIX para pagamento*\nChave: ${profile.pix_key}\n\n*Copia e Cola:*\n\`${pixCode}\``;
          } catch { message += `\n\n💰 PIX: ${profile.pix_key}`; }
        }

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
              waOk = true; sent++;
              await supabase.from("audit_logs").insert({
                user_id: userId, entity_type: "auto_collection", action: "message_sent",
                entity_id: clientId,
                details: {
                  client_name: client.name, phone: recipient, channel: "whatsapp",
                  rule: matchingRule, days_overdue: daysOverdue, days_until_due: daysUntilDue,
                  pre_due: isPreDue, amount: totalAmount, reliability, ai_generated: !!settings.bot_use_ai,
                },
              });
            } else { errors.push(`${client.name}: ${await sendResp.text()}`); }
          } catch (err) { errors.push(`${client.name}: ${err instanceof Error ? err.message : "Erro envio"}`); }
        }

        const shouldEmail = email && (
          matchingRule.channel === "email" || matchingRule.channel === "both" ||
          (!waOk && !waConfigured) || (!waOk && daysOverdue >= 15) || daysOverdue >= 30
        );

        if (shouldEmail) {
          const subject = isPreDue
            ? `⏰ Lembrete: parcela vence em ${daysUntilDue} dia(s) - ${companyName}`
            : daysOverdue >= 30
              ? `⚠️ Pendência ${daysOverdue} dias em atraso - ${companyName}`
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
                user_id: userId, entity_type: "auto_collection", action: "message_sent",
                entity_id: clientId,
                details: {
                  client_name: client.name, email, channel: "email",
                  rule: matchingRule, days_overdue: daysOverdue, days_until_due: daysUntilDue,
                  pre_due: isPreDue, amount: totalAmount, reliability, ai_generated: !!settings.bot_use_ai,
                },
              });
            } else { errors.push(`${client.name} (email): ${JSON.stringify(res.error).slice(0, 120)}`); }
          } catch (err) { errors.push(`${client.name} (email): ${err instanceof Error ? err.message : "Erro"}`); }
        }
      }

      totalSent += sent; totalEmail += emailSent; totalSkipped += skipped;
      results.push({ user_id: userId, sent, email_sent: emailSent, skipped, errors });

      if ((sent + emailSent) > 0 && settings.bot_notify_owner) {
        await supabase.from("notifications").insert({
          user_id: userId,
          message: `🤖 Bot: ${sent} WhatsApp + ${emailSent} email enviados${settings.bot_use_ai ? " (IA)" : ""}.`,
          type: "collection_auto", from: "Bot de Cobranças", link: "/auditoria",
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
