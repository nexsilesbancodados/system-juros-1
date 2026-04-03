import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Shield, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const actionLabels: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  payment: "Pagamento",
  login: "Login",
  export: "Exportação",
};

const entityLabels: Record<string, string> = {
  contract: "Contrato",
  client: "Cliente",
  installment: "Parcela",
  transaction: "Transação",
  collector: "Cobrador",
  settings: "Configurações",
};

const Auditoria = () => {
  const { user } = useAuth();
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", user?.id, filterAction, filterEntity],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterAction) query = query.eq("action", filterAction);
      if (filterEntity) query = query.eq("entity_type", filterEntity);

      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const filteredLogs = search
    ? logs.filter((l: any) =>
        JSON.stringify(l.details || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.entity_type || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.action || "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const inputCls = "px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  const actionColors: Record<string, string> = {
    create: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    delete: "bg-red-500/10 text-red-500 border-red-500/20",
    payment: "bg-primary/10 text-primary border-primary/20",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield size={24} /> Auditoria
        </h1>
        <p className="text-sm text-muted-foreground">Log completo de todas as ações do sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nos logs..."
            className={`${inputCls} pl-9 w-full`}
          />
        </div>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className={inputCls}>
          <option value="">Todas as ações</option>
          {Object.entries(actionLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className={inputCls}>
          <option value="">Todas as entidades</option>
          {Object.entries(entityLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Ações", value: logs.length },
          { label: "Criações", value: logs.filter((l: any) => l.action === "create").length },
          { label: "Pagamentos", value: logs.filter((l: any) => l.action === "payment").length },
          { label: "Exclusões", value: logs.filter((l: any) => l.action === "delete").length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Log list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredLogs.map((log: any) => {
              const details = typeof log.details === "object" ? log.details : {};
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={actionColors[log.action] || "bg-muted text-muted-foreground border-border"}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                      <span className="text-sm text-foreground font-medium">
                        {entityLabels[log.entity_type] || log.entity_type}
                      </span>
                      {details?.description && (
                        <span className="text-xs text-muted-foreground">— {details.description}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                      {log.entity_id && <span className="ml-2">ID: {log.entity_id.slice(0, 8)}...</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Auditoria;
