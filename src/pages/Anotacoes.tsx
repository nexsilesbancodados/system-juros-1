import { useState, useEffect } from "react";
import { StickyNote, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Anotacoes = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
      setNotes(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anotações</h1>
          <p className="text-muted-foreground text-sm mt-1">Suas notas e lembretes.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Anotação
        </button>
      </div>

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
            <div key={n.id} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-2">{n.title}</h3>
              <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Anotacoes;
