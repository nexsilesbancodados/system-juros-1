import { useState, useEffect } from "react";
import { Target, Plus, X, TrendingUp } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">Defina e acompanhe suas metas financeiras.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Meta
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Descrição da Meta</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Lucrar R$ 10.000 este mês" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Valor Alvo (R$)</label>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Frequência</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="Diária">Diária</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensal">Mensal</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <Target size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma meta definida.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100) : 0;
            return (
              <div key={g.id} className="rounded-xl border border-border bg-card p-5 relative group">
                <button onClick={() => handleDelete(g.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
                <h3 className="font-semibold text-foreground mb-1">{g.description}</h3>
                <p className="text-xs text-muted-foreground mb-3">{g.frequency}</p>
                <div className="w-full h-2 rounded-full bg-muted mb-2">
                  <div className="h-2 rounded-full bg-green-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    R$ {Number(g.current_amount).toFixed(2)} / R$ {Number(g.target_amount).toFixed(2)}
                  </p>
                  <button onClick={() => handleUpdateAmount(g.id, g.current_amount)} className="flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors">
                    <TrendingUp size={12} /> Atualizar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Metas;
