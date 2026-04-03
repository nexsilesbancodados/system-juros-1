import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, Calendar, DollarSign, X, TrendingUp, AlertCircle, FileSignature, ArrowUpDown, ChevronRight, CheckCircle, Clock, Percent } from "lucide-react";
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
  const [sortBy, setSortBy] = useState<"date" | "capital" | "profit">("date");
  const [page, setPage] = useState(0);
  const pageSize = 20;

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

  // Fetch installments for progress
  const { data: installments = [] } = useQuery({
    queryKey: ["contracts-installments-progress", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_installments")
        .select("contract_id, status, paid_amount, amount")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const installmentsByContract = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; paidAmount: number; totalAmount: number }>();
    installments.forEach((i: any) => {
      const existing = map.get(i.contract_id) || { total: 0, paid: 0, paidAmount: 0, totalAmount: 0 };
      existing.total++;
      existing.totalAmount += Number(i.amount || 0);
      if (i.status === "paid") {
        existing.paid++;
        existing.paidAmount += Number(i.paid_amount || i.amount || 0);
      }
      map.set(i.contract_id, existing);
    });
    return map;
  }, [installments]);

  const { sorted, stats, totalPages } = useMemo(() => {
    const filtered = contracts.filter((c: any) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.clients?.name?.toLowerCase().includes(q) || c.clients?.cpf_cnpj?.includes(search);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });

    const sorted = [...filtered].sort((a: any, b: any) => {
      if (sortBy === "capital") return Number(b.capital) - Number(a.capital);
      if (sortBy === "profit") return Number(b.total_interest) - Number(a.total_interest);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const stats = {
      total: contracts.length,
      active: contracts.filter((c: any) => c.status === "active").length,
      overdue: contracts.filter((c: any) => c.status === "overdue").length,
      completed: contracts.filter((c: any) => c.status === "completed").length,
      totalCapital: contracts.filter((c: any) => c.status === "active" || c.status === "overdue").reduce((s: number, c: any) => s + Number(c.capital), 0),
      totalProfit: contracts.reduce((s: number, c: any) => s + Number(c.total_interest || 0), 0),
      totalReceived: installments.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0),
    };

    return { sorted: sorted.slice(page * pageSize, (page + 1) * pageSize), stats, totalPages: Math.ceil(sorted.length / pageSize) };
  }, [contracts, search, statusFilter, sortBy, page, installments]);

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
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Contrato
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Capital na Rua", value: `R$ ${fmt(stats.totalCapital)}`, color: "text-foreground", Icon: DollarSign, bg: "bg-primary/10" },
          { label: "Total Recebido", value: `R$ ${fmt(stats.totalReceived)}`, color: "text-success", Icon: CheckCircle, bg: "bg-success/10" },
          { label: "Lucro Previsto", value: `R$ ${fmt(stats.totalProfit)}`, color: "text-primary", Icon: TrendingUp, bg: "bg-primary/10" },
          { label: "Taxa Quitação", value: stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : "0%", color: "text-info", Icon: Percent, bg: "bg-info/10" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.Icon size={14} className={s.color} />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Mini status pills */}
      <div className="flex items-center gap-3 text-xs">
        {[
          { label: "Ativos", value: stats.active, color: "text-success" },
          { label: "Em Atraso", value: stats.overdue, color: "text-destructive" },
          { label: "Quitados", value: stats.completed, color: "text-info" },
          { label: "Total", value: stats.total, color: "text-foreground" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`font-bold ${s.color}`}>{s.value}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-2xl p-1 overflow-x-auto">
          {(["all", "active", "overdue", "completed"] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}>
              {s === "all" ? "Todos" : STATUS[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={() => setSortBy(s => s === "date" ? "capital" : s === "capital" ? "profit" : "date")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowUpDown size={12} /> {sortBy === "date" ? "Data" : sortBy === "capital" ? "Capital" : "Lucro"}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}</div>
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
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Progresso</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lucro</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c: any) => {
                  const progress = installmentsByContract.get(c.id);
                  const pct = progress ? Math.round((progress.paid / progress.total) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/contratos/${c.id}`)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{c.clients?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.clients?.cpf_cnpj || ""}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold">R$ {fmt(Number(c.capital))}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{c.num_installments}x</span>
                        <span className="text-muted-foreground"> R$ {fmt(Number(c.installment_amount))}</span>
                        <p className="text-[10px] text-muted-foreground">{getFreqLabel(c.frequency)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden max-w-[80px]">
                            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{progress ? `${progress.paid}/${progress.total}` : "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-primary font-medium">R$ {fmt(Number(c.total_interest || 0))}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS[c.status]?.cls}>{STATUS[c.status]?.label || c.status}</Badge>
                      </td>
                      <td className="px-2"><ChevronRight size={14} className="text-muted-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {sorted.map((c: any) => {
              const progress = installmentsByContract.get(c.id);
              const pct = progress ? Math.round((progress.paid / progress.total) * 100) : 0;
              return (
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
                  {/* Progress bar */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} /> {getFreqLabel(c.frequency)}
                    </span>
                    <span className="text-[10px] text-primary font-semibold">Lucro: R$ {fmt(Number(c.total_interest || 0))}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                Anterior
              </button>
              <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Contratos;
