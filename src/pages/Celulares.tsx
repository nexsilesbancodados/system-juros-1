import { useState, useEffect } from "react";
import { Plus, Smartphone, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Celulares = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ model: "", imei: "", color: "", storage: "", cost_price: "" });
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase.from("stock_items").select("*").order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAdd = async () => {
    if (!user || !form.model.trim() || !form.imei.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("stock_items").insert({
      user_id: user.id,
      model: form.model.trim(),
      imei: form.imei.trim(),
      color: form.color.trim() || "N/A",
      storage: form.storage.trim() || "N/A",
      cost_price: parseFloat(form.cost_price) || 0,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Celular adicionado!" });
      setForm({ model: "", imei: "", color: "", storage: "", cost_price: "" });
      setShowForm(false);
      fetchItems();
    }
  };

  const handleToggleStatus = async (id: string, current: string) => {
    const newStatus = current === "available" ? "sold" : "available";
    await supabase.from("stock_items").update({ status: newStatus }).eq("id", id);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("stock_items").delete().eq("id", id);
    toast({ title: "Celular removido!" });
    fetchItems();
  };

  const filtered = items.filter((i) =>
    `${i.model} ${i.imei} ${i.color}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Venda de Celulares</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie o estoque de celulares.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Celular
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Modelo</label>
              <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Ex: iPhone 14 Pro" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">IMEI</label>
              <input type="text" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="000000000000000" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Cor</label>
              <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Preto" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Armazenamento</label>
              <input type="text" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} placeholder="128GB" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Preço de Custo (R$)</label>
              <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
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
        <input type="text" placeholder="Buscar por modelo ou IMEI..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Smartphone size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum celular no estoque.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Modelo</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">IMEI</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Cor</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Armazenamento</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Custo</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 text-foreground">{item.model}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.imei}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.color}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.storage}</td>
                  <td className="px-4 py-3 text-muted-foreground">R$ {Number(item.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleStatus(item.id, item.status)} className={`px-2 py-0.5 rounded-full text-xs cursor-pointer ${item.status === "available" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {item.status === "available" ? "Disponível" : "Vendido"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive transition-colors"><X size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Celulares;
