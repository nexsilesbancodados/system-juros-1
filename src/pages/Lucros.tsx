import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Plus, X, DollarSign, Search, Calendar, ArrowUpRight, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Lucros = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profits, setProfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");

  const fetchProfits = async () => {
    const { data } = await supabase.from("profits").select("*").order("date", { ascending: false });
    setProfits(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfits(); }, []);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleAdd = async () => {
    if (!user || !desc.trim() || !amount) return;
    setSaving(true);
    const { error } = await supabase.from("profits").insert({ user_id: user.id, description: desc.trim(), amount: parseFloat(amount) });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✓ Lucro registrado!" }); setDesc(""); setAmount(""); setShowForm(false); fetchProfits(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este lucro?")) return;
    await supabase.from("profits").delete().eq("id", id);
    fetchProfits();
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

  // Monthly mini chart (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStr = d.toLocaleDateString("pt-BR", { month: "short" }).slice(0, 3);
      const amount = profits.filter(p => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      }).reduce((s, p) => s + Number(p.amount), 0);
      return { month: monthStr, amount };
    });
  }, [profits]);
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  // Group by date
  const grouped = filtered.reduce((acc, p) => {
    const key = new Date(p.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced";

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lucros</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Registre e acompanhe seus lucros.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20 focus-ring"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Lucro
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ArrowUpRight size={20} className="text-success" /> Novo Lucro
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div>
              <label className="text-label mb-1.5 block">Descrição</label>
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Juros do cliente X" className={inputCls} autoFocus />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Valor (R$)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" className={inputCls} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={handleAdd} disabled={saving || !desc || !amount} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-fade-in">
        <div className="rounded-xl border border-border bg-card p-5 card-shine success-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp size={22} className="text-success" />
            </div>
            <div>
              <p className="text-label">Total de Lucros</p>
              <p className="text-2xl font-bold text-success">R$ {fmt(totalAll)}</p>
            </div>
          </div>
          {timeFilter !== "all" && (
            <p className="text-xs text-muted-foreground">Filtrado: <span className="text-success font-semibold">R$ {fmt(total)}</span></p>
          )}
        </div>

        {/* Mini monthly chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-label mb-3">Últimos 6 meses</p>
          <div className="flex items-end gap-2 h-14">
            {monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-success/50 transition-all duration-500"
                  style={{ height: `${Math.max(3, (m.amount / maxMonthly) * 44)}px` }}
                />
                <span className="text-[9px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar lucros..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground input-enhanced" />
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

      {/* List grouped by date */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><TrendingUp size={28} className="text-muted-foreground/30" /></div>
          <p className="text-foreground font-medium">{search ? `Sem resultados para "${search}"` : "Nenhum lucro registrado"}</p>
          <p className="text-sm text-muted-foreground mt-1">Registre seus lucros para acompanhar a evolução</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(grouped).map(([date, items]: [string, any[]]) => (
              <div key={date}>
                <div className="divider-label px-4 py-2 sticky top-0 bg-card/90 backdrop-blur-sm z-[5]">
                  <Calendar size={10} /> {date}
                  <span className="text-success font-semibold ml-1">+R$ {fmt(items.reduce((s: number, p: any) => s + Number(p.amount), 0))}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {items.map((p: any) => (
                    <div key={p.id} className="data-row group">
                      <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                        <ArrowUpRight size={16} className="text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.description}</p>
                      </div>
                      <span className="text-sm font-bold text-success">+R$ {fmt(Number(p.amount))}</span>
                      <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-1"><X size={14} /></button>
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

export default Lucros;
