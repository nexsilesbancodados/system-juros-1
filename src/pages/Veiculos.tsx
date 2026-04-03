import { useState, useEffect } from "react";
import { Plus, Car, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Veiculos = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      setVehicles(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = vehicles.filter((v) =>
    `${v.brand} ${v.model} ${v.plate}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie a frota de veículos para aluguel.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Veículo
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar veículo..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Car size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum veículo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">{v.brand} {v.model}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${v.status === "available" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {v.status === "available" ? "Disponível" : v.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Placa: {v.plate}</p>
              <p className="text-sm text-muted-foreground">Ano: {v.year} · Tipo: {v.type}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Veiculos;
