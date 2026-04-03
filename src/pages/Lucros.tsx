import { useState, useEffect } from "react";
import { TrendingUp, Plus, X } from "lucide-react";
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

  const fetchProfits = async () => {
    const { data } = await supabase.from("profits").select("*").order("date", { ascending: false });
    setProfits(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfits(); }, []);

  const total = profits.reduce((acc, p) => acc + Number(p.amount), 0);

  const handleAdd = async () => {
    if (!user || !desc.trim() || !amount) return;
    setSaving(true);
    const { error } = await supabase.from("profits").insert({
      user_id: user.id,
      description: desc.trim(),
      amount: parseFloat(amount),
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lucro registrado!" });
      setDesc(""); setAmount(""); setShowForm(false);
      fetchProfits();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("profits").delete().eq("id", id);
    fetchProfits();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lucros</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre e acompanhe seus lucros.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Lucro
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Descrição</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Juros do cliente X" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Valor (R$)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Total de Lucros</p>
        <p className="text-3xl font-bold text-green-400 mt-1">R$ {total.toFixed(2)}</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : profits.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum lucro registrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {profits.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{p.description}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-green-400 font-semibold">R$ {Number(p.amount).toFixed(2)}</span>
                <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive transition-colors"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lucros;
