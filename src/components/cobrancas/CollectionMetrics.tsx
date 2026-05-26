import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, MessageSquare, Mail, Target, Sparkles, Activity } from "lucide-react";

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const CollectionMetrics = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["collection-metrics", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const since = new Date(Date.now() - 30 * 86400000).toISOString();

      // 1. All collection messages in the last 30d
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("entity_id, details, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "auto_collection")
        .eq("action", "message_sent")
        .gte("created_at", since);

      const totalMsgs = logs?.length || 0;
      const wa = logs?.filter((l: any) => l.details?.channel === "whatsapp").length || 0;
      const email = logs?.filter((l: any) => l.details?.channel === "email").length || 0;
      const aiGen = logs?.filter((l: any) => l.details?.ai_generated).length || 0;
      const contactedClients = new Set(logs?.map((l: any) => l.entity_id)).size;

      // 2. Recovery: paid installments in same window
      const { data: paid } = await supabase
        .from("contract_installments")
        .select("client_id, paid_at, amount")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .gte("paid_at", since);

      const recoveredClients = new Set(
        paid?.filter((p: any) =>
          logs?.some((l: any) => l.entity_id === p.client_id && new Date(l.created_at) <= new Date(p.paid_at))
        ).map((p: any) => p.client_id)
      ).size;

      const recoveryRate = contactedClients ? (recoveredClients / contactedClients) * 100 : 0;
      const recoveredAmount = paid?.reduce((s: number, p: any) =>
        logs?.some((l: any) => l.entity_id === p.client_id) ? s + Number(p.amount) : s, 0
      ) || 0;

      // Avg response time (msg -> payment, hours)
      let avgHours = 0; let respCount = 0;
      paid?.forEach((p: any) => {
        const firstMsg = logs
          ?.filter((l: any) => l.entity_id === p.client_id && new Date(l.created_at) <= new Date(p.paid_at))
          ?.sort((a: any, b: any) => +new Date(a.created_at) - +new Date(b.created_at))[0];
        if (firstMsg) {
          avgHours += (+new Date(p.paid_at) - +new Date(firstMsg.created_at)) / 3600000;
          respCount++;
        }
      });
      avgHours = respCount ? avgHours / respCount : 0;

      return { totalMsgs, wa, email, aiGen, contactedClients, recoveredClients, recoveryRate, recoveredAmount, avgHours };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-card/40 border border-border/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { icon: Target, label: "Taxa Recuperação", value: fmtPct(data.recoveryRate), sub: `${data.recoveredClients}/${data.contactedClients} clientes`, color: "text-emerald-400" },
    { icon: TrendingUp, label: "Recuperado (30d)", value: `R$ ${data.recoveredAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, sub: "pós-cobrança", color: "text-blue-400" },
    { icon: MessageSquare, label: "WhatsApp", value: String(data.wa), sub: "mensagens", color: "text-green-400" },
    { icon: Mail, label: "Email", value: String(data.email), sub: "enviados", color: "text-amber-400" },
    { icon: Sparkles, label: "Geradas por IA", value: data.totalMsgs ? fmtPct((data.aiGen / data.totalMsgs) * 100) : "0%", sub: `${data.aiGen} mensagens`, color: "text-purple-400" },
    { icon: Activity, label: "Tempo Resposta", value: data.avgHours ? `${data.avgHours.toFixed(1)}h` : "—", sub: "msg → pago", color: "text-cyan-400" },
  ];

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground/90">Performance das Cobranças (últimos 30 dias)</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-card/60 backdrop-blur border border-border/50 p-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="text-xs text-muted-foreground truncate">{c.label}</div>
            <div className="text-lg font-bold text-foreground tracking-tight truncate">{c.value}</div>
            <div className="text-[10px] text-muted-foreground/70 truncate">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollectionMetrics;
