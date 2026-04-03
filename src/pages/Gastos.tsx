import { useState, useEffect } from "react";
import { DollarSign, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Gastos = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      setExpenses(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle suas despesas.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Gasto
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Total de Gastos</p>
        <p className="text-3xl font-bold text-destructive mt-1">R$ {total.toFixed(2)}</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum gasto registrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{e.description}</p>
                <p className="text-xs text-muted-foreground">{e.category || "Sem categoria"} · {new Date(e.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className="text-destructive font-semibold">R$ {Number(e.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gastos;
