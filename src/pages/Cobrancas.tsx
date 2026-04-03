import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Cobrancas = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("clients").select("*").eq("user_id", user.id).eq("client_type", "loan");
      setClients(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const clientsWithLoan = clients.filter((c) => c.loan && (c.loan as any).amount > 0);

  const atrasados = clientsWithLoan.filter((c) => {
    const loan = c.loan as any;
    if (!loan?.first_due_date) return false;
    return new Date(loan.first_due_date) < new Date() && (loan.paid_installments || 0) < (loan.installments || 1);
  });

  const emDia = clientsWithLoan.filter((c) => !atrasados.includes(c));
  const totalPendente = clientsWithLoan.reduce((acc, c) => {
    const loan = c.loan as any;
    const remaining = (loan.installments || 1) - (loan.paid_installments || 0);
    return acc + remaining * (Number(loan.installment_value) || 0);
  }, 0);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe pagamentos e parcelas dos clientes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Em Dia</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{emDia.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Atrasados</p>
          <p className="text-2xl font-bold text-destructive mt-1">{atrasados.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Pendente</p>
          <p className="text-2xl font-bold text-foreground mt-1">R$ {totalPendente.toFixed(2)}</p>
        </div>
      </div>

      {clientsWithLoan.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center py-12">
          <Receipt size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma cobrança pendente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientsWithLoan.map((c) => {
            const loan = c.loan as any;
            const isLate = atrasados.includes(c);
            const remaining = (loan.installments || 1) - (loan.paid_installments || 0);
            return (
              <div key={c.id} className={`rounded-lg border p-4 flex items-center justify-between ${isLate ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Parcela: R$ {Number(loan.installment_value || 0).toFixed(2)} · {remaining} restante{remaining !== 1 ? "s" : ""} · {loan.frequency || "Mensal"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${isLate ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400"}`}>
                    {isLate ? "Atrasado" : "Em dia"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cobrancas;
