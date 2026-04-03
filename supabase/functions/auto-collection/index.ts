import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EscalationRule {
  days: number;
  channel: string;
  template: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];

    // Get all users with bot enabled
    const { data: allSettings } = await supabase
      .from("settings")
      .select("*")
      .eq("bot_enabled", true);

    if (!allSettings || allSettings.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum bot ativo", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalSkipped = 0;
    const results: Array<{ user_id: string; sent: number; skipped: number; errors: string[] }> = [];

    for (const settings of allSettings) {
      const userId = settings.user_id;
      const errors: string[] = [];
      let sent = 0;
      let skipped = 0;

      // Check work days
      const workDays = (settings.bot_work_days as string[]) || ["mon", "tue", "wed", "thu", "fri"];
      if (!workDays.includes(dayOfWeek)) {
        skipped++;
        results.push({ user_id: userId, sent: 0, skipped: 1, errors: ["Dia não útil"] });
        continue;
      }

      // Check send hour
      const sendHour = settings.bot_send_hour ?? 9;
      const sendMinute = settings.bot_send_minute ?? 0;
      const currentHour = now.getUTCHours() - 3; // BRT offset
      // Only execute if within the configured hour (with 30min tolerance)
      if (Math.abs(currentHour - sendHour) > 1) {
        results.push({ user_id: userId, sent: 0, skipped: 1, errors: ["Fora do horário"] });
        continue;
      }

      // Get WhatsApp config
      const apiUrl = (settings.whatsapp_api_url || "").replace(/\/$/, "");
      const apiKey = settings.whatsapp_api_key || "";
      const instanceName = settings.whatsapp_instance || "";

      if (!apiUrl || !apiKey || !instanceName) {
        errors.push("WhatsApp não configurado");
        results.push({ user_id: userId, sent: 0, skipped: 0, errors });
        continue;
      }

      // Check daily message limit
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

      // Get escalation rules
      const escalationRules = (settings.bot_escalation_rules as EscalationRule[]) || [];
      if (escalationRules.length === 0) {
        errors.push("Sem regras de escalonamento");
        results.push({ user_id: userId, sent: 0, skipped: 0, errors });
        continue;
      }

      // Get overdue installments
      const { data: overdueInstallments } = await supabase
        .from("contract_installments")
        .select("id, amount, due_date, client_id, installment_number, late_fee")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lt("due_date", now.toISOString());

      if (!overdueInstallments || overdueInstallments.length === 0) {
        results.push({ user_id: userId, sent: 0, skipped: 0, errors: [] });
        continue;
      }

      // Get client details
      const clientIds = [...new Set(overdueInstallments.map(i => i.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, phone, whatsapp")
        .in("id", clientIds);

      const clientMap = new Map(clients?.map(c => [c.id, c]) || []);

      // Get user profile for message template
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, billing_message, pix_key, pix_key_type")
        .eq("id", userId)
        .single();

      // Get message templates
      const { data: templates } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      const companyName = settings.company_name || profile?.name || "Sistema Juros";

      // Group installments by client
      const byClient = new Map<string, typeof overdueInstallments>();
      for (const inst of overdueInstallments) {
        const list = byClient.get(inst.client_id) || [];
        list.push(inst);
        byClient.set(inst.client_id, list);
      }

      for (const [clientId, installments] of byClient) {
        if (sent >= remaining) break;

        const client = clientMap.get(clientId);
        if (!client) continue;

        const phone = client.whatsapp || client.phone;
        if (!phone) {
          skipped++;
          continue;
        }

        // Find the most overdue installment to determine escalation level
        const mostOverdue = installments.reduce((max, inst) => {
          const days = Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / 86400000);
          return days > max.days ? { days, inst } : max;
        }, { days: 0, inst: installments[0] });

        // Find matching escalation rule
        const matchingRule = escalationRules
          .sort((a, b) => b.days - a.days)
          .find(r => mostOverdue.days >= r.days);

        if (!matchingRule) continue;

        // Check if already sent for this rule today
        const { data: alreadySent } = await supabase
          .from("audit_logs")
          .select("id")
          .eq("user_id", userId)
          .eq("entity_type", "auto_collection")
          .eq("entity_id", clientId)
          .gte("created_at", `${todayStr}T00:00:00Z`)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          skipped++;
          continue;
        }

        // Check if payment was made (stop on payment)
        if (settings.bot_stop_on_payment) {
          const { data: recentPayments } = await supabase
            .from("contract_installments")
            .select("id")
            .eq("client_id", clientId)
            .eq("user_id", userId)
            .eq("status", "paid")
            .gte("paid_at", `${todayStr}T00:00:00Z`)
            .limit(1);

          if (recentPayments && recentPayments.length > 0) {
            skipped++;
            continue;
          }
        }

        // Build message
        const totalAmount = installments.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
        const template = templates?.find(t => t.name.toLowerCase().includes(matchingRule.template.toLowerCase()));

        let message = "";
        if (template) {
          message = template.content
            .replace(/\{nome\}/gi, client.name)
            .replace(/\{empresa\}/gi, companyName)
            .replace(/\{valor\}/gi, `R$ ${totalAmount.toFixed(2)}`)
            .replace(/\{parcelas\}/gi, String(installments.length))
            .replace(/\{dias\}/gi, String(mostOverdue.days));
        } else {
          // Default message
          const greeting = settings.bot_greeting_message
            ?.replace(/\{nome\}/gi, client.name)
            ?.replace(/\{empresa\}/gi, companyName) || `Olá ${client.name}`;

          message = `${greeting}\n\nIdentificamos ${installments.length} parcela(s) pendente(s) totalizando R$ ${totalAmount.toFixed(2)}.\n`;

          if (mostOverdue.days > 0) {
            message += `A parcela mais antiga está atrasada há ${mostOverdue.days} dia(s).\n`;
          }

          if (settings.bot_send_pix && profile?.pix_key) {
            message += `\n💰 PIX para pagamento: ${profile.pix_key} (${profile.pix_key_type || "Chave"})`;
          }

          const closing = settings.bot_closing_message || "Qualquer dúvida, entre em contato. Obrigado!";
          message += `\n\n${closing}`;
        }

        // Send via Evolution API
        if (matchingRule.channel === "whatsapp") {
          const cleanPhone = phone.replace(/\D/g, "");
          const recipient = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

          try {
            const sendResp = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: recipient, text: message }),
            });

            if (sendResp.ok) {
              sent++;

              // Log the sent message
              await supabase.from("audit_logs").insert({
                user_id: userId,
                entity_type: "auto_collection",
                action: "message_sent",
                entity_id: clientId,
                details: {
                  client_name: client.name,
                  phone: recipient,
                  rule: matchingRule,
                  days_overdue: mostOverdue.days,
                  amount: totalAmount,
                  installments_count: installments.length,
                },
              });
            } else {
              const errData = await sendResp.text();
              errors.push(`${client.name}: ${errData}`);
            }
          } catch (sendErr) {
            errors.push(`${client.name}: ${sendErr instanceof Error ? sendErr.message : "Erro de envio"}`);
          }
        }
      }

      totalSent += sent;
      totalSkipped += skipped;
      results.push({ user_id: userId, sent, skipped, errors });

      // Notify the user about the collection run
      if (sent > 0 && settings.bot_notify_owner) {
        await supabase.from("notifications").insert({
          user_id: userId,
          message: `🤖 Cobrança automática: ${sent} mensagem(ns) enviada(s) hoje.${errors.length > 0 ? ` ${errors.length} erro(s).` : ""}`,
          type: "collection_auto",
          from: "Bot de Cobranças",
          link: "/auditoria",
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Cobrança automática concluída`,
        total_sent: totalSent,
        total_skipped: totalSkipped,
        results,
      }),
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
