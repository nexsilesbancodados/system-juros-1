import { useState, useEffect } from "react";
import { CheckSquare, Plus, Trash2, CheckCircle, Circle, Calendar, GripVertical, Star, StarOff, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Tarefas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

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
      toast({ title: "✓ Tarefa adicionada!" });
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

  const handleClearDone = async () => {
    if (!confirm("Limpar todas as tarefas concluídas?")) return;
    const doneIds = todos.filter(t => t.is_complete).map(t => t.id);
    for (const id of doneIds) await supabase.from("todos").delete().eq("id", id);
    fetchTodos();
    toast({ title: `${doneIds.length} tarefa(s) removida(s)` });
  };

  const all = todos;
  const pending = todos.filter((t) => !t.is_complete);
  const done = todos.filter((t) => t.is_complete);
  const displayed = filter === "pending" ? pending : filter === "done" ? done : all;

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare size={24} className="text-primary" /> Tarefas
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Organize suas tarefas diárias.</p>
        </div>
        <span className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-1.5">
          <Calendar size={12} className="inline mr-1" />{today}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 stagger-fade-in">
        {[
          { label: "Total", value: all.length, accent: "text-foreground", f: "all" as const },
          { label: "Pendentes", value: pending.length, accent: "text-warning", f: "pending" as const },
          { label: "Concluídas", value: done.length, accent: "text-success", f: "done" as const },
        ].map(s => (
          <button key={s.label} onClick={() => setFilter(s.f)}
            className={`rounded-2xl border p-4 text-center transition-all card-hover ${filter === s.f ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
            <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </button>
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
          className="flex-1 px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced"
        />
        <button onClick={handleAdd}
          className="px-4 py-3 rounded-xl text-sm font-semibold text-primary-foreground shrink-0 transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={18} />
        </button>
      </div>

      {/* Clear done */}
      {done.length > 0 && (
        <div className="flex justify-end">
          <button onClick={handleClearDone} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
            <Trash2 size={12} /> Limpar concluídas ({done.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl skeleton-shimmer" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <CheckSquare size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-medium">
            {filter === "done" ? "Nenhuma tarefa concluída" : filter === "pending" ? "Nenhuma tarefa pendente" : "Nenhuma tarefa"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "all" ? "Adicione uma tarefa acima para começar" : "Mude o filtro para ver outras tarefas"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayed.map((t, i) => {
            const isDone = t.is_complete;
            return (
              <div key={t.id}
                className={`rounded-2xl border bg-card p-3.5 flex items-center gap-3 group card-hover animate-fade-in ${isDone ? "border-border/50 opacity-60" : "border-border"}`}
                style={{ animationDelay: `${i * 30}ms` }}>
                <button onClick={() => handleToggle(t.id, t.is_complete)}
                  className={`shrink-0 transition-all duration-200 ${isDone ? "text-success" : "text-muted-foreground hover:text-primary"}`}>
                  {isDone ? <CheckCircle size={22} /> : <Circle size={22} />}
                </button>
                <span className={`text-sm flex-1 ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {t.task || "Sem título"}
                </span>
                <span className="text-[10px] text-muted-foreground/50 hidden sm:block">
                  {new Date(t.created_at).toLocaleDateString("pt-BR")}
                </span>
                <button onClick={() => handleDelete(t.id)}
                  className="text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Productivity tip */}
      {pending.length > 5 && (
        <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-xs text-warning flex items-center gap-2 animate-fade-in">
          <Filter size={14} />
          Você tem {pending.length} tarefas pendentes. Considere priorizar as mais importantes!
        </div>
      )}
    </div>
  );
};

export default Tarefas;
