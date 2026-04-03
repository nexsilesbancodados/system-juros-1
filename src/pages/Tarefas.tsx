import { useState, useEffect } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Tarefas = () => {
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("todos").select("*").order("created_at", { ascending: false });
      setTodos(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground text-sm mt-1">Organize suas tarefas diárias.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Tarefa
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todos.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${t.is_complete ? "border-green-400 bg-green-400/20" : "border-muted-foreground"}`}>
                {t.is_complete && <span className="text-green-400 text-xs">✓</span>}
              </div>
              <span className={`text-sm ${t.is_complete ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.task || "Sem título"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tarefas;
