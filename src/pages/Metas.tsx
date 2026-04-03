import { useState, useEffect } from "react";
import { Target, Plus, X, TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Metas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState("");
  const [frequency, setFrequency] = useState("Mensal");
  const [saving, setSaving] = useState(false);

  const fetchGoals = async () => {
    const { data } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
    setGoals(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGoals(); }, []);

  const handleAdd = async () => {
    if (!user || !desc.trim() || !target) return;
    setSaving(true);
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      description: desc.trim(),
      target_amount: parseFloat(target),
      frequency,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Meta criada!" });
      setDesc(""); setTarget(""); setFrequency("Mensal"); setShowForm(false);
      fetchGoals();
    }
  };

  const handleUpdateAmount = async (id: string, currentAmount: number) => {
    const input = prompt("Novo valor atual (R$):", String(currentAmount));
    if (input === null) return;
    const val = parseFloat(input);
    if (isNaN(val)) return;
    await supabase.from("goals").update({ current_amount: val }).eq("id", id);
    fetchGoals();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    toast({ title: "Meta removida!" });
    fetchGoals();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const overallPct = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">Defina e acompanhe suas metas financeiras.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Meta
        </button>
      </div>

      {/* Overall Progress */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-primary" />
              <span className="font-semibold text-foreground">Progresso Geral</span>
            </div>
            <span className="text-sm font-bold text-primary">{overallPct.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallPct}%`, background: "var(--gradient-gold)" }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">R$ {fmt(totalCurrent)} de R$ {fmt(totalTarget)}</p>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-scale-in">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição da Meta</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Lucrar R$ 10.000 este mês" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Valor Alvo (R$)</label>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Frequência</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
                <option value="Diária">Diária</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensal">Mensal</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-primary/20"
              style={{ background: "var(--gradient-button)" }}>
              {saving ? "Salvando..." : "Criar Meta"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Target size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Nenhuma meta definida</p>
          <p className="text-sm text-muted-foreground mt-1">Crie uma meta e acompanhe seu progresso</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g, i) => {
            const pct = g.target_amount > 0 ? Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100) : 0;
            const isComplete = pct >= 100;
            return (
              <div key={g.id} className="rounded-xl border border-border bg-card p-5 relative group card-hover animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <button onClick={() => handleDelete(g.id)} className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? "bg-success/10" : "bg-primary/8"}`}>
                    {isComplete ? <Trophy size={18} className="text-success" /> : <Target size={18} className="text-primary" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{g.description}</h3>
                    <p className="text-xs text-muted-foreground">{g.frequency}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">R$ {fmt(Number(g.current_amount))} / R$ {fmt(Number(g.target_amount))}</p>
                    <span className={`text-xs font-bold ${isComplete ? "text-success" : "text-primary"}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: isComplete ? "hsl(var(--success))" : "var(--gradient-gold)" }} />
                  </div>
                </div>
                <button onClick={() => handleUpdateAmount(g.id, g.current_amount)} className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                  <TrendingUp size={12} /> Atualizar valor
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Metas;
