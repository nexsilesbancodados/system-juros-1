import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, Calendar, DollarSign, X, TrendingUp, AlertCircle, FileSignature, ArrowUpDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-success/10 text-success border-success/20" },
  overdue: { label: "Em Atraso", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  completed: { label: "Quitado", cls: "bg-info/10 text-info border-info/20" },
  renegotiated: { label: "Renegociado", cls: "bg-warning/10 text-warning border-warning/20" },
};

const FREQ: Record<string, string> = {
  daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal",
  daily_monFri: "Diário (Seg-Sex)", "daily_mon-fri": "Seg-Sex", "daily_mon-sat": "Seg-Sáb", "daily_mon-sun": "Seg-Dom",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const getFreqLabel = (f: string) => FREQ[f] || f;

const Contratos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "capital">("date");

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
    staleTime: 30_000,
  });

  const { sorted, stats } = useMemo(() => {
    const filtered = contracts.filter((c: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.clients?.name?.toLowerCase().includes(q) || c.clients?.cpf_cnpj?.includes(search);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });

    const sorted = [...filtered].sort((a: any, b: any) =>
      sortBy === "capital" ? Number(b.capital) - Number(a.capital) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const stats = {
      total: contracts.length,
      active: contracts.filter((c: any) => c.status === "active").length,
      overdue: contracts.filter((c: any) => c.status === "overdue").length,
      completed: contracts.filter((c: any) => c.status === "completed").length,
      totalCapital: contracts.filter((c: any) => c.status === "active").reduce((s: number, c: any) => s + Number(c.capital), 0),
      totalProfit: contracts.reduce((s: number, c: any) => s + Number(c.total_interest || 0), 0),
    };

    return { sorted, stats };
  }, [contracts, search, statusFilter, sortBy]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSignature size={22} className="text-primary" /> Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os contratos de empréstimo</p>
        </div>
        <button onClick={() => navigate("/novo-contrato")}
          className="action-btn-primary">
          <Plus size={16} /> Novo Contrato
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", Icon: FileText },
          { label: "Ativos", value: stats.active, color: "text-success", Icon: TrendingUp },
          { label: "Em Atraso", value: stats.overdue, color: "text-destructive", Icon: AlertCircle },
          { label: "Quitados", value: stats.completed, color: "text-info", Icon: DollarSign },
          { label: "Capital Ativo", value: `R$ ${fmt(stats.totalCapital)}`, color: "text-foreground", Icon: DollarSign },
          { label: "Lucro Previsto", value: `R$ ${fmt(stats.totalProfit)}`, color: "text-primary", Icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <s.Icon size={14} className={s.color} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-2xl p-1 overflow-x-auto">
          {(["all", "active", "overdue", "completed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}>
              {s === "all" ? "Todos" : STATUS[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={() => setSortBy(s => s === "date" ? "capital" : "date")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowUpDown size={12} /> {sortBy === "date" ? "Por Data" : "Por Capital"}
        </button>
      </div>

      {search && <p className="text-xs text-muted-foreground">{sorted.length} resultado{sorted.length !== 1 ? "s" : ""}</p>}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <FileText size={28} className="text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-medium">{search ? `Nenhum resultado para "${search}"` : "Nenhum contrato encontrado"}</p>
          <button onClick={() => navigate("/novo-contrato")} className="mt-4 text-sm text-primary hover:underline">Criar primeiro contrato</button>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capital</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Parcelas</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Freq.</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lucro</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c: any) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/contratos/${c.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.clients?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.clients?.cpf_cnpj || ""}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">R$ {fmt(Number(c.capital))}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{c.num_installments}x</span>
                      <span className="text-muted-foreground"> R$ {fmt(Number(c.installment_amount))}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{getFreqLabel(c.frequency)}</td>
                    <td className="px-4 py-3 text-primary font-medium">R$ {fmt(Number(c.total_interest || 0))}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS[c.status]?.cls}>{STATUS[c.status]?.label || c.status}</Badge>
                    </td>
                    <td className="px-2"><ChevronRight size={14} className="text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {sorted.map((c: any) => (
              <button key={c.id} onClick={() => navigate(`/contratos/${c.id}`)}
                className="w-full p-4 rounded-2xl bg-card border border-border hover:bg-accent/30 transition-colors text-left">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-foreground text-sm">{c.clients?.name || "—"}</p>
                  <Badge variant="outline" className={`text-[9px] ${STATUS[c.status]?.cls}`}>{STATUS[c.status]?.label || c.status}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><DollarSign size={12} /> R$ {fmt(Number(c.capital))}</span>
                  <span>{c.num_installments}x R$ {fmt(Number(c.installment_amount))}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar size={10} /> {getFreqLabel(c.frequency)}
                  </span>
                  <span className="text-[10px] text-primary font-semibold">Lucro: R$ {fmt(Number(c.total_interest || 0))}</span>
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
