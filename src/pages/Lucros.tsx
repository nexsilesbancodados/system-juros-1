import { useState, useEffect } from "react";
import { TrendingUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Lucros = () => {
  const [profits, setProfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("profits").select("*").order("date", { ascending: false });
      setProfits(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const total = profits.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lucros</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre e acompanhe seus lucros.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Lucro
        </button>
      </div>

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
              <span className="text-green-400 font-semibold">R$ {Number(p.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lucros;
