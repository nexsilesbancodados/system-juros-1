import { useState, useEffect, useMemo } from "react";
import { DollarSign, Plus, X, ArrowDownRight, Search, Calendar, Tag, PieChart, Edit2, Check, Download, Trash2, MoreVertical, BarChart3, TrendingDown, Receipt } from "lucide-react";
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

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_COLORS: Record<string, string> = {
  "Operacional": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Pessoal": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "Transporte": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Alimentação": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Marketing": "bg-pink-500/10 text-pink-500 border-pink-500/20",
  "Equipamentos": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  "Impostos": "bg-red-500/10 text-red-500 border-red-500/20",
  "Outros": "bg-muted text-muted-foreground border-border",
};

const getCategoryStyle = (cat: string) =>
  CATEGORY_COLORS[cat] || "bg-accent/30 text-foreground border-border";

const SUGGESTED_CATEGORIES = ["Operacional", "Pessoal", "Transporte", "Alimentação", "Marketing", "Equipamentos", "Impostos", "Outros"];

const Gastos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchExpenses = async () => {
    const { data } = await supabase.from("expenses").select("*").order("date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const resetForm = () => {
    setDesc(""); setAmount(""); setCategory(""); setDate(new Date().toISOString().slice(0, 10));
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (e: any) => {
    setDesc(e.description); setAmount(String(e.amount));
    setCategory(e.category || ""); setDate(new Date(e.date).toISOString().slice(0, 10));
    setEditingId(e.id); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!user || !desc.trim() || !amount) return;
    setSaving(true);

    const payload = {
      description: desc.trim(), amount: parseFloat(amount),
      date: new Date(date).toISOString(), category: category.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✓ Gasto atualizado!" }); resetForm(); fetchExpenses(); }
    } else {
      const { error } = await supabase.from("expenses").insert({ ...payload, user_id: user.id });
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✓ Gasto registrado!" }); resetForm(); fetchExpenses(); }
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchExpenses();
    toast({ title: "Gasto excluído" });
  };

  const handleExportCSV = () => {
    const header = "Data,Descrição,Categoria,Valor\n";
    const rows = filtered.map(e =>
      `${new Date(e.date).toLocaleDateString("pt-BR")},"${e.description}","${e.category || ""}",${Number(e.amount).toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "gastos.csv"; a.click();
    toast({ title: "CSV exportado!" });
  };

  const categories = useMemo(() => [...new Set(expenses.map(e => e.category || "Sem categoria"))], [expenses]);

  const filtered = useMemo(() => {
    const now = new Date();
    const filterDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = filterDays[timeFilter];
    return expenses.filter(e => {
      if (days) {
        const diff = (now.getTime() - new Date(e.date).getTime()) / 86400000;
        if (diff > days) return false;
      }
      if (catFilter !== "all" && (e.category || "Sem categoria") !== catFilter) return false;
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [expenses, search, catFilter, timeFilter]);

  const totalFiltered = filtered.reduce((acc, e) => acc + Number(e.amount), 0);
  const totalAll = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      const cat = e.category || "Sem categoria";
      map.set(cat, (map.get(cat) || 0) + Number(e.amount));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({ cat, total, pct: totalAll > 0 ? (total / totalAll) * 100 : 0 }));
  }, [expenses, totalAll]);

  // Monthly data
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStr = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const amount = expenses.filter(e => {
        const ed = new Date(e.date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      }).reduce((s, e) => s + Number(e.amount), 0);
      return { month: monthStr, amount };
    });
  }, [expenses]);
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  const currentMonthTotal = monthlyData[5]?.amount || 0;
  const prevMonthTotal = monthlyData[4]?.amount || 0;
  const monthlyChange = prevMonthTotal > 0
    ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal * 100).toFixed(1)
    : currentMonthTotal > 0 ? "+100" : "0";

  const todayTotal = expenses.filter(e => {
    const d = new Date(e.date);
    return d.toDateString() === new Date().toDateString();
  }).reduce((s, e) => s + Number(e.amount), 0);

  // Group by date
  const grouped = filtered.reduce((acc, e) => {
    const key = new Date(e.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, any[]>);

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <TrendingDown size={20} className="text-destructive" />
            </div>
            Gastos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Controle suas despesas por categoria</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-border bg-card text-foreground hover:bg-accent transition-colors">
              <Download size={14} /> CSV
            </button>
          )}
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="action-btn-primary">
            <Plus size={16} /> Novo Gasto
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 card-shine">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown size={14} className="text-destructive" />
            </div>
          </div>
          <p className="text-xl font-bold text-destructive">R$ {fmt(totalAll)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Geral</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar size={14} className="text-primary" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(currentMonthTotal)}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Este Mês</p>
            {prevMonthTotal > 0 && (
              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                Number(monthlyChange) <= 0 ? "text-success bg-success/10 border-success/20" : "text-destructive bg-destructive/10 border-destructive/20"
              }`}>
                {Number(monthlyChange) >= 0 ? "+" : ""}{monthlyChange}%
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
              <Receipt size={14} className="text-foreground" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(todayTotal)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Hoje</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
              <Tag size={14} className="text-foreground" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">{categories.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Categorias</p>
        </div>
      </div>

      {/* Monthly Chart + Category Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Monthly chart */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 size={13} className="text-primary" /> Evolução Mensal
            </p>
            <p className="text-[10px] text-muted-foreground">Últimos 6 meses</p>
          </div>
          <div className="flex items-end gap-2 h-24">
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
                        ? "bg-gradient-to-t from-destructive/80 to-destructive/40"
                        : "bg-destructive/20 hover:bg-destructive/30"
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

        {/* Category breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={13} className="text-primary" />
            <p className="text-xs font-semibold text-foreground">Por Categoria</p>
          </div>
          <div className="space-y-2.5">
            {catBreakdown.slice(0, 5).map(({ cat, total, pct }) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? "all" : cat)}
                className={`w-full text-left transition-all rounded-lg p-1.5 -mx-1.5 ${
                  catFilter === cat ? "ring-1 ring-primary/30 bg-primary/5" : "hover:bg-accent/20"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground truncate mr-2 flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${getCategoryStyle(cat).split(" ")[0]?.replace("/10", "/60").replace("/30", "/60")}`} />
                    {cat}
                  </span>
                  <span className="text-muted-foreground shrink-0">R$ {fmt(total)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive/50 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            ))}
            {catBreakdown.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma categoria registrada</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar gastos..." value={search} onChange={e => setSearch(e.target.value)}
            className={`${inputCls} pl-9`} />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        </div>
        <div className="flex rounded-xl border border-border bg-card overflow-hidden">
          {(["all", "7d", "30d", "90d"] as const).map(f => (
            <button key={f} onClick={() => setTimeFilter(f)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                timeFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}>
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Active category filter */}
      {catFilter !== "all" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/5 border border-destructive/15">
          <Tag size={12} className="text-destructive" />
          <span className="text-xs text-muted-foreground">Categoria:</span>
          <Badge variant="outline" className={`text-[10px] ${getCategoryStyle(catFilter)}`}>{catFilter}</Badge>
          <span className="text-sm font-bold text-destructive ml-auto">R$ {fmt(totalFiltered)}</span>
          <button onClick={() => setCatFilter("all")} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Filtered total (time only) */}
      {timeFilter !== "all" && catFilter === "all" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/5 border border-destructive/15">
          <TrendingDown size={14} className="text-destructive" />
          <span className="text-xs text-muted-foreground">Período filtrado:</span>
          <span className="text-sm font-bold text-destructive">R$ {fmt(totalFiltered)}</span>
          <span className="text-[10px] text-muted-foreground">({filtered.length} registros)</span>
        </div>
      )}

      {/* List grouped by date */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border bg-card/50">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
            <DollarSign size={32} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-semibold text-lg">
            {search || catFilter !== "all" ? "Sem resultados" : "Nenhum gasto registrado"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">Registre seus gastos para controlar as despesas</p>
          {!search && catFilter === "all" && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="action-btn-primary">
              <Plus size={14} /> Registrar Primeiro Gasto
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(grouped).map(([dateStr, items]: [string, any[]]) => (
              <div key={dateStr}>
                <div className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky top-0 bg-card/95 backdrop-blur-sm z-[5] border-b border-border/50">
                  <Calendar size={10} /> {dateStr}
                  <span className="text-destructive font-bold ml-auto text-xs normal-case">
                    −R$ {fmt(items.reduce((s: number, e: any) => s + Number(e.amount), 0))}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {items.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-accent/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/10 flex items-center justify-center shrink-0">
                        <ArrowDownRight size={16} className="text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getCategoryStyle(e.category || "Sem categoria")}`}>
                            {e.category || "Sem categoria"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-destructive shrink-0">−R$ {fmt(Number(e.amount))}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-all">
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(e)} className="gap-2 text-xs">
                            <Edit2 size={12} /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteConfirm(e.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
                            <Trash2 size={12} /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownRight size={18} className="text-destructive" />
              {editingId ? "Editar Gasto" : "Novo Gasto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição *</label>
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Aluguel do escritório" className={inputCls} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor (R$) *</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoria</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Operacional" className={inputCls} list="cat-list" />
              <datalist id="cat-list">
                {[...new Set([...SUGGESTED_CATEGORIES, ...categories])].map(c => <option key={c} value={c} />)}
              </datalist>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_CATEGORIES.slice(0, 6).map(c => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                      category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/30"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !desc || !amount} variant="destructive">
              {editingId ? <Check size={14} className="mr-1.5" /> : <Plus size={14} className="mr-1.5" />}
              {saving ? "Salvando..." : editingId ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={18} /> Excluir Gasto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este registro de gasto?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 size={14} className="mr-1.5" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gastos;
