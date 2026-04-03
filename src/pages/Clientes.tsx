import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, Trash2, Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
        <input type="text" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
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
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Empréstimo</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const loan = client.loan as any;
                return (
                  <tr key={client.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {loan?.amount ? `R$ ${Number(loan.amount).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${client.status === "Ativo" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewClient(client)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Ver detalhes">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                          <Trash2 size={16} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{selectedClient.name}</h2>
              <button onClick={() => setSelectedClient(null)} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={20} /></button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Telefone</p>
                <p className="text-foreground">{selectedClient.phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">E-mail</p>
                <p className="text-foreground">{selectedClient.email || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPF/CNPJ</p>
                <p className="text-foreground">{selectedClient.cpf_cnpj || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="text-foreground">{selectedClient.status}</p>
              </div>
            </div>

            {/* Loan info */}
            {selectedClient.loan && (
              <div className="rounded-lg bg-accent/30 border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Empréstimo</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">Capital: <span className="text-foreground">R$ {Number((selectedClient.loan as any).amount || 0).toFixed(2)}</span></p>
                  <p className="text-muted-foreground">Juros: <span className="text-foreground">R$ {Number((selectedClient.loan as any).total_interest || 0).toFixed(2)}</span></p>
                  <p className="text-muted-foreground">Total: <span className="text-green-400">R$ {Number((selectedClient.loan as any).total_amount || 0).toFixed(2)}</span></p>
                  <p className="text-muted-foreground">Parcela: <span className="text-foreground">R$ {Number((selectedClient.loan as any).installment_value || 0).toFixed(2)}</span></p>
                  <p className="text-muted-foreground">Frequência: <span className="text-foreground">{(selectedClient.loan as any).frequency}</span></p>
                  <p className="text-muted-foreground">Tipo: <span className="text-foreground">{(selectedClient.loan as any).type}</span></p>
                </div>
              </div>
            )}

            {/* Installments */}
            {installments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Parcelas ({installments.length})</h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {installments.map((inst) => {
                    const isOverdue = inst.status === "pending" && new Date(inst.due_date) < new Date();
                    const isPaid = inst.status === "paid";
                    return (
                      <div key={inst.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${isOverdue ? "bg-destructive/10 border border-destructive/20" : isPaid ? "bg-green-500/10 border border-green-500/20" : "bg-accent/30 border border-border"}`}>
                        <span className="text-muted-foreground">
                          #{inst.installment_number} · R$ {Number(inst.amount).toFixed(2)} · {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isOverdue ? "bg-destructive/20 text-destructive" : isPaid ? "bg-green-500/20 text-green-400" : "text-muted-foreground"}`}>
                          {isPaid ? "Paga" : isOverdue ? "Atrasada" : "Pendente"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => handleDelete(selectedClient.id)} className="px-4 py-2 rounded-lg border border-destructive/50 text-destructive text-sm hover:bg-destructive/10 transition-colors">
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
