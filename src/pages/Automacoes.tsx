import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Play, Clock, MessageSquare, DollarSign, Bell,
  CheckCircle, AlertTriangle, Loader2, Shield, RefreshCcw,
  Bot, TrendingUp, Calendar, Settings, CreditCard, Database,
  Receipt, Cake, Star, Trash2, Search, X, ChevronDown, ChevronUp,
  Activity, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AutomationResult {
  name: string;
  status: "success" | "error" | "idle" | "running";
  message?: string;
  details?: Record<string, unknown>;
  lastRun?: string;
}

type Category = "all" | "cobranca" | "financeiro" | "cliente" | "sistema";

const Automacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [results, setResults] = useState<Record<string, AutomationResult>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: settings } = useQuery({
    queryKey: ["settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("bot_enabled, bot_auto_send, whatsapp_api_url, whatsapp_instance")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["automation-logs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user!.id)
        .in("entity_type", ["auto_collection", "auto_late_fees", "auto_notifications", "auto_backup", "auto_credit_score", "auto_birthday", "auto_cleanup", "auto_subscription_check", "check_overdue"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["automation-stats", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count: sentToday } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("entity_type", "auto_collection")
        .eq("action", "message_sent")
        .gte("created_at", `${today}T00:00:00Z`);

      const { count: sentWeek } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("entity_type", "auto_collection")
        .eq("action", "message_sent")
        .gte("created_at", sevenAgo);

      const { count: overdueCount } = await supabase
        .from("contract_installments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .lt("due_date", new Date().toISOString());

      const { count: dueTodayCount } = await supabase
        .from("contract_installments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .gte("due_date", `${today}T00:00:00Z`)
        .lte("due_date", `${today}T23:59:59Z`);

      return {
        sentToday: sentToday || 0,
        sentWeek: sentWeek || 0,
        overdueCount: overdueCount || 0,
        dueTodayCount: dueTodayCount || 0,
      };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const runAutomation = async (name: string, functionName: string) => {
    setResults(prev => ({
      ...prev,
      [name]: { name, status: "running" },
    }));

    try {
      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) throw error;

      setResults(prev => ({
        ...prev,
        [name]: {
          name,
          status: "success",
          message: data?.message || "Executado com sucesso",
          details: data,
          lastRun: new Date().toLocaleTimeString("pt-BR"),
        },
      }));

      toast({ title: `✓ ${name}`, description: data?.message || "Executado com sucesso" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setResults(prev => ({
        ...prev,
        [name]: { name, status: "error", message: msg, lastRun: new Date().toLocaleTimeString("pt-BR") },
      }));
      toast({ title: `Erro: ${name}`, description: msg, variant: "destructive" });
    }

    queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
    queryClient.invalidateQueries({ queryKey: ["automation-stats"] });
  };

  const automations = [
    {
      id: "late-fees",
      name: "Multas e Juros",
      description: "Calcula e aplica multa + juros diários automaticamente em parcelas atrasadas",
      icon: DollarSign,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      fn: "auto-late-fees",
      category: "cobranca" as Category,
      schedule: "Diário 03:00",
      entityType: "auto_late_fees",
      badge: stats?.overdueCount ? `${stats.overdueCount} atrasadas` : undefined,
      badgeColor: "bg-destructive/10 text-destructive",
    },
    {
      id: "notifications",
      name: "Notificações Internas",
      description: "Gera alertas de parcelas vencendo hoje, atrasadas, metas atingidas e score crítico",
      icon: Bell,
      color: "text-primary",
      bg: "bg-primary/10",
      fn: "auto-notifications",
      category: "sistema" as Category,
      schedule: "Diário 06:00",
      entityType: "auto_notifications",
      badge: stats?.dueTodayCount ? `${stats.dueTodayCount} vencem hoje` : undefined,
      badgeColor: "bg-warning/10 text-warning",
    },
    {
      id: "collection",
      name: "Cobrança WhatsApp",
      description: "Envia mensagens de cobrança via WhatsApp seguindo as regras de escalonamento configuradas",
      icon: MessageSquare,
      color: "text-success",
      bg: "bg-success/10",
      fn: "auto-collection",
      category: "cobranca" as Category,
      schedule: "A cada hora",
      entityType: "auto_collection",
      badge: settings?.bot_enabled ? "Bot Ativo" : "Bot Desativado",
      badgeColor: settings?.bot_enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
    },
    {
      id: "check-overdue",
      name: "Verificar Atrasos",
      description: "Varre parcelas atrasadas e cria notificações consolidadas por usuário",
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      fn: "check-overdue",
      category: "cobranca" as Category,
      schedule: "Diário 07:00",
      entityType: "check_overdue",
    },
    {
      id: "subscription",
      name: "Assinaturas",
      description: "Bloqueia contas com assinatura vencida e avisa quem vence em 7 dias",
      icon: CreditCard,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      fn: "auto-subscription-check",
      category: "financeiro" as Category,
      schedule: "Diário 02:00",
      entityType: "auto_subscription_check",
    },
    {
      id: "credit-score",
      name: "Score de Crédito",
      description: "Recalcula o score de cada cliente baseado no histórico de pagamentos e atrasos",
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      fn: "auto-credit-score",
      category: "cliente" as Category,
      schedule: "Diário 05:00",
      entityType: "auto_credit_score",
    },
    {
      id: "birthday",
      name: "Aniversários",
      description: "Envia mensagem de parabéns via WhatsApp e notifica internamente",
      icon: Cake,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
      fn: "auto-birthday",
      category: "cliente" as Category,
      schedule: "Diário 09:00",
      entityType: "auto_birthday",
    },
    {
      id: "backup",
      name: "Backup de Dados",
      description: "Exporta todos os dados (clientes, contratos, parcelas, etc) para o Storage diariamente",
      icon: Database,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      fn: "auto-backup",
      category: "sistema" as Category,
      schedule: "Diário 04:00",
      entityType: "auto_backup",
    },
    {
      id: "cleanup",
      name: "Limpeza Semanal",
      description: "Remove notificações lidas com +30 dias e logs com +90 dias para manter o banco enxuto",
      icon: Trash2,
      color: "text-muted-foreground",
      bg: "bg-muted",
      fn: "auto-cleanup",
      category: "sistema" as Category,
      schedule: "Segunda 01:00",
      entityType: "auto_cleanup",
    },
  ];

  // Compute last run per automation from audit_logs
  const lastRunByEntity = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of recentLogs as any[]) {
      if (!map[log.entity_type]) {
        map[log.entity_type] = log.created_at;
      }
    }
    return map;
  }, [recentLogs]);

  const categories: { id: Category; label: string; icon: any }[] = [
    { id: "all", label: "Todas", icon: Zap },
    { id: "cobranca", label: "Cobrança", icon: MessageSquare },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
    { id: "cliente", label: "Cliente", icon: Star },
    { id: "sistema", label: "Sistema", icon: Settings },
  ];

  const filtered = automations.filter((a) => {
    if (category !== "all" && a.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    }
    return true;
  });

  const runAll = async () => {
    setRunningAll(true);
    const list = filtered.length > 0 ? filtered : automations;
    setRunProgress({ current: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      setRunProgress({ current: i + 1, total: list.length });
      await runAutomation(list[i].name, list[i].fn);
    }
    setRunningAll(false);
    setRunProgress(null);
    const ok = list.filter(a => results[a.name]?.status === "success").length;
    toast({ title: `✓ ${list.length} automações executadas`, description: `${ok} com sucesso` });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "running":
        return <Loader2 size={16} className="animate-spin text-primary" />;
      case "success":
        return <CheckCircle size={16} className="text-success" />;
      case "error":
        return <AlertTriangle size={16} className="text-destructive" />;
      default:
        return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  const formatRelative = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `há ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `há ${days}d`;
    return d.toLocaleDateString("pt-BR");
  };

  const successCount = Object.values(results).filter(r => r.status === "success").length;
  const errorCount = Object.values(results).filter(r => r.status === "error").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-hero">
        <div className="page-hero-content flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon">
              <Zap size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-shimmer">Automações</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {automations.length} rotinas · {filtered.length} {filtered.length === 1 ? "visível" : "visíveis"}
                {successCount > 0 && <span className="text-success"> · {successCount} ok</span>}
                {errorCount > 0 && <span className="text-destructive"> · {errorCount} erros</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runProgress && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {runProgress.current}/{runProgress.total}
              </span>
            )}
            <button onClick={runAll} disabled={runningAll} className="btn-premium disabled:opacity-50">
              {runningAll ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {runningAll ? "Executando..." : "Executar Todas"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade-in">
        {[
          { label: "Mensagens Hoje", value: stats?.sentToday || 0, sub: `${stats?.sentWeek || 0} na semana`, icon: MessageSquare, color: "text-success" },
          { label: "Parcelas Atrasadas", value: stats?.overdueCount || 0, icon: AlertTriangle, color: "text-destructive" },
          { label: "Vencem Hoje", value: stats?.dueTodayCount || 0, icon: Calendar, color: "text-warning" },
          { label: "Bot", value: settings?.bot_enabled ? "Ativo" : "Inativo", icon: Bot, color: settings?.bot_enabled ? "text-success" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <s.icon size={14} className={`${s.color} mb-1`} />
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            {s.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar automação por nome ou descrição..."
            className="w-full pl-9 pr-9 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted">
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const count = c.id === "all" ? automations.length : automations.filter(a => a.category === c.id).length;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted/30 border border-border text-muted-foreground hover:text-foreground"}`}
              >
                <c.icon size={12} />
                {c.label}
                <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Automation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-fade-in">
        {filtered.length === 0 ? (
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <Filter size={28} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma automação corresponde aos filtros</p>
          </div>
        ) : filtered.map((auto) => {
          const result = results[auto.name];
          const isRunning = result?.status === "running";
          const lastRunIso = lastRunByEntity[auto.entityType];
          const lastRunLabel = formatRelative(lastRunIso);
          const isExpanded = expanded[auto.id];

          return (
            <div
              key={auto.id}
              className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${auto.bg} flex items-center justify-center shrink-0`}>
                      <auto.icon size={20} className={auto.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground">{auto.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{auto.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={10} /> {auto.schedule}</span>
                        {lastRunLabel && (
                          <span className="flex items-center gap-1"><Activity size={10} /> {lastRunLabel}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {getStatusIcon(result?.status)}
                </div>

                {auto.badge && (
                  <Badge variant="outline" className={`text-[10px] ${auto.badgeColor || ""}`}>
                    {auto.badge}
                  </Badge>
                )}

                {result?.message && (
                  <div className={`rounded-xl p-3 text-xs ${
                    result.status === "success"
                      ? "bg-success/10 text-success border border-success/20"
                      : result.status === "error"
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {result.message}
                    {result.lastRun && (
                      <span className="block mt-1 opacity-70">Executado às {result.lastRun}</span>
                    )}
                  </div>
                )}

                {result?.details && result.status === "success" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(result.details)
                        .filter(([key]) => !["message", "errors", "results", "details"].includes(key))
                        .slice(0, 4)
                        .map(([key, val]) => (
                          <div key={key} className="rounded-lg bg-muted/30 p-2">
                            <p className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, " ")}</p>
                            <p className="text-sm font-semibold text-foreground truncate">{String(val)}</p>
                          </div>
                        ))}
                    </div>
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [auto.id]: !isExpanded }))}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      {isExpanded ? "Ocultar payload" : "Ver payload completo"}
                    </button>
                    {isExpanded && (
                      <pre className="rounded-lg bg-muted/30 border border-border p-2 text-[10px] text-foreground overflow-auto max-h-48 font-mono">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAutomation(auto.name, auto.fn)}
                  disabled={isRunning || runningAll}
                  className="w-full rounded-xl gap-2"
                >
                  {isRunning ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  {isRunning ? "Executando..." : "Executar Agora"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              Atividade Recente
            </h3>
            <Badge variant="outline" className="text-[10px]">{recentLogs.length} registros</Badge>
          </div>
          <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
            {recentLogs.map((log: any) => {
              const details = log.details as Record<string, unknown> | null;
              return (
                <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    log.action === "message_sent" ? "bg-success/10" : "bg-primary/10"
                  }`}>
                    {log.action === "message_sent" ? (
                      <MessageSquare size={14} className="text-success" />
                    ) : (
                      <Zap size={14} className="text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {log.action === "message_sent"
                        ? `Cobrança enviada: ${(details as any)?.client_name || "—"}`
                        : `${log.entity_type}: ${log.action}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                      {(details as any)?.amount && ` · R$ ${Number((details as any).amount).toFixed(2)}`}
                    </p>
                  </div>
                  {(details as any)?.days_overdue !== undefined && (
                    <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 shrink-0">
                      {(details as any).days_overdue}d atraso
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-success" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Cron Ativo
              <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Automático</Badge>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Todas as automações rodam sozinhas no horário programado. Você pode executar manualmente a qualquer momento.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Assinaturas: 02:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Multas: 03:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Backup: 04:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Score: 05:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Notificações: 06:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Atrasos: 07:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Clock size={10} className="mr-1" /> Aniversários: 09:00</Badge>
              <Badge variant="outline" className="text-[10px]"><MessageSquare size={10} className="mr-1" /> WhatsApp: hora em hora</Badge>
              <Badge variant="outline" className="text-[10px]"><Trash2 size={10} className="mr-1" /> Limpeza: seg 01:00</Badge>
              <Badge variant="outline" className="text-[10px]"><Receipt size={10} className="mr-1" /> Recibo: ao pagar parcela</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Automacoes;
