import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bot, MessageCircle, AlertTriangle, CheckCircle2, Clock, TrendingUp, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Kpis {
  totalMsgs: number;
  aiMsgs: number;
  autoCollections: number;
  paidAfterCollect: number;
  criticalAlerts: number;
  escalations: number;
  avgResponseSec: number | null;
  conversionPct: number;
}

const CARD = "p-4 rounded-2xl border border-border/40 bg-card/70 backdrop-blur";
const LABEL = "text-xs text-muted-foreground";
const VALUE = "text-2xl font-bold";

export default function BotPerformance() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [criticals, setCriticals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - days * 86400_000).toISOString();

      const [actionsQ, auditQ, criticalQ, convosQ] = await Promise.all([
        supabase.from("bot_actions_log")
          .select("id, action_type, status, response_time_ms, created_at, metadata")
          .eq("user_id", user.id).gte("created_at", since)
          .order("created_at", { ascending: false }).limit(1000),
        supabase.from("audit_logs")
          .select("id, entity_type, action, created_at")
          .eq("user_id", user.id).gte("created_at", since)
          .in("entity_type", ["auto_collection", "bot_correction"]).limit(2000),
        supabase.from("audit_logs")
          .select("id, action, details, created_at")
          .eq("user_id", user.id).gte("created_at", since)
          .eq("entity_type", "bot_correction").order("created_at", { ascending: false }).limit(20),
        supabase.from("contract_installments")
          .select("id, status, paid_at, last_collected_at")
          .eq("user_id", user.id).gte("last_collected_at", since).limit(1000),
      ]);

      if (cancelled) return;
      const actions = actionsQ.data || [];
      const audits = auditQ.data || [];
      const paidAfter = (convosQ.data || []).filter(
        (i) => i.status === "paid" && i.paid_at && i.last_collected_at && new Date(i.paid_at) > new Date(i.last_collected_at),
      ).length;
      const autoCol = audits.filter((a) => a.entity_type === "auto_collection" && a.action === "message_sent").length;
      const rt = actions.map((a) => Number(a.response_time_ms || 0)).filter((n) => n > 0);
      const avg = rt.length ? Math.round(rt.reduce((s, n) => s + n, 0) / rt.length / 100) / 10 : null;
      const conv = autoCol ? Math.round((paidAfter / autoCol) * 100) : 0;

      setKpis({
        totalMsgs: actions.length,
        aiMsgs: actions.filter((a) => (a.action_type || "").includes("ai")).length,
        autoCollections: autoCol,
        paidAfterCollect: paidAfter,
        criticalAlerts: (criticalQ.data || []).length,
        escalations: actions.filter((a) => (a.action_type || "").includes("escalat") || (a.action_type || "").includes("handoff")).length,
        avgResponseSec: avg,
        conversionPct: conv,
      });
      setRecent(actions.slice(0, 15));
      setCriticals(criticalQ.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, days]);

  const items = useMemo(() => ([
    { label: "Mensagens processadas", value: kpis?.totalMsgs ?? 0, icon: MessageCircle, hint: `Últimos ${days} dias` },
    { label: "Cobranças automáticas", value: kpis?.autoCollections ?? 0, icon: Bot, hint: "Régua enviada" },
    { label: "Convertidas em pagamento", value: kpis?.paidAfterCollect ?? 0, icon: CheckCircle2, hint: `${kpis?.conversionPct ?? 0}% de conversão` },
    { label: "Tempo médio resposta", value: kpis?.avgResponseSec != null ? `${kpis.avgResponseSec}s` : "—", icon: Clock, hint: "IA + envio" },
    { label: "Escalonadas p/ humano", value: kpis?.escalations ?? 0, icon: TrendingUp, hint: "Handoff manual" },
    { label: "Alertas críticos", value: kpis?.criticalAlerts ?? 0, icon: AlertTriangle, hint: "Bot corrigido" },
  ]), [kpis, days]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> Performance do Bot</h1>
          <p className="text-sm text-muted-foreground">Métricas de eficácia do atendimento automatizado.</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/40">
          {[1, 7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-md transition ${days === d ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {d === 1 ? "24h" : `${d}d`}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((it) => (
          <Card key={it.label} className={CARD}>
            <div className="flex items-center justify-between mb-2">
              <it.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={LABEL}>{it.label}</p>
            <p className={VALUE}>{loading ? "…" : it.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{it.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={CARD}>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Correções críticas recentes</h2>
          {criticals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma correção nos últimos {days} dias. Bot está preciso.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {criticals.map((c) => (
                <li key={c.id} className="text-xs p-2 rounded-lg bg-muted/30 border border-border/20">
                  <p className="font-mono text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</p>
                  <p className="mt-1">{JSON.stringify(c.details?.reasons || c.details || {})}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={CARD}>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Ações recentes</h2>
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem atividade recente.</p>
          ) : (
            <ul className="space-y-1 max-h-72 overflow-y-auto">
              {recent.map((r) => (
                <li key={r.id} className="text-xs flex items-center justify-between p-2 rounded-lg bg-muted/20">
                  <span className="flex items-center gap-2">
                    {r.status === "error" ? <XCircle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    {r.action_type || "ação"}
                  </span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleTimeString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
