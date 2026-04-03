import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Plus, X, Search, Calendar, ArrowUpRight, Edit2, Check, Download, Trash2, MoreVertical, BarChart3, Wallet } from "lucide-react";
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

const Lucros = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profits, setProfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchProfits = async () => {
    const { data } = await supabase.from("profits").select("*").order("date", { ascending: false });
    setProfits(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfits(); }, []);

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
      else { toast({ title: "✓ Lucro atualizado!" }); resetForm(); fetchProfits(); }
    } else {
      const { error } = await supabase.from("profits")
        .insert({ user_id: user.id, description: desc.trim(), amount: parseFloat(amount), date: new Date(date).toISOString() });
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "✓ Lucro registrado!" }); resetForm(); fetchProfits(); }
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("profits").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchProfits();
    toast({ title: "Lucro excluído" });
  };

  const handleExportCSV = () => {
    const header = "Data,Descrição,Valor\n";
    const rows = filtered.map(p =>
      `${new Date(p.date).toLocaleDateString("pt-BR")},"${p.description}",${Number(p.amount).toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lucros.csv"; a.click();
    toast({ title: "CSV exportado!" });
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const filterDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = filterDays[timeFilter];
    return profits.filter(p => {
      if (days) {
        const diff = (now.getTime() - new Date(p.date).getTime()) / 86400000;
        if (diff > days) return false;
      }
      if (search && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [profits, search, timeFilter]);

  const total = filtered.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalAll = profits.reduce((acc, p) => acc + Number(p.amount), 0);

  // Monthly data (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStr = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const amount = profits.filter(p => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      }).reduce((s, p) => s + Number(p.amount), 0);
      return { month: monthStr, amount };
    });
  }, [profits]);
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  // Current vs previous month comparison
  const currentMonthTotal = monthlyData[5]?.amount || 0;
  const prevMonthTotal = monthlyData[4]?.amount || 0;
  const monthlyChange = prevMonthTotal > 0
    ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal * 100).toFixed(1)
    : currentMonthTotal > 0 ? "+100" : "0";

  // Average per entry
  const avgPerEntry = profits.length > 0 ? totalAll / profits.length : 0;

  // Today's total
  const todayTotal = profits.filter(p => {
    const d = new Date(p.date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).reduce((s, p) => s + Number(p.amount), 0);

  // Group by date
  const grouped = filtered.reduce((acc, p) => {
    const key = new Date(p.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp size={20} className="text-success" />
            </div>
            Lucros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Registre e acompanhe seus lucros</p>
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
            <Plus size={16} /> Novo Lucro
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 card-shine">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-success" />
            </div>
          </div>
          <p className="text-xl font-bold text-success">R$ {fmt(totalAll)}</p>
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
                Number(monthlyChange) >= 0 ? "text-success bg-success/10 border-success/20" : "text-destructive bg-destructive/10 border-destructive/20"
              }`}>
                {Number(monthlyChange) >= 0 ? "+" : ""}{monthlyChange}%
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
              <Wallet size={14} className="text-foreground" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(todayTotal)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Hoje</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center">
              <BarChart3 size={14} className="text-foreground" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">R$ {fmt(avgPerEntry)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Média p/ Registro</p>
        </div>
      </div>

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
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-popover border border-border shadow-lg text-[10px] font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  R$ {fmt(m.amount)}
                </div>
                <div
                  className={`w-full rounded-lg transition-all duration-500 cursor-pointer ${
                    isCurrentMonth
                      ? "bg-gradient-to-t from-success/80 to-success/40"
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar lucros..." value={search} onChange={e => setSearch(e.target.value)}
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

      {/* Filtered total indicator */}
      {timeFilter !== "all" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/5 border border-success/15">
          <TrendingUp size={14} className="text-success" />
          <span className="text-xs text-muted-foreground">Período filtrado:</span>
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
          <p className="text-foreground font-semibold text-lg">{search ? `Sem resultados para "${search}"` : "Nenhum lucro registrado"}</p>
          <p className="text-sm text-muted-foreground mt-2">Registre seus lucros para acompanhar a evolução financeira</p>
          {!search && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="action-btn-primary">
              <Plus size={14} /> Registrar Primeiro Lucro
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
                  <span className="text-success font-bold ml-auto text-xs normal-case">
                    +R$ {fmt(items.reduce((s: number, p: any) => s + Number(p.amount), 0))}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {items.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-accent/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/10 flex items-center justify-center shrink-0">
                        <ArrowUpRight size={16} className="text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.description}</p>
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
              <ArrowUpRight size={18} className="text-success" />
              {editingId ? "Editar Lucro" : "Novo Lucro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição *</label>
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Juros do cliente X" className={inputCls} autoFocus />
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
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || !desc || !amount}
              className="bg-success hover:bg-success/90 text-success-foreground">
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
              <Trash2 size={18} /> Excluir Lucro
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este registro de lucro?</p>
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

export default Lucros;
