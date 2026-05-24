import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, Search, Filter, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import EmptyState from "@/components/EmptyState";

const actionLabels: Record<string, string> = {
  contract_created: "Contrato criado",
  payment_registered: "Pagamento registrado",
  client_created: "Cliente cadastrado",
  client_updated: "Cliente atualizado",
  message_sent: "Mensagem enviada",
  installment_paid: "Parcela paga",
  contract_completed: "Contrato quitado",
  transaction_added: "Transação adicionada",
};

const entityLabels: Record<string, string> = {
  contract: "Contrato",
  client: "Cliente",
  installment: "Parcela",
  transaction: "Transação",
  message: "Mensagem",
};

const entityColors: Record<string, string> = {
  contract: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  client: "bg-primary/10 text-primary border-primary/20",
  installment: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  transaction: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  message: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const Historico = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useRealtimeSubscription("audit_logs", [["audit-logs-history", user?.id || ""]]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const entityTypes = [...new Set(logs.map((l: any) => l.entity_type))];

  const filtered = logs.filter((l: any) => {
    const matchSearch = !search ||
      (actionLabels[l.action] || l.action).toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || l.entity_type === typeFilter;
    return matchSearch && matchType;
  });

  // Group by date
  const grouped: Record<string, any[]> = {};
  filtered.forEach((log: any) => {
    const date = new Date(log.created_at).toLocaleDateString("pt-BR");
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  });

  const inputCls = "w-full px-4 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  return (
    <div className="space-y-6">
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex items-center gap-3">
          <div className="page-hero-icon">
            <Clock size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-shimmer">Histórico</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Log de todas as atividades do sistema</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar atividade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-muted-foreground" />
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            Todos
          </button>
          {entityTypes.map((t: string) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {entityLabels[t] || t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{filtered.length} atividades</p>
            <p className="text-xs text-muted-foreground">{Object.keys(grouped).length} dias com registros</p>
          </div>
        </div>
      </div>

      {/* Log List grouped by date */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Clock} title="Nenhuma atividade registrada" description="As ações do sistema aparecerão aqui." />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="animate-fade-in">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {date}
              </p>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                {items.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/50 transition-colors">
                    <div className="mt-0.5 p-2 rounded-lg bg-accent">
                      <Clock size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {actionLabels[log.action] || log.action}
                      </p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {typeof log.details === "object"
                            ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(" · ")
                            : String(log.details)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${entityColors[log.entity_type] || ""}`}>
                      {entityLabels[log.entity_type] || log.entity_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Historico;
