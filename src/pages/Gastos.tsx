import { useState, useEffect, useMemo } from "react";
import { DollarSign, Plus, X, ArrowDownRight, Search, Calendar, Tag, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Gastos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");

  const fetchExpenses = async () => {
    const { data } = await supabase.from("expenses").select("*").order("date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleAdd = async () => {
    if (!user || !desc.trim() || !amount) return;
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: user.id, description: desc.trim(), amount: parseFloat(amount),
      date: new Date().toISOString(), category: category.trim() || null,
    });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✓ Gasto registrado!" }); setDesc(""); setAmount(""); setCategory(""); setShowForm(false); fetchExpenses(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este gasto?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    fetchExpenses();
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

  // Category breakdown with proportional bars
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

  // Group by date
  const grouped = filtered.reduce((acc, e) => {
    const key = new Date(e.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, any[]>);

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced";

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Controle suas despesas.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20 focus-ring"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Gasto
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ArrowDownRight size={20} className="text-destructive" /> Novo Gasto
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div>
              <label className="text-label mb-1.5 block">Descrição</label>
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Aluguel do escritório" className={inputCls} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-label mb-1.5 block">Valor (R$)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="text-label mb-1.5 block">Categoria</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Operacional" className={inputCls} list="cat-list" />
                <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={handleAdd} disabled={saving || !desc || !amount} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-fade-in">
        <div className="rounded-2xl border border-border bg-card p-5 card-shine danger-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ArrowDownRight size={22} className="text-destructive" />
            </div>
            <div>
              <p className="text-label">Total de Gastos</p>
              <p className="text-2xl font-bold text-destructive">R$ {fmt(totalAll)}</p>
            </div>
          </div>
          {timeFilter !== "all" && (
            <p className="text-xs text-muted-foreground">Filtrado: <span className="text-destructive font-semibold">R$ {fmt(totalFiltered)}</span></p>
          )}
        </div>

        {/* Category breakdown */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <PieChart size={14} className="text-primary" />
            <p className="text-label">Por Categoria</p>
          </div>
          <div className="space-y-2">
            {catBreakdown.slice(0, 4).map(({ cat, total, pct }) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? "all" : cat)}
                className={`w-full text-left transition-all ${catFilter === cat ? "ring-1 ring-primary/30 rounded-lg" : ""}`}
              >
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium text-foreground truncate mr-2">{cat}</span>
                  <span className="text-muted-foreground shrink-0">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar gastos..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground input-enhanced" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X size={14} className="text-muted-foreground" /></button>}
        </div>
        <div className="pill-tabs">
          {(["all", "7d", "30d", "90d"] as const).map(f => (
            <button key={f} onClick={() => setTimeFilter(f)} className={`pill-tab text-[10px] px-3 py-1.5 ${timeFilter === f ? "pill-tab-active" : "pill-tab-inactive"}`}>
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter chips */}
      {catFilter !== "all" && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Tag size={12} className="text-muted-foreground" />
          <span className="text-xs text-foreground font-medium">{catFilter}</span>
          <button onClick={() => setCatFilter("all")} className="p-0.5 rounded hover:bg-accent"><X size={12} className="text-muted-foreground" /></button>
        </div>
      )}

      {/* List grouped by date */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><DollarSign size={28} className="text-muted-foreground/30" /></div>
          <p className="text-foreground font-medium">{search || catFilter !== "all" ? "Sem resultados" : "Nenhum gasto registrado"}</p>
          <p className="text-sm text-muted-foreground mt-1">Registre seus gastos para controlar despesas</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(grouped).map(([date, items]: [string, any[]]) => (
              <div key={date}>
                <div className="divider-label px-4 py-2 sticky top-0 bg-card/90 backdrop-blur-sm z-[5]">
                  <Calendar size={10} /> {date}
                  <span className="text-destructive font-semibold ml-1">−R$ {fmt(items.reduce((s: number, e: any) => s + Number(e.amount), 0))}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {items.map((e: any) => (
                    <div key={e.id} className="data-row group">
                      <div className="w-9 h-9 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
                        <ArrowDownRight size={16} className="text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.description}</p>
                        <p className="text-[10px] text-muted-foreground">{e.category || "Sem categoria"}</p>
                      </div>
                      <span className="text-sm font-bold text-destructive">−R$ {fmt(Number(e.amount))}</span>
                      <button onClick={() => handleDelete(e.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-1"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;
