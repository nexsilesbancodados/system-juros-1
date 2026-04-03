import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, Trash2, Eye, X, Phone, Mail, CreditCard, ChevronRight, AlertTriangle, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const Clientes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  // Improvement #39: Status filter for clients list
  const [statusFilter, setStatusFilter] = useState<"all" | "Ativo" | "Inativo">("all");

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setClients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir este cliente e todas as suas parcelas?")) return;
    await supabase.from("contract_installments").delete().eq("client_id", id);
    await supabase.from("contracts").delete().eq("client_id", id);
    await supabase.from("installments").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente excluído!" });
      fetchClients();
    }
  };

  const filtered = clients.filter((c) => {
    const matchName = c.name.toLowerCase().includes(search.toLowerCase()) || (c.cpf_cnpj || "").includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchName && matchStatus;
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === "Ativo").length,
    inactive: clients.filter(c => c.status === "Inativo").length,
  };

  // Improvement #40: Score color helper
  const scoreColor = (score: number) => {
    if (score >= 700) return "text-success bg-success/10";
    if (score >= 400) return "text-warning bg-warning/10";
    return "text-destructive bg-destructive/10";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie seus clientes e contratos.</p>
        </div>
        <button
          onClick={() => navigate("/clientes/novo")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20 focus-ring"
          style={{ background: "var(--gradient-button)" }}
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {/* Improvement #41: Better stats with click-to-filter */}
      <div className="grid grid-cols-3 gap-3 stagger-fade-in">
        {[
          { label: "Total", value: stats.total, accent: "text-foreground", filter: "all" as const },
          { label: "Ativos", value: stats.active, accent: "text-success", filter: "Ativo" as const },
          { label: "Inativos", value: stats.inactive, accent: "text-muted-foreground", filter: "Inativo" as const },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(s.filter)}
            className={`rounded-2xl border p-4 card-hover card-shine text-left transition-all focus-ring ${
              statusFilter === s.filter ? "border-primary/30 bg-primary/3" : "border-border bg-card"
            }`}
          >
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Improvement #42: Enhanced search with counter */}
      <div className="relative animate-fade-in" style={{ animationDelay: "120ms" }}>
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-20 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced" />
        {search && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{filtered.length} encontrado{filtered.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setSearch("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Users size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-medium">
            {search ? `Nenhum resultado para "${search}"` : "Nenhum cliente encontrado"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Tente buscar por outro termo" : "Cadastre seu primeiro cliente para começar"}
          </p>
          {!search && (
            <button onClick={() => navigate("/clientes/novo")} className="mt-4 text-sm text-primary hover:underline font-medium focus-ring">
              + Cadastrar cliente
            </button>
          )}
        </div>
      ) : (
        /* Improvement #43: Card-based list for mobile, table for desktop */
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border border-border overflow-hidden bg-card animate-fade-in" style={{ animationDelay: "160ms" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/clientes/${client.id}`)}
                    className="border-t border-border hover:bg-accent/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">{client.name}</p>
                          {client.cpf_cnpj && <p className="text-xs text-muted-foreground font-mono">{client.cpf_cnpj}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{client.phone || client.whatsapp || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${scoreColor(client.credit_score || 0)}`}>
                        {client.credit_score || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={client.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                        {client.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${client.id}`); }} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Ver detalhes">
                          <Eye size={15} />
                        </button>
                        <button onClick={(e) => handleDelete(client.id, e)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list — Improvement #44 */}
          <div className="md:hidden space-y-2 stagger-fade-in">
            {filtered.map((client) => (
              <button
                key={client.id}
                onClick={() => navigate(`/clientes/${client.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-accent/30 transition-all text-left active:scale-[0.99]"
              >
                <div className="w-11 h-11 rounded-2xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{client.name}</p>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${client.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                      {client.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{client.cpf_cnpj || client.phone || "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreColor(client.credit_score || 0)}`}>
                    {client.credit_score || 0}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground/40" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Clientes;
