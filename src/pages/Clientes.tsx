import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, Trash2, Eye, X, Phone, Mail, CreditCard, Edit } from "lucide-react";
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
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [installments, setInstallments] = useState<any[]>([]);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setClients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente e todas as suas parcelas?")) return;
    await supabase.from("installments").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente excluído!" });
      setSelectedClient(null);
      fetchClients();
    }
  };

  const handleViewClient = async (client: any) => {
    setSelectedClient(client);
    const { data } = await supabase
      .from("installments")
      .select("*")
      .eq("client_id", client.id)
      .order("installment_number", { ascending: true });
    setInstallments(data || []);
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === "Ativo").length,
    loan: clients.filter(c => c.client_type === "loan").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus clientes e contratos.</p>
        </div>
        <button
          onClick={() => navigate("/clientes/novo")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/20"
          style={{ background: "var(--gradient-button)" }}
        >
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: "80ms" }}>
        {[
          { label: "Total", value: stats.total, accent: "text-foreground" },
          { label: "Ativos", value: stats.active, accent: "text-success" },
          { label: "Empréstimos", value: stats.loan, accent: "text-primary" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 card-hover">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative animate-fade-in" style={{ animationDelay: "160ms" }}>
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar cliente por nome..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Nenhum cliente encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre seu primeiro cliente para começar</p>
          <button onClick={() => navigate("/clientes/novo")} className="mt-4 text-sm text-primary hover:underline font-medium">
            + Cadastrar cliente
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card animate-fade-in" style={{ animationDelay: "200ms" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Telefone</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Empréstimo</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const loan = client.loan as any;
                return (
                  <tr key={client.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{client.name}</p>
                          {client.cpf_cnpj && <p className="text-xs text-muted-foreground font-mono">{client.cpf_cnpj}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{client.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-foreground hidden md:table-cell">
                      {loan?.amount ? `R$ ${fmt(Number(loan.amount))}` : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={client.status === "Ativo" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                        {client.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/clientes/${client.id}`)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Ver detalhes">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 glass p-4 animate-fade-in" style={{ animationDuration: "150ms" }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {selectedClient.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedClient.name}</h2>
                  <p className="text-xs text-muted-foreground">{selectedClient.cpf_cnpj || "Sem documento"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-2 rounded-xl hover:bg-accent text-muted-foreground"><X size={20} /></button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <Phone size={14} />, label: "Telefone", value: selectedClient.phone },
                { icon: <Mail size={14} />, label: "E-mail", value: selectedClient.email },
                { icon: <CreditCard size={14} />, label: "CPF/CNPJ", value: selectedClient.cpf_cnpj },
                { icon: <Users size={14} />, label: "Status", value: selectedClient.status },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <span className="text-muted-foreground mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-foreground font-medium">{item.value || "—"}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Loan info */}
            {selectedClient.loan && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Empréstimo</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Capital", value: `R$ ${fmt(Number((selectedClient.loan as any).amount || 0))}` },
                    { label: "Juros", value: `R$ ${fmt(Number((selectedClient.loan as any).total_interest || 0))}` },
                    { label: "Total", value: `R$ ${fmt(Number((selectedClient.loan as any).total_amount || 0))}`, accent: true },
                    { label: "Parcela", value: `R$ ${fmt(Number((selectedClient.loan as any).installment_value || 0))}` },
                    { label: "Frequência", value: (selectedClient.loan as any).frequency },
                    { label: "Tipo", value: (selectedClient.loan as any).type },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                      <p className={`text-sm font-semibold ${item.accent ? "text-primary" : "text-foreground"}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Installments */}
            {installments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Parcelas ({installments.length})</h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {installments.map((inst) => {
                    const isOverdue = inst.status === "pending" && new Date(inst.due_date) < new Date();
                    const isPaid = inst.status === "paid";
                    return (
                      <div key={inst.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-colors ${isOverdue ? "bg-destructive/8 border border-destructive/15" : isPaid ? "bg-success/8 border border-success/15" : "bg-accent/40 border border-border"}`}>
                        <span className="text-muted-foreground">
                          #{inst.installment_number} · R$ {fmt(Number(inst.amount))} · {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${isOverdue ? "bg-destructive/10 text-destructive border-destructive/20" : isPaid ? "bg-success/10 text-success border-success/20" : ""}`}>
                          {isPaid ? "Paga" : isOverdue ? "Atrasada" : "Pendente"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => handleDelete(selectedClient.id)} className="px-4 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
                Excluir Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
