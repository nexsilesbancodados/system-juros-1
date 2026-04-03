import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const Historico = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", user?.id],
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

  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">Log de todas as atividades do sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            Todos
          </button>
          {entityTypes.map((t: string) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {entityLabels[t] || t}
            </button>
          ))}
        </div>
      </div>

      {/* Log List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {filtered.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="mt-0.5 p-1.5 rounded-lg bg-accent">
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
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(log.created_at).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {entityLabels[log.entity_type] || log.entity_type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Historico;
