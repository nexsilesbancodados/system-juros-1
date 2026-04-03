import { useState, useEffect } from "react";
import { DollarSign, Plus, X, ArrowDownRight } from "lucide-react";
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

  const fetchExpenses = async () => {
    const { data } = await supabase.from("expenses").select("*").order("date", { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
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
    else { toast({ title: "Gasto registrado!" }); setDesc(""); setAmount(""); setCategory(""); setShowForm(false); fetchExpenses(); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    fetchExpenses();
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  // Group by category
  const categories = [...new Set(expenses.map(e => e.category || "Sem categoria"))];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle suas despesas.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Gasto
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-scale-in">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Aluguel do escritório" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Valor (R$)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Categoria</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Operacional" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <ArrowDownRight size={22} className="text-destructive" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total de Gastos</p>
            <p className="text-3xl font-bold text-destructive">R$ {fmt(total)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por Categoria</p>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const catTotal = expenses.filter(e => (e.category || "Sem categoria") === cat).reduce((s, e) => s + Number(e.amount), 0);
              return (
                <span key={cat} className="text-xs px-2.5 py-1 rounded-lg bg-accent text-foreground">
                  {cat}: <span className="font-semibold">R$ {fmt(catTotal)}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <DollarSign size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Nenhum gasto registrado</p>
          <p className="text-sm text-muted-foreground mt-1">Registre seus gastos para controlar despesas</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {expenses.map((e, i) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors group animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <ArrowDownRight size={16} className="text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{e.description}</p>
                <p className="text-xs text-muted-foreground">{e.category || "Sem categoria"} · {new Date(e.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className="text-sm font-bold text-destructive">-R$ {fmt(Number(e.amount))}</span>
              <button onClick={() => handleDelete(e.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gastos;
