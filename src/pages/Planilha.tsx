import { useState, useEffect } from "react";
import { Table, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Planilha = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [c, i] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id", user.id).order("name"),
        supabase.from("installments").select("*").eq("user_id", user.id),
      ]);
      setClients(c.data || []);
      setInstallments(i.data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const getClientInstallments = (clientId: string) => {
    return installments.filter((i) => i.client_id === clientId);
  };

  const filtered = clients.filter((c) =>
    `${c.name} ${c.cpf_cnpj || ""} ${c.phone || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const header = "Nome,CPF/CNPJ,Telefone,Status,Empréstimo,Parcela,Parcelas Pagas,Parcelas Totais\n";
    const rows = filtered.map((c) => {
      const loan = c.loan as any;
      const inst = getClientInstallments(c.id);
      const paid = inst.filter((i) => i.status === "paid").length;
      return `"${c.name}","${c.cpf_cnpj || ""}","${c.phone || ""}","${c.status}","${Number(loan?.amount || 0).toFixed(2)}","${Number(loan?.installment_value || 0).toFixed(2)}","${paid}","${inst.length}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planilha</h1>
          <p className="text-muted-foreground text-sm mt-1">Visualize todos os dados dos clientes.</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Table size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-accent/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefone</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Empréstimo</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Parcela</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const loan = c.loan as any;
                const inst = getClientInstallments(c.id);
                const paid = inst.filter((i) => i.status === "paid").length;
                const total = inst.length;
                const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cpf_cnpj || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === "Ativo" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">R$ {Number(loan?.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground">R$ {Number(loan?.installment_value || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted">
                          <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{paid}/{total}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Planilha;
