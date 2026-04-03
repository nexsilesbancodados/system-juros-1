import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, Trash2, Eye, X, ChevronRight, LayoutGrid, List, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const scoreColor = (s: number) => s >= 700 ? "text-success bg-success/10" : s >= 400 ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";

const Clientes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Ativo" | "Inativo">("all");
  const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
    return (localStorage.getItem("clients-view") as "list" | "cards") || "list";
  });

  const toggleView = (mode: "list" | "cards") => {
    setViewMode(mode);
    localStorage.setItem("clients-view", mode);
  };

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const { filtered, stats } = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = clients.filter((c: any) => {
      const matchName = !q || c.name.toLowerCase().includes(q) || (c.cpf_cnpj || "").includes(search);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchName && matchStatus;
    });
    return {
      filtered,
      stats: {
        total: clients.length,
        active: clients.filter((c: any) => c.status === "Ativo").length,
        inactive: clients.filter((c: any) => c.status === "Inativo").length,
      },
    };
  }, [clients, search, statusFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir este cliente e todos os seus dados?")) return;
    await supabase.from("contract_installments").delete().eq("client_id", id);
    await supabase.from("contracts").delete().eq("client_id", id);
    await supabase.from("installments").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente excluído!" });
    qc.invalidateQueries({ queryKey: ["clients", user?.id] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={22} className="text-primary" /> Clientes
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie seus clientes e contratos.</p>
        </div>
        <button onClick={() => navigate("/clientes/novo")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", filter: "all" as const },
          { label: "Ativos", value: stats.active, color: "text-success", filter: "Ativo" as const },
          { label: "Inativos", value: stats.inactive, color: "text-muted-foreground", filter: "Inativo" as const },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(s.filter)}
            className={`rounded-2xl border p-4 text-left transition-colors ${statusFilter === s.filter ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-20 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          {search && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{filtered.length}</span>
              <button onClick={() => setSearch("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>
            </div>
          )}
        </div>
        <div className="flex items-center bg-card border border-border rounded-2xl p-1 shrink-0">
          <button onClick={() => toggleView("list")}
            className={`p-2.5 rounded-xl transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            title="Lista">
            <List size={16} />
          </button>
          <button onClick={() => toggleView("cards")}
            className={`p-2.5 rounded-xl transition-colors ${viewMode === "cards" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            title="Cards">
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={viewMode === "cards" ? "grid grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-3"}>
          {[1,2,3,4,5,6].map(i => <div key={i} className={`rounded-xl bg-muted/30 animate-pulse ${viewMode === "cards" ? "h-40" : "h-16"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={28} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-foreground font-medium">{search ? `Nenhum resultado para "${search}"` : "Nenhum cliente encontrado"}</p>
          {!search && <button onClick={() => navigate("/clientes/novo")} className="mt-4 text-sm text-primary hover:underline">+ Cadastrar cliente</button>}
        </div>
      ) : viewMode === "list" ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="border-t border-border hover:bg-accent/30 cursor-pointer transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.cpf_cnpj && <p className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.phone || c.whatsapp || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${scoreColor(c.credit_score || 0)}`}>{c.credit_score || 0}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className={c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${c.id}`); }} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Ver">
                          <Eye size={15} />
                        </button>
                        <button onClick={(e) => handleDelete(c.id, e)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-2">
            {filtered.map((c: any) => (
              <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-accent/30 transition-colors text-left">
                <div className="w-11 h-11 rounded-2xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{c.name}</p>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.cpf_cnpj || c.phone || "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreColor(c.credit_score || 0)}`}>{c.credit_score || 0}</span>
                  <ChevronRight size={16} className="text-muted-foreground/40" />
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((c: any) => (
            <div key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
              className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 cursor-pointer transition-all group relative">
              {/* Delete button */}
              <button onClick={(e) => handleDelete(c.id, e)}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                title="Excluir">
                <Trash2 size={13} />
              </button>

              {/* Avatar + Name */}
              <div className="flex flex-col items-center text-center mb-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary mb-2">
                  {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover" /> : c.name?.charAt(0)?.toUpperCase()}
                </div>
                <p className="font-semibold text-foreground text-sm truncate w-full">{c.name}</p>
                {c.cpf_cnpj && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.cpf_cnpj}</p>}
              </div>

              {/* Info */}
              <div className="space-y-1.5 mb-3">
                {(c.phone || c.whatsapp) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone size={11} className="shrink-0" />
                    <span className="truncate">{c.phone || c.whatsapp}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border">
                <Badge variant="outline" className={`text-[9px] ${c.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                  {c.status}
                </Badge>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreColor(c.credit_score || 0)}`}>
                  {c.credit_score || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Clientes;
