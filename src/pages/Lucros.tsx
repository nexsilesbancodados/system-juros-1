import { useState, useEffect } from "react";
import { TrendingUp, Plus, X, DollarSign } from "lucide-react";
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
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleAdd = async () => {
    if (!user || !desc.trim() || !amount) return;
    setSaving(true);
    const { error } = await supabase.from("profits").insert({ user_id: user.id, description: desc.trim(), amount: parseFloat(amount) });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Lucro registrado!" }); setDesc(""); setAmount(""); setShowForm(false); fetchProfits(); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("profits").delete().eq("id", id);
    fetchProfits();
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lucros</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre e acompanhe seus lucros.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Lucro
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-scale-in">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Juros do cliente X" className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Valor (R$)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
          <TrendingUp size={22} className="text-success" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total de Lucros</p>
          <p className="text-3xl font-bold text-success">R$ {fmt(total)}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : profits.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <TrendingUp size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Nenhum lucro registrado</p>
          <p className="text-sm text-muted-foreground mt-1">Registre seus lucros para acompanhar a evolução</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {profits.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors group animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <DollarSign size={16} className="text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.description}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className="text-sm font-bold text-success">+R$ {fmt(Number(p.amount))}</span>
              <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lucros;
