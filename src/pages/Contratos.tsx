import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, Filter, ChevronRight, Calendar, DollarSign, X, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  active: "Ativo",
  overdue: "Em Atraso",
  completed: "Quitado",
  renegotiated: "Renegociado",
};

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-info/10 text-info border-info/20",
  renegotiated: "bg-warning/10 text-warning border-warning/20",
};

const frequencyLabels: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

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
    const matchesSearch = !search ||
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
    totalCapital: contracts.filter((c: any) => c.status === "active").reduce((s: number, c: any) => s + Number(c.capital), 0),
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie todos os contratos de empréstimo</p>
        </div>
        <button
          onClick={() => navigate("/novo-contrato")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg focus-ring"
          style={{ background: "var(--gradient-button)" }}
        >
          <Plus size={16} /> Novo Contrato
        </button>
      </div>

      {/* Improvement #45: Enhanced stats with total capital */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger-fade-in">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", icon: FileText, bg: "bg-muted/30" },
          { label: "Ativos", value: stats.active, color: "text-success", icon: TrendingUp, bg: "bg-success/8" },
          { label: "Em Atraso", value: stats.overdue, color: "text-destructive", icon: AlertCircle, bg: "bg-destructive/8" },
          { label: "Quitados", value: stats.completed, color: "text-info", icon: DollarSign, bg: "bg-info/8" },
          { label: "Capital Ativo", value: `R$ ${fmt(stats.totalCapital)}`, color: "text-foreground", icon: DollarSign, bg: "bg-primary/8", isText: true },
        ].map((s: any) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 card-shine">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={14} className={s.color} />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.isText ? s.value : s.value}</p>
          </div>
        ))}
      </div>

      {/* Improvement #46: Better filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground input-enhanced"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
          {["all", "active", "overdue", "completed", "renegotiated"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {s === "all" ? "Todos" : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Cards */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl skeleton-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <FileText size={28} className="text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-medium">{search ? `Nenhum resultado para "${search}"` : "Nenhum contrato encontrado"}</p>
          <button onClick={() => navigate("/novo-contrato")} className="mt-4 text-sm text-primary hover:underline">
            Criar primeiro contrato
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capital</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Parcelas</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Freq.</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Início</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/contratos/${c.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{c.clients?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.clients?.cpf_cnpj || ""}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">R$ {fmt(Number(c.capital))}</td>
                      <td className="px-4 py-3 text-foreground">
                        <span className="font-semibold">{c.num_installments}x</span>
                        <span className="text-muted-foreground"> R$ {fmt(Number(c.installment_amount))}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{frequencyLabels[c.frequency] || c.frequency}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.start_date).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusColors[c.status] || ""}>{statusLabels[c.status] || c.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Improvement #47: Mobile card view for contracts */}
          <div className="md:hidden space-y-2 stagger-fade-in">
            {filtered.map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/contratos/${c.id}`)}
                className="w-full p-4 rounded-xl bg-card border border-border hover:bg-accent/30 transition-all text-left active:scale-[0.99]"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-foreground text-sm">{c.clients?.name || "—"}</p>
                  <Badge variant="outline" className={`text-[9px] ${statusColors[c.status] || ""}`}>{statusLabels[c.status] || c.status}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><DollarSign size={12} /> R$ {fmt(Number(c.capital))}</span>
                  <span>{c.num_installments}x R$ {fmt(Number(c.installment_amount))}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(c.start_date).toLocaleDateString("pt-BR")}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Contratos;
