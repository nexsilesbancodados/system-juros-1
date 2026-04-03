import { useState, useEffect } from "react";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Tarefas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");

  const fetchTodos = async () => {
    const { data } = await supabase.from("todos").select("*").order("created_at", { ascending: false });
    setTodos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTodos(); }, []);

  const handleAdd = async () => {
    if (!user || !newTask.trim()) return;
    const { error } = await supabase.from("todos").insert({ user_id: user.id, task: newTask.trim() });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewTask("");
      fetchTodos();
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from("todos").update({ is_complete: !current }).eq("id", id);
    fetchTodos();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("todos").delete().eq("id", id);
    fetchTodos();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const pending = todos.filter((t) => !t.is_complete);
  const done = todos.filter((t) => t.is_complete);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
        <p className="text-muted-foreground text-sm mt-1">Organize suas tarefas diárias.</p>
      </div>

      {/* Add */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nova tarefa..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={handleAdd} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma tarefa. Adicione uma acima!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pendentes ({pending.length})</p>
              {pending.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                  <button onClick={() => handleToggle(t.id, t.is_complete)} className="w-5 h-5 rounded border-2 border-muted-foreground flex items-center justify-center hover:border-foreground transition-colors flex-shrink-0" />
                  <span className="text-sm text-foreground flex-1">{t.task || "Sem título"}</span>
                  <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Concluídas ({done.length})</p>
              {done.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-card/50 p-3 flex items-center gap-3 opacity-60">
                  <button onClick={() => handleToggle(t.id, t.is_complete)} className="w-5 h-5 rounded border-2 border-green-400 bg-green-400/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-xs">✓</span>
                  </button>
                  <span className="text-sm text-muted-foreground line-through flex-1">{t.task || "Sem título"}</span>
                  <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Tarefas;
