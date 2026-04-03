import { useState, useEffect } from "react";
import { Plus, Gavel, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Penhoras = () => {
  const [pledges, setPledges] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("pledges").select("*").order("created_at", { ascending: false });
      setPledges(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

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
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Nova Penhora
        </button>
      </div>

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
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">{p.description}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {p.status === "active" ? "Ativo" : p.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Cliente: {p.client_name}</p>
              <p className="text-sm text-muted-foreground">Valor: R$ {Number(p.estimated_value).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Penhoras;
