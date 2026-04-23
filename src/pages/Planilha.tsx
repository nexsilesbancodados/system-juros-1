import { useState, useEffect, useMemo } from "react";
import { Table, Download, Search, X, ArrowUpDown, Filter, Users, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const Planilha = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "capital" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [c, ct, i] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id", user.id).order("name"),
        supabase.from("contracts").select("*").eq("user_id", user.id),
        supabase.from("contract_installments").select("*").eq("user_id", user.id),
      ]);
      setClients(c.data || []);
      setContracts(ct.data || []);
      setInstallments(i.data || []);
      setLoading(false);
    };
    fetch();
    const ch = supabase
      .channel("realtime-planilha")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "clients", filter: `user_id=eq.${user.id}` }, fetch)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "contracts", filter: `user_id=eq.${user.id}` }, fetch)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "contract_installments", filter: `user_id=eq.${user.id}` }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const enriched = useMemo(() => {
    return clients.map(c => {
      const cContracts = contracts.filter(ct => ct.client_id === c.id);
      const cInstallments = installments.filter(i => i.client_id === c.id);
      const totalCapital = cContracts.reduce((s, ct) => s + Number(ct.capital || 0), 0);
      const totalAmount = cContracts.reduce((s, ct) => s + Number(ct.total_amount || 0), 0);
      const paid = cInstallments.filter(i => i.status === "paid");
      const overdue = cInstallments.filter(i => i.status !== "paid" && new Date(i.due_date) < new Date());
      const totalPaid = paid.reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0);
      return { ...c, totalCapital, totalAmount, totalPaid, paidCount: paid.length, overdueCount: overdue.length, totalInstallments: cInstallments.length, contractCount: cContracts.length };
    });
  }, [clients, contracts, installments]);

  const filtered = enriched.filter((c) =>
    `${c.name} ${c.cpf_cnpj || ""} ${c.phone || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
    if (sortBy === "capital") return (a.totalCapital - b.totalCapital) * dir;
    return (a.overdueCount - b.overdueCount) * dir;
  });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const totals = useMemo(() => ({
    capital: enriched.reduce((s, c) => s + c.totalCapital, 0),
    amount: enriched.reduce((s, c) => s + c.totalAmount, 0),
    paid: enriched.reduce((s, c) => s + c.totalPaid, 0),
    overdue: enriched.reduce((s, c) => s + c.overdueCount, 0),
  }), [enriched]);

  const handleExportCSV = () => {
    const header = "Nome,CPF/CNPJ,Telefone,Status,Capital,Total,Pago,Contratos,Parcelas Pagas,Parcelas Total,Atrasadas\n";
    const rows = sorted.map(c =>
      `"${c.name}","${c.cpf_cnpj || ""}","${c.phone || ""}","${c.status}","${c.totalCapital.toFixed(2)}","${c.totalAmount.toFixed(2)}","${c.totalPaid.toFixed(2)}","${c.contractCount}","${c.paidCount}","${c.totalInstallments}","${c.overdueCount}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "planilha-clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-hero">
        <div className="page-hero-content flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon">
              <Table size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-shimmer">Planilha</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Visão completa dos dados de todos os clientes</p>
            </div>
          </div>
          <button onClick={handleExportCSV} className="btn-premium">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade-in">
        {[
          { label: "Clientes", value: enriched.length, icon: Users, color: "text-foreground" },
          { label: "Capital Total", value: `R$ ${fmt(totals.capital)}`, icon: DollarSign, color: "text-primary" },
          { label: "Total Pago", value: `R$ ${fmt(totals.paid)}`, icon: DollarSign, color: "text-success" },
          { label: "Atrasadas", value: totals.overdue, icon: Filter, color: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 card-shine">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={s.color} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</span>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl skeleton-shimmer" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <Table size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-x-auto bg-card">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { key: "name" as const, label: "Cliente" },
                  { key: "capital" as const, label: "Capital" },
                  { key: "status" as const, label: "Status" },
                ].map(col => (
                  <th key={col.key} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort(col.key)}>
                    <span className="flex items-center gap-1">{col.label} <ArrowUpDown size={10} className={sortBy === col.key ? "text-primary" : "opacity-30"} /></span>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pago</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Progresso</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Atraso</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const pct = c.totalInstallments > 0 ? Math.round((c.paidCount / c.totalInstallments) * 100) : 0;
                return (
                  <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                    className="border-t border-border hover:bg-accent/30 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.cpf_cnpj || c.phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">R$ {fmt(c.totalCapital)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">R$ {fmt(c.totalAmount)}</td>
                    <td className="px-4 py-3 text-success font-medium">R$ {fmt(c.totalPaid)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{c.paidCount}/{c.totalInstallments}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.overdueCount > 0 ? (
                        <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md">{c.overdueCount}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Planilha;
