import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Play, Clock, MessageSquare, DollarSign, Bell,
  CheckCircle, AlertTriangle, Loader2, Shield, RefreshCcw,
  Bot, TrendingUp, Calendar, Settings, CreditCard, Database,
  Receipt, Cake, Star, Trash2
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

const Automacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [results, setResults] = useState<Record<string, AutomationResult>>({});
  const [runningAll, setRunningAll] = useState(false);

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
        .in("entity_type", ["auto_collection", "auto_late_fees", "auto_notifications"])
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["automation-stats", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { count: sentToday } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("entity_type", "auto_collection")
        .eq("action", "message_sent")
        .gte("created_at", `${today}T00:00:00Z`);

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
        overdueCount: overdueCount || 0,
        dueTodayCount: dueTodayCount || 0,
      };
    },
    enabled: !!user,
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

  const runAll = async () => {
    setRunningAll(true);
    await runAutomation("Multas e Juros", "auto-late-fees");
    await runAutomation("Notificações", "auto-notifications");
    await runAutomation("Cobrança WhatsApp", "auto-collection");
    await runAutomation("Verificar Atrasos", "check-overdue");
    await runAutomation("Assinaturas", "auto-subscription-check");
    await runAutomation("Score de Crédito", "auto-credit-score");
    await runAutomation("Aniversários", "auto-birthday");
    await runAutomation("Backup", "auto-backup");
    await runAutomation("Limpeza", "auto-cleanup");
    setRunningAll(false);
    toast({ title: "✓ Todas automações executadas" });
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
    },
    {
      id: "subscription",
      name: "Assinaturas",
      description: "Bloqueia contas com assinatura vencida e avisa quem vence em 7 dias",
      icon: CreditCard,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      fn: "auto-subscription-check",
    },
    {
      id: "credit-score",
      name: "Score de Crédito",
      description: "Recalcula o score de cada cliente baseado no histórico de pagamentos e atrasos",
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      fn: "auto-credit-score",
    },
    {
      id: "birthday",
      name: "Aniversários",
      description: "Envia mensagem de parabéns via WhatsApp e notifica internamente",
      icon: Cake,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
      fn: "auto-birthday",
    },
    {
      id: "backup",
      name: "Backup de Dados",
      description: "Exporta todos os dados (clientes, contratos, parcelas, etc) para o Storage diariamente",
      icon: Database,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      fn: "auto-backup",
    },
    {
      id: "cleanup",
      name: "Limpeza Semanal",
      description: "Remove notificações lidas com +30 dias e logs com +90 dias para manter o banco enxuto",
      icon: Trash2,
      color: "text-muted-foreground",
      bg: "bg-muted",
      fn: "auto-cleanup",
    },
  ];

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
                Gerencie e execute automações do sistema
              </p>
            </div>
          </div>
          <button onClick={runAll} disabled={runningAll} className="btn-premium disabled:opacity-50">
            {runningAll ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Executar Todas
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade-in">
        {[
          { label: "Mensagens Hoje", value: stats?.sentToday || 0, icon: MessageSquare, color: "text-success" },
          { label: "Parcelas Atrasadas", value: stats?.overdueCount || 0, icon: AlertTriangle, color: "text-destructive" },
          { label: "Vencem Hoje", value: stats?.dueTodayCount || 0, icon: Calendar, color: "text-warning" },
          { label: "Bot", value: settings?.bot_enabled ? "Ativo" : "Inativo", icon: Bot, color: settings?.bot_enabled ? "text-success" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <s.icon size={14} className={`${s.color} mb-1`} />
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Automation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-fade-in">
        {automations.map((auto) => {
          const result = results[auto.name];
          const isRunning = result?.status === "running";

          return (
            <div
              key={auto.id}
              className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${auto.bg} flex items-center justify-center`}>
                      <auto.icon size={20} className={auto.color} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{auto.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{auto.description}</p>
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
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.details)
                      .filter(([key]) => !["message", "errors", "results", "details"].includes(key))
                      .slice(0, 4)
                      .map(([key, val]) => (
                        <div key={key} className="rounded-lg bg-muted/30 p-2">
                          <p className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-semibold text-foreground">{String(val)}</p>
                        </div>
                      ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAutomation(auto.name, auto.fn)}
                  disabled={isRunning}
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
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Automação Agendada (Cron)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Para executar as automações automaticamente todos os dias, configure o agendamento no painel do Supabase.
              As automações rodarão no horário configurado em <strong>Configurações → Bot de Cobranças</strong>.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-[10px]">
                <Clock size={10} className="mr-1" /> Multas: Diário
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <Bell size={10} className="mr-1" /> Notificações: Diário
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <MessageSquare size={10} className="mr-1" /> WhatsApp: Conforme horário
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Automacoes;
