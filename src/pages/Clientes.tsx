import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Clientes = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      setClients(data || []);
      setLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus clientes e contratos.</p>
        </div>
        <button
          onClick={() => navigate("/clientes/novo")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-button)" }}
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefone</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-t border-border hover:bg-accent/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-foreground">{client.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${client.status === "Ativo" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{client.client_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Clientes;
