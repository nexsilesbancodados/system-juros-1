import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  active: "Ativo",
  overdue: "Em Atraso",
  completed: "Quitado",
  renegotiated: "Renegociado",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  overdue: "bg-red-500/10 text-red-500 border-red-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  renegotiated: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const frequencyLabels: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

const Contratos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, clients(name, cpf_cnpj)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = contracts.filter((c: any) => {
    const matchesSearch =
      !search ||
      c.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.clients?.cpf_cnpj?.includes(search);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    active: contracts.filter((c: any) => c.status === "active").length,
    overdue: contracts.filter((c: any) => c.status === "overdue").length,
    completed: contracts.filter((c: any) => c.status === "completed").length,
    total: contracts.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todos os contratos de empréstimo
          </p>
        </div>
        <button
          onClick={() => navigate("/novo-contrato")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground transition-colors"
          style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
        >
          <Plus size={16} />
          Novo Contrato
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Ativos", value: stats.active, color: "text-emerald-500" },
          { label: "Em Atraso", value: stats.overdue, color: "text-red-500" },
          { label: "Quitados", value: stats.completed, color: "text-blue-500" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          {["all", "active", "overdue", "completed", "renegotiated"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todos" : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum contrato encontrado</p>
          <button
            onClick={() => navigate("/novo-contrato")}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Criar primeiro contrato
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Capital</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Juros</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Parcelas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Frequência</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Início</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/contratos/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.clients?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.clients?.cpf_cnpj || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      R$ {Number(c.capital).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-foreground">{Number(c.interest_rate)}%</td>
                    <td className="px-4 py-3 text-foreground">
                      {c.num_installments}x R$ {Number(c.installment_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {frequencyLabels[c.frequency] || c.frequency}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.start_date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusColors[c.status] || ""}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contratos;
