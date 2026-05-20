import { useState, useMemo, useEffect, useRef } from "react";
import { TrendingUp, Plus, X, Search, Calendar, ArrowUpRight, Edit2, Download, Trash2, MoreVertical, BarChart3, Wallet, SlidersHorizontal, CheckSquare, Square, Trophy, Target, Sparkles, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

type TimeFilter = "all" | "today" | "7d" | "30d" | "90d" | "ytd";
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
type SourceFilter = "all" | "operational" | "manual";

const Lucros = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 200);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useMultiTableRealtime(["profits"], [["lucros-data", user?.id || ""]]);

  // "/" focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { data: profits = [], isLoading: loading } = useQuery({
    queryKey: ["lucros-data", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profits").select("*").eq("user_id", user!.id).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const resetForm = () => {
    setDesc(""); setAmount(""); setDate(new Date().toISOString().slice(0, 10));
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (p: any) => {
    setDesc(p.description); setAmount(String(p.amount));
    setDate(new Date(p.date).toISOString().slice(0, 10));
    setEditingId(p.id); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!user || !desc.trim() || !amount) return;
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("profits")
        .update({ description: desc.trim(), amount: parseFloat(amount), date: new Date(date).toISOString() })
        .eq("id", editingId);
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✓ Lucro atualizado!" }); resetForm(); qc.invalidateQueries({ queryKey: ["lucros-data"] }); }
    } else {
      const { error } = await supabase.from("profits")
        .insert({ user_id: user.id, description: desc.trim(), amount: parseFloat(amount), date: new Date(date).toISOString() });
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✓ Lucro registrado!" }); resetForm(); qc.invalidateQueries({ queryKey: ["lucros-data"] }); }
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("profits").delete().eq("id", id);
    setDeleteConfirm(null);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    qc.invalidateQueries({ queryKey: ["lucros-data"] });
    toast({ title: "Lucro excluído" });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from("profits").delete().in("id", ids);
    setSelected(new Set());
    setBulkDeleteOpen(false);
    qc.invalidateQueries({ queryKey: ["lucros-data"] });
    toast({ title: `${ids.length} lucro(s) excluído(s)` });
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const filterDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = filterDays[timeFilter];
    const term = debouncedSearch.toLowerCase().trim();

    const arr = profits.filter((p: any) => {
      const pd = new Date(p.date);
      if (timeFilter === "today" && pd < startOfDay) return false;
      if (timeFilter === "ytd" && pd < startOfYear) return false;
      if (days) {
        const diff = (now.getTime() - pd.getTime()) / 86400000;
        if (diff > days) return false;
      }
      if (sourceFilter === "operational" && !p.client_id) return false;
      if (sourceFilter === "manual" && p.client_id) return false;
      if (term && !p.description.toLowerCase().includes(term)) return false;
      return true;
    });

    arr.sort((a: any, b: any) => {
      switch (sortKey) {
        case "date_asc": return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "amount_desc": return Number(b.amount) - Number(a.amount);
        case "amount_asc": return Number(a.amount) - Number(b.amount);
        default: return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
    return arr;
  }, [profits, debouncedSearch, timeFilter, sourceFilter, sortKey]);

  const handleExportCSV = () => {
    const header = "Data,Descrição,Valor,Origem\n";
    const rows = filtered.map((p: any) =>
      `${new Date(p.date).toLocaleDateString("pt-BR")},"${p.description.replace(/"/g, '""')}",${Number(p.amount).toFixed(2)},${p.client_id ? "Operacional" : "Manual"}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `lucros_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    toast({ title: "CSV exportado!" });
  };

  // KPIs
  const total = filtered.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const totalAll = profits.reduce((acc: number, p: any) => acc + Number(p.amount), 0);

  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
  const weekTotal = profits.filter((p: any) => new Date(p.date) >= startOfWeek).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStr = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const amount = profits.filter((p: any) => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      }).reduce((s: number, p: any) => s + Number(p.amount), 0);
      return { month: monthStr, amount };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profits]);
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  const currentMonthTotal = monthlyData[5]?.amount || 0;
  const prevMonthTotal = monthlyData[4]?.amount || 0;
  const monthlyChange = prevMonthTotal > 0
    ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal * 100).toFixed(1)
    : currentMonthTotal > 0 ? "+100" : "0";

  // Projection: based on daily pace this month
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projection = dayOfMonth > 0 ? (currentMonthTotal / dayOfMonth) * daysInMonth : 0;

  const avgPerEntry = profits.length > 0 ? totalAll / profits.length : 0;

  const todayTotal = profits.filter((p: any) => {
    const d = new Date(p.date);
    return d.toDateString() === new Date().toDateString();
  }).reduce((s: number, p: any) => s + Number(p.amount), 0);

  // Top descriptions
  const topDescriptions = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p: any) => {
      const k = p.description.trim();
      map.set(k, (map.get(k) || 0) + Number(p.amount));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);

  // Source breakdown
  const opTotal = filtered.filter((p: any) => p.client_id).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const manualTotal = total - opTotal;

  const grouped = useMemo(() => filtered.reduce((acc: Record<string, any[]>, p: any) => {
    const key = new Date(p.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, any[]>), [filtered]);

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all";

  const allVisibleIds = useMemo(() => filtered.map((p: any) => p.id), [filtered]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allVisibleIds));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectedTotal = filtered.filter((p: any) => selected.has(p.id)).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const activeFilterCount = (timeFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0) + (sortKey !== "date_desc" ? 1 : 0);

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      <div className="page-hero">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-success/15 flex items-center justify-center shadow-[0_0_20px_hsl(var(--success)/0.2)]">
              <TrendingUp size={22} className="text-success" />
            </div>
            <div>
              <h1 className="text-headline text-2xl md:text-3xl text-foreground">Lucros</h1>
              <p className="text-muted-foreground text-sm mt-1">Registre e acompanhe seus lucros</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button onClick={handleExportCSV} className="btn-ghost">
                <Download size={14} /> CSV
              </button>
            )}
            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-premium">
              <Plus size={16} /> Novo Lucro
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-success/20 bg-gradient-to-br from-success/10 to-success/5 p-4 card-shine">
          <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center mb-2">
            <TrendingUp size={14} className="text-success" />
          </div>
          <p className="text-xl font-bold text-success">R$ {fmt(totalAll)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Geral</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Calendar size={14} className="text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(currentMonthTotal)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Este Mês</p>
            {prevMonthTotal > 0 && (
              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                Number(monthlyChange) >= 0 ? "text-success bg-success/10 border-success/20" : "text-destructive bg-destructive/10 border-destructive/20"
              }`}>
                {Number(monthlyChange) >= 0 ? "+" : ""}{monthlyChange}%
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center mb-2">
            <Wallet size={14} className="text-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(weekTotal)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Esta Semana</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center mb-2">
            <Wallet size={14} className="text-foreground" />
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(todayTotal)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Hoje</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
            <Target size={14} className="text-primary" />
          </div>
          <p className="text-xl font-bold text-primary">R$ {fmt(projection)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Projeção Mês</p>
        </div>
      </div>

      {/* Monthly chart + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 size={13} className="text-primary" /> Evolução Mensal
            </p>
            <p className="text-[10px] text-muted-foreground">Últimos 6 meses</p>
          </div>
          <div className="flex items-end gap-2 h-28">
            {monthlyData.map((m, i) => {
              const heightPct = Math.max(4, (m.amount / maxMonthly) * 100);
              const isCurrentMonth = i === 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-popover border border-border shadow-lg text-[10px] font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    R$ {fmt(m.amount)}
                  </div>
                  <div
                    className={`w-full rounded-lg transition-all duration-500 cursor-pointer ${
                      isCurrentMonth
                        ? "bg-gradient-to-t from-success/80 to-success/40 shadow-[0_0_20px_hsl(var(--success)/0.3)]"
                        : "bg-success/20 hover:bg-success/30"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className={`text-[10px] ${isCurrentMonth ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
            <Trophy size={13} className="text-primary" /> Top Fontes
          </p>
          {topDescriptions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-6">Sem dados no período</p>
          ) : (
            <div className="space-y-2">
              {topDescriptions.map(([name, val], i) => {
                const pct = total > 0 ? (val / total) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-foreground truncate flex-1 mr-2">
                        <span className="text-muted-foreground mr-1.5">#{i+1}</span>{name}
                      </span>
                      <span className="font-semibold text-success shrink-0">R$ {fmt(val)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-success/60 to-success" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Source split */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Sparkles size={12} className="text-primary" /> Composição do período:
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-muted-foreground">Operacional:</span>
            <span className="font-semibold text-foreground">R$ {fmt(opTotal)}</span>
            <span className="text-[10px] text-muted-foreground">({total > 0 ? ((opTotal/total)*100).toFixed(0) : 0}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Manual:</span>
            <span className="font-semibold text-foreground">R$ {fmt(manualTotal)}</span>
            <span className="text-[10px] text-muted-foreground">({total > 0 ? ((manualTotal/total)*100).toFixed(0) : 0}%)</span>
          </span>
          <span className="ml-auto text-muted-foreground">Média: <span className="font-semibold text-foreground">R$ {fmt(avgPerEntry)}</span></span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input ref={searchRef} type="text" placeholder="Buscar lucros... (atalho /)" value={search} onChange={e => setSearch(e.target.value)}
            className={`${inputCls} pl-9 pr-16`} />
          {!search && <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[10px] text-muted-foreground">/</kbd>}
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        </div>
        <button onClick={() => setShowFilters(s => !s)} className="btn-ghost relative">
          <SlidersHorizontal size={14} /> Filtros
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-fade-in">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Período</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["all","Todos"],["today","Hoje"],["7d","7 dias"],["30d","30 dias"],["90d","90 dias"],["ytd","Ano"]
              ] as [TimeFilter, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setTimeFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    timeFilter === k ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Origem</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["all","Todas"],["operational","Operacional"],["manual","Manual"]
              ] as [SourceFilter, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setSourceFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    sourceFilter === k ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold flex items-center gap-1"><ArrowUpDown size={10}/> Ordenar</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["date_desc","Mais recente"],["date_asc","Mais antigo"],["amount_desc","Maior valor"],["amount_asc","Menor valor"]
              ] as [SortKey, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setSortKey(k)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    sortKey === k ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => { setTimeFilter("all"); setSourceFilter("all"); setSortKey("date_desc"); }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline">Limpar filtros</button>
          )}
        </div>
      )}

      {/* Filtered total indicator */}
      {(timeFilter !== "all" || sourceFilter !== "all" || debouncedSearch) && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/5 border border-success/15">
          <TrendingUp size={14} className="text-success" />
          <span className="text-xs text-muted-foreground">Filtrado:</span>
          <span className="text-sm font-bold text-success">R$ {fmt(total)}</span>
          <span className="text-[10px] text-muted-foreground">({filtered.length} registros)</span>
        </div>
      )}

      {/* List grouped by date */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border bg-card/50">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
            <TrendingUp size={32} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-semibold text-lg">{debouncedSearch ? `Sem resultados para "${debouncedSearch}"` : "Nenhum lucro registrado"}</p>
          <p className="text-sm text-muted-foreground mt-2">Registre seus lucros para acompanhar a evolução financeira</p>
          {!debouncedSearch && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-button)" }}>
              <Plus size={14} /> Registrar Primeiro Lucro
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Select all bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/10">
            <button onClick={toggleAll} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground">
              {allSelected ? <CheckSquare size={14} className="text-primary"/> : <Square size={14}/>}
              {allSelected ? "Desmarcar tudo" : "Selecionar tudo"}
            </button>
            <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} registro(s)</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(grouped).map(([dateStr, items]: [string, any[]]) => (
              <div key={dateStr}>
                <div className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky top-0 bg-card/95 backdrop-blur-sm z-[5] border-b border-border/50">
                  <Calendar size={10} /> {dateStr}
                  <span className="text-success font-bold ml-auto text-xs normal-case">
                    +R$ {fmt(items.reduce((s: number, p: any) => s + Number(p.amount), 0))}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {items.map((p: any) => {
                    const isSel = selected.has(p.id);
                    return (
                      <div key={p.id} className={`flex items-center gap-3 px-4 py-3 group transition-colors ${isSel ? "bg-primary/5" : "hover:bg-accent/20"}`}>
                        <button onClick={() => toggleOne(p.id)} className="shrink-0 text-muted-foreground hover:text-primary">
                          {isSel ? <CheckSquare size={16} className="text-primary"/> : <Square size={16}/>}
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/10 flex items-center justify-center shrink-0">
                          <ArrowUpRight size={16} className="text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{p.description}</p>
                            {p.client_id && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-success/5 border-success/20 text-success shrink-0">Operacional</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-success shrink-0">+R$ {fmt(Number(p.amount))}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-all">
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleEdit(p)} className="gap-2 text-xs">
                              <Edit2 size={12} /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteConfirm(p.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
                              <Trash2 size={12} /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky bulk bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl bg-popover border border-border shadow-2xl animate-fade-in">
          <span className="text-xs font-semibold text-foreground">{selected.size} selecionado(s)</span>
          <span className="text-xs text-success font-bold">R$ {fmt(selectedTotal)}</span>
          <div className="h-5 w-px bg-border" />
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Limpar</button>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="h-8 text-xs">
            <Trash2 size={12} className="mr-1"/> Excluir
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? <Edit2 size={18} className="text-primary" /> : <Plus size={18} className="text-success" />}
              {editingId ? "Editar Lucro" : "Novo Lucro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição</label>
              <input type="text" placeholder="Ex: Juros recebidos, Comissão..." value={desc} onChange={e => setDesc(e.target.value)} className={inputCls} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Juros", "Comissão", "Multa", "Taxa", "Venda"].map(tag => (
                  <button key={tag} type="button" onClick={() => setDesc(tag)}
                    className="px-2 py-1 rounded-lg text-[10px] bg-muted/40 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor (R$)</label>
              <input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button disabled={saving || !desc.trim() || !amount} onClick={handleSubmit}
              className="bg-success text-success-foreground hover:bg-success/90">
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={18} /> Excluir Lucro?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={18} /> Excluir {selected.size} lucro(s)?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-success">R$ {fmt(selectedTotal)}</span>. Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Excluir Todos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Lucros;
