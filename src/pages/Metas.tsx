import { useState, useEffect } from "react";
import { Target, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Metas = () => {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
      setGoals(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas</h1>
          <p className="text-muted-foreground text-sm mt-1">Defina e acompanhe suas metas financeiras.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Meta
        </button>
      </div>

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
              <div key={g.id} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-1">{g.description}</h3>
                <p className="text-xs text-muted-foreground mb-3">{g.frequency}</p>
                <div className="w-full h-2 rounded-full bg-muted mb-2">
                  <div className="h-2 rounded-full bg-green-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  R$ {Number(g.current_amount).toFixed(2)} / R$ {Number(g.target_amount).toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Metas;
