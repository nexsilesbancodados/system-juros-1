import { useState, useEffect } from "react";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, Wallet, ArrowRight, HandCoins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [profits, setProfits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [c, p, e] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id", user.id),
        supabase.from("profits").select("*").eq("user_id", user.id),
        supabase.from("expenses").select("*").eq("user_id", user.id),
      ]);
      setClients(c.data || []);
      setProfits(p.data || []);
      setExpenses(e.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const activeClients = clients.filter((c) => c.status === "Ativo");
  const capitalNaRua = clients.reduce((acc, c) => {
    const loan = c.loan as any;
    if (loan?.amount) return acc + Number(loan.amount);
    return acc;
  }, 0);
  const lucroTotal = profits.reduce((acc, p) => acc + Number(p.amount), 0);
  const gastoTotal = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const saldo = lucroTotal - gastoTotal;

  const atrasados = clients.filter((c) => {
    const loan = c.loan as any;
    if (!loan?.first_due_date) return false;
    return new Date(loan.first_due_date) < new Date() && (loan.paid_installments || 0) < (loan.installments || 1);
  });

  const proximosVencimentos = clients.filter((c) => {
    const loan = c.loan as any;
    if (!loan?.first_due_date) return false;
    const due = new Date(loan.first_due_date);
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 86400000);
    return due >= now && due <= in7days;
  });

  const totalAtrasado = atrasados.reduce((acc, c) => {
    const loan = c.loan as any;
    return acc + (Number(loan?.installment_value) || 0);
  }, 0);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bem-vindo(a) de volta! Aqui está um resumo do seu negócio.
        </p>
      </div>

      {/* Attention */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">O Que Precisa da sua Atenção?</h2>
        <p className="text-sm text-muted-foreground mb-4">Ações e pagamentos que necessitam de ação imediata.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-lg border p-4 ${atrasados.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-accent/30"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={20} className={atrasados.length > 0 ? "text-destructive" : "text-foreground"} />
              <span className={`font-semibold text-sm ${atrasados.length > 0 ? "text-destructive" : "text-foreground"}`}>
                {atrasados.length} Pagamento{atrasados.length !== 1 ? "s" : ""} Atrasado{atrasados.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Total de R$ {totalAtrasado.toFixed(2)} em aberto.</p>
            <button className="flex items-center gap-1 text-sm font-medium text-foreground">Ver Cobranças <ArrowRight size={14} /></button>
          </div>
          <div className="rounded-lg border border-border bg-accent/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={20} className="text-foreground" />
              <span className="font-semibold text-sm text-foreground">{proximosVencimentos.length} Próximo{proximosVencimentos.length !== 1 ? "s" : ""} Vencimento{proximosVencimentos.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Nos próximos 7 dias.</p>
            <button className="flex items-center gap-1 text-sm font-medium text-foreground">Ver Cobranças <ArrowRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Overview */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Visão Geral</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Capital na Rua", value: `R$ ${capitalNaRua.toFixed(2)}`, subtitle: "Total emprestado aos clientes", icon: <Landmark size={20} /> },
            { title: "Lucro Total", value: `R$ ${lucroTotal.toFixed(2)}`, subtitle: "Total de lucros registrados", icon: <TrendingUp size={20} /> },
            { title: "Clientes Ativos", value: String(activeClients.length), subtitle: "Clientes com contratos em aberto", icon: <Users size={20} /> },
            { title: "Saldo em Caixa", value: `R$ ${saldo.toFixed(2)}`, subtitle: "Lucros - Gastos", icon: <Wallet size={20} /> },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <span className="text-muted-foreground">{card.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent clients */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Clientes Recentes</h2>
        {clients.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Users size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum cliente cadastrado ainda.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-accent/50">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Empréstimo</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Parcela</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.slice(0, 5).map((c) => {
                  const loan = c.loan as any;
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">R$ {Number(loan?.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-muted-foreground">R$ {Number(loan?.installment_value || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === "Ativo" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
