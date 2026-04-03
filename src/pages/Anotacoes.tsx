import { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2 } from "lucide-react";
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
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Anotação criada!" });
      setTitle("");
      setShowForm(false);
      fetchNotes();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    fetchNotes();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anotações</h1>
          <p className="text-muted-foreground text-sm mt-1">Suas notas e lembretes.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Anotação
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Título</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lembrar de cobrar fulano" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma anotação encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-card p-5 group relative">
              <h3 className="font-semibold text-foreground mb-2 pr-6">{n.title}</h3>
              <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
              <button onClick={() => handleDelete(n.id)} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
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
