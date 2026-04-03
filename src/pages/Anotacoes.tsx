import { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Anotacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");

  const fetchNotes = async () => {
    const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    setNotes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleAdd = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("notes").insert({ user_id: user.id, title: title.trim() });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Anotação criada!" }); setTitle(""); setShowForm(false); fetchNotes(); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    fetchNotes();
  };

  const colors = [
    "bg-primary/5 border-primary/15",
    "bg-success/5 border-success/15",
    "bg-warning/5 border-warning/15",
    "bg-info/5 border-info/15",
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anotações</h1>
          <p className="text-muted-foreground text-sm mt-1">Suas notas e lembretes.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Anotação
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 animate-scale-in">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Título</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lembrar de cobrar fulano"
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <StickyNote size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Nenhuma anotação</p>
          <p className="text-sm text-muted-foreground mt-1">Crie uma anotação para não esquecer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((n, i) => (
            <div key={n.id} className={`rounded-xl border p-5 group relative card-hover animate-fade-in ${colors[i % colors.length]}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-3">
                <StickyNote size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground pr-6">{n.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Calendar size={11} /> {new Date(n.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(n.id)} className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Anotacoes;
