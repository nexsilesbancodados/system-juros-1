import { useState, useEffect } from "react";
import { CheckSquare, Plus, Trash2, CheckCircle, Circle } from "lucide-react";
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

  const pending = todos.filter((t) => !t.is_complete);
  const done = todos.filter((t) => t.is_complete);

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
        <p className="text-muted-foreground text-sm mt-1">Organize suas tarefas diárias.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: todos.length, accent: "text-foreground" },
          { label: "Pendentes", value: pending.length, accent: "text-warning" },
          { label: "Concluídas", value: done.length, accent: "text-success" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nova tarefa... (Enter para adicionar)"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
        <button onClick={handleAdd}
          className="px-4 py-3 rounded-xl text-sm font-semibold text-primary-foreground shrink-0 transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={18} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : todos.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <CheckSquare size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Nenhuma tarefa</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione uma tarefa acima para começar</p>
        </div>
      ) : (
        <div className="space-y-5">
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Pendentes ({pending.length})</p>
              {pending.map((t, i) => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 group card-hover animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <button onClick={() => handleToggle(t.id, t.is_complete)} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                    <Circle size={20} />
                  </button>
                  <span className="text-sm text-foreground flex-1">{t.task || "Sem título"}</span>
                  <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Concluídas ({done.length})</p>
              {done.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card/50 p-3.5 flex items-center gap-3 opacity-60 group">
                  <button onClick={() => handleToggle(t.id, t.is_complete)} className="text-success shrink-0">
                    <CheckCircle size={20} />
                  </button>
                  <span className="text-sm text-muted-foreground line-through flex-1">{t.task || "Sem título"}</span>
                  <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
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
