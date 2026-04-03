import { useState, useEffect } from "react";
import { Plus, Gavel, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Penhoras = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pledges, setPledges] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_name: "", description: "", estimated_value: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchPledges = async () => {
    const { data } = await supabase.from("pledges").select("*").order("created_at", { ascending: false });
    setPledges(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPledges(); }, []);

  const handleAdd = async () => {
    if (!user || !form.client_name.trim() || !form.description.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("pledges").insert({
      user_id: user.id,
      client_name: form.client_name.trim(),
      description: form.description.trim(),
      estimated_value: parseFloat(form.estimated_value) || 0,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Penhora registrada!" });
      setForm({ client_name: "", description: "", estimated_value: "", notes: "" });
      setShowForm(false);
      fetchPledges();
    }
  };

  const handleReturn = async (id: string) => {
    await supabase.from("pledges").update({ status: "returned", return_date: new Date().toISOString() }).eq("id", id);
    toast({ title: "Item devolvido!" });
    fetchPledges();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("pledges").delete().eq("id", id);
    toast({ title: "Penhora removida!" });
    fetchPledges();
  };

  const filtered = pledges.filter((p) =>
    `${p.client_name} ${p.description}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Penhoras</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie itens penhorados.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Penhora
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Nome do Cliente</label>
              <input type="text" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nome do cliente" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Descrição do Item</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Celular iPhone 13" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Valor Estimado (R$)</label>
              <input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Observações</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar penhora..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Gavel size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma penhora encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5 relative group">
              <button onClick={() => handleDelete(p.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">{p.description}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {p.status === "active" ? "Ativo" : "Devolvido"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Cliente: {p.client_name}</p>
              <p className="text-sm text-muted-foreground">Valor: R$ {Number(p.estimated_value).toFixed(2)}</p>
              {p.notes && <p className="text-xs text-muted-foreground mt-1">Obs: {p.notes}</p>}
              {p.status === "active" && (
                <button onClick={() => handleReturn(p.id)} className="mt-3 text-xs font-medium text-foreground hover:text-primary transition-colors">
                  Marcar como Devolvido
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Penhoras;
