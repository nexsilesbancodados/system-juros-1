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

// Basic PIX Static Code Generator (Minimal implementation)
function generatePixCopyPaste(pixKey: string, amount: number, merchantName: string = "SISTEMA JUROS") {
  // This is a simplified static PIX generator
  // Merchant Account Information
  const gui = "000201";
  const merchantAccount = "26";
  const pixGui = "0014br.gov.bcb.pix";
  const pixKeyTag = `01${pixKey.length.toString().padStart(2, "0")}${pixKey}`;
  const merchantAccountInfo = `${merchantAccount}${(pixGui.length + pixKeyTag.length).toString().padStart(2, "0")}${pixGui}${pixKeyTag}`;
  
  const merchantCategory = "52040000";
  const currency = "5303986";
  const amountStr = amount.toFixed(2);
  const transactionAmount = `54${amountStr.length.toString().padStart(2, "0")}${amountStr}`;
  const countryCode = "5802BR";
  const merchantNameTag = `59${merchantName.substring(0, 25).length.toString().padStart(2, "0")}${merchantName.substring(0, 25).toUpperCase()}`;
  const merchantCity = "6009SAO PAULO";
  const additionalData = "62070503***";
  
  const payload = `${gui}${merchantAccountInfo}${merchantCategory}${currency}${transactionAmount}${countryCode}${merchantNameTag}${merchantCity}${additionalData}6304`;
  
  // CRC16 Calculation (Simplified for the sake of the bot)
  // In a real scenario, we'd use a proper CRC16-CCITT (0xFFFF)
  // For now, let's just return the payload + a dummy CRC or use a library if possible.
  // Since we are in Deno without many libs, we'll use a standard CRC16 implementation.
  
  function crc16(data: string) {
    let crc = 0xFFFF;
    const bytes = new TextEncoder().encode(data);
    for (const b of bytes) {
      crc ^= (b << 8);
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc = crc << 1;
        }
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
  }

  return payload + crc16(payload);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

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
      const currentHour = now.getUTCHours() - 3; // BRT offset
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

      // Get user profile for details
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, billing_message, pix_key, pix_key_type")
        .eq("id", userId)
        .single();

      // Get active templates
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

        // Find escalation level
        const mostOverdue = installments.reduce((max, inst) => {
          const days = Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / 86400000);
          return days > max.days ? { days, inst } : max;
        }, { days: 0, inst: installments[0] });

        const matchingRule = escalationRules
          .sort((a, b) => b.days - a.days)
          .find(r => mostOverdue.days >= r.days);

        if (!matchingRule) continue;

        // Check frequency
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

        // Build message
        const totalAmount = installments.reduce((s, i) => s + Number(i.amount) + (Number(i.late_fee) || 0), 0);
        let message = "";

        // AI Generation Priority
        if (settings.bot_use_ai && lovableApiKey) {
          try {
            const tone = settings.bot_tone || "profissional e educado";
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { 
                    role: "system", 
                    content: `Você é um assistente de cobrança inteligente para a empresa ${companyName}. Seu objetivo é recuperar o crédito de forma eficaz, mantendo o bom relacionamento com o cliente. Tom de voz: ${tone}.` 
                  },
                  { 
                    role: "user", 
                    content: `Gere uma mensagem curta e objetiva para o cliente ${client.name}. 
                    Dados da dívida:
                    - Valor total: R$ ${totalAmount.toFixed(2)}
                    - Quantidade de parcelas: ${installments.length}
                    - Atraso máximo: ${mostOverdue.days} dias.
                    
                    Regras:
                    - Use emojis discretos.
                    - Não mencione que você é uma IA.
                    - Se for o primeiro contato (0-5 dias de atraso), seja muito amigável.
                    - Se for um atraso longo (30+ dias), seja firme mas profissional.
                    - Mencione que o pagamento pode ser feito via PIX.` 
                  }
                ],
                temperature: 0.7,
              })
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              message = aiData.choices?.[0]?.message?.content?.trim() || "";
            }
          } catch (aiErr) {
            console.error("AI Generation failed:", aiErr);
          }
        }

        // Fallback to templates or default
        if (!message) {
          const template = templates?.find(t => t.name.toLowerCase().includes(matchingRule.template.toLowerCase()));
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
            
            const closing = settings.bot_closing_message || "Qualquer dúvida, entre em contato. Obrigado!";
            message += `\n${closing}`;
          }
        }

        // Add PIX if enabled
        if (settings.bot_send_pix && profile?.pix_key) {
          try {
            const pixCode = generatePixCopyPaste(profile.pix_key, totalAmount, companyName);
            message += `\n\n💳 *Pagamento via PIX*\nChave: ${profile.pix_key}\n\n*Copia e Cola:*\n\`${pixCode}\``;
          } catch (pixErr) {
            message += `\n\n💰 *PIX para pagamento:*\n${profile.pix_key} (${profile.pix_key_type || "Chave"})`;
          }
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
                  method: "whatsapp_bot",
                  ai_generated: settings.bot_use_ai
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

      if (sent > 0 && settings.bot_notify_owner) {
        await supabase.from("notifications").insert({
          user_id: userId,
          message: `🤖 Bot: ${sent} cobranças enviadas${settings.bot_use_ai ? " (com IA)" : ""}.`,
          type: "collection_auto",
          from: "Bot de Cobranças",
          link: "/auditoria",
        });
      }
    }

    return new Response(
      JSON.stringify({ message: `Sucesso`, total_sent: totalSent, total_skipped: totalSkipped, results }),
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