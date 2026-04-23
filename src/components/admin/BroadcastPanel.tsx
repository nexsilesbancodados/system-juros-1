import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Megaphone, AlertCircle, Info, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Audience = "all" | "active" | "expired" | "blocked" | "monthly" | "yearly" | "admins";

export const BroadcastPanel = () => {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [audience, setAudience] = useState<Audience>("all");
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  const computeCount = async () => {
    let q = supabase.from("profiles").select("id", { count: "exact", head: true });
    const now = new Date().toISOString();
    if (audience === "active") q = q.eq("is_blocked", false).gt("subscription_expires_at", now);
    else if (audience === "expired") q = q.lt("subscription_expires_at", now);
    else if (audience === "blocked") q = q.eq("is_blocked", true);
    else if (audience === "monthly") q = q.eq("subscription_type", "monthly");
    else if (audience === "yearly") q = q.eq("subscription_type", "yearly");
    else if (audience === "admins") q = q.eq("is_admin", true);
    const { count } = await q;
    setRecipientCount(count || 0);
  };

  useEffect(() => { computeCount(); }, [audience]);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      let q = supabase.from("profiles").select("id");
      const now = new Date().toISOString();
      if (audience === "active") q = q.eq("is_blocked", false).gt("subscription_expires_at", now);
      else if (audience === "expired") q = q.lt("subscription_expires_at", now);
      else if (audience === "blocked") q = q.eq("is_blocked", true);
      else if (audience === "monthly") q = q.eq("subscription_type", "monthly");
      else if (audience === "yearly") q = q.eq("subscription_type", "yearly");
      else if (audience === "admins") q = q.eq("is_admin", true);

      const { data: targets, error } = await q;
      if (error) throw error;
      const rows = (targets || []).map((t: any) => ({
        user_id: t.id,
        message,
        from: "Administração",
        type,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from("notifications").insert(rows);
        if (insErr) throw insErr;
      }
      toast({ title: `Broadcast enviado para ${rows.length} usuário(s)` });
      setMessage("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const audienceOptions: { value: Audience; label: string }[] = [
    { value: "all", label: "Todos os usuários" },
    { value: "active", label: "Apenas ativos" },
    { value: "expired", label: "Plano expirado" },
    { value: "blocked", label: "Bloqueados" },
    { value: "monthly", label: "Plano mensal" },
    { value: "yearly", label: "Plano anual" },
    { value: "admins", label: "Apenas admins" },
  ];

  const typeIcons = {
    info: { icon: Info, color: "from-sky-500/20 to-sky-500/5 text-sky-400", label: "Informação" },
    warning: { icon: AlertCircle, color: "from-amber-500/20 to-amber-500/5 text-amber-500", label: "Aviso" },
    success: { icon: CheckCircle, color: "from-emerald-500/20 to-emerald-500/5 text-emerald-500", label: "Sucesso" },
  } as const;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Megaphone size={18} /> Comunicado em Massa
        </h2>
        <p className="text-sm text-muted-foreground">
          Envia notificação para múltiplos usuários do sistema.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {/* Audience */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Público-alvo
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {audienceOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setAudience(o.value)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  audience === o.value
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">{recipientCount}</strong> usuário(s) receberão esta mensagem.
          </p>
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tipo de notificação
          </label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(Object.keys(typeIcons) as Array<keyof typeof typeIcons>).map((k) => {
              const t = typeIcons[k];
              return (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    type === k ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                    <t.icon size={14} />
                  </div>
                  <span className="text-sm text-foreground">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Mensagem
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Digite a mensagem do comunicado..."
            className="w-full mt-2 px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">{message.length} caracteres</p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => setMessage("")}>Limpar</Button>
          <Button onClick={send} disabled={!message.trim() || sending || recipientCount === 0}>
            <Send size={14} className="mr-2" />
            {sending ? "Enviando..." : `Enviar para ${recipientCount}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
