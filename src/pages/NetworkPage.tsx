import { useState, useEffect } from "react";
import { Network, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NetworkPage = () => {
  const [collectors, setCollectors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("collectors").select("*").order("created_at", { ascending: false });
      setCollectors(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = collectors.filter((c) =>
    `${c.name} ${c.city}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network</h1>
          <p className="text-muted-foreground text-sm mt-1">Sua rede de cobradores e parceiros.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Contato
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar contato..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Network size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum contato na rede.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-1">{c.name}</h3>
              <p className="text-sm text-muted-foreground">{c.phone}</p>
              <p className="text-sm text-muted-foreground">{c.city} - {c.state}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NetworkPage;
