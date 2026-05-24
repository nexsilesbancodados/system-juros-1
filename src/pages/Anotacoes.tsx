import { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2, Calendar, Search, X, Edit, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ConfirmProvider";

const Anotacoes = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchNotes = async () => {
    const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    setNotes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotes();
    const ch = supabase
      .channel("realtime-notes")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${user.id}` }, () => fetchNotes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const handleAdd = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("notes").insert({ user_id: user.id, title: title.trim() });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✓ Anotação criada!" }); setTitle(""); setShowForm(false); fetchNotes(); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Excluir esta anotação?"))) return;
    await supabase.from("notes").delete().eq("id", id);
    toast({ title: "Anotação excluída" });
    fetchNotes();
  };

  const handleEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    await supabase.from("notes").update({ title: editTitle.trim() }).eq("id", id);
    toast({ title: "✓ Atualizada!" });
    setEditingId(null);
    fetchNotes();
  };

  const filtered = notes.filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()));

  const colors = [
    "bg-primary/5 border-primary/15",
    "bg-success/5 border-success/15",
    "bg-warning/5 border-warning/15",
    "bg-info/5 border-info/15",
  ];

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    const days = Math.floor(hrs / 24);
    return `${days}d atrás`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-hero">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.2)]">
              <StickyNote size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-headline text-2xl md:text-3xl text-foreground">Anotações</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{notes.length} nota{notes.length !== 1 ? "s" : ""} salva{notes.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-premium">
            <Plus size={16} /> Nova Anotação
          </button>
        </div>
      </div>

      {/* Search */}
      {notes.length > 3 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar anotações..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Conteúdo</label>
            <textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lembrar de cobrar fulano amanhã..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced resize-none"
              onKeyDown={(e) => e.key === "Enter" && e.metaKey && handleAdd()} />
            <p className="text-[10px] text-muted-foreground mt-1">Cmd+Enter para salvar</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl skeleton-shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <StickyNote size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-medium">{search ? `Nenhum resultado para "${search}"` : "Nenhuma anotação"}</p>
          <p className="text-sm text-muted-foreground mt-1">{search ? "Tente outro termo" : "Crie uma anotação para não esquecer"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-fade-in">
          {filtered.map((n, i) => (
            <div key={n.id} className={`rounded-2xl border p-5 group relative card-hover ${colors[i % colors.length]}`}>
              {editingId === n.id ? (
                <div className="space-y-2">
                  <textarea value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm resize-none" rows={2} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(n.id)} className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <StickyNote size={16} className="text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground pr-12 whitespace-pre-wrap">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar size={10} /> {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingId(n.id); setEditTitle(n.title); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
                      <Edit size={13} />
                    </button>
                    <button onClick={() => handleDelete(n.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Anotacoes;
