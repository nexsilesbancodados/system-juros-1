import { useState, useEffect } from "react";
import { Plus, Smartphone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Celulares = () => {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("stock_items").select("*").order("created_at", { ascending: false });
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

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
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Celular
        </button>
      </div>

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
                    <span className={`px-2 py-0.5 rounded-full text-xs ${item.status === "available" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {item.status === "available" ? "Disponível" : "Vendido"}
                    </span>
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
