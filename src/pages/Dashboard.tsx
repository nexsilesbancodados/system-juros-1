import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, Wallet, ArrowRight,
  DollarSign, Percent, FileSignature, Clock, CheckCircle, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-data", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients, goals] = await Promise.all([
        supabase.from("contracts").select("*, clients(name, cpf_cnpj)").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status").eq("user_id", user!.id),
        supabase.from("goals").select("*").eq("user_id", user!.id),
      ]);
      return {
        contracts: contracts.data || [],
        installments: installments.data || [],
        clients: clients.data || [],
        goals: goals.data || [],
      };
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    const { contracts, installments, clients, goals } = data;
    const now = new Date();

    const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
    const capitalNaRua = activeContracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
    const completedContracts = contracts.filter((c: any) => c.status === "completed");
    const lucroRecebido = completedContracts.reduce((s: number, c: any) => s + Number(c.total_interest), 0);
    const lucroAReceber = activeContracts.reduce((s: number, c: any) => s + Number(c.total_interest), 0);

    const totalInstallments = installments.length;
    const overdueInstallments = installments.filter(
      (i: any) => i.status === "pending" && new Date(i.due_date) < now
    );
    const paidInstallments = installments.filter((i: any) => i.status === "paid");
    const taxaInadimplencia = totalInstallments > 0
      ? (overdueInstallments.length / totalInstallments) * 100
      : 0;

    // Today's due
    const todayStr = now.toISOString().split("T")[0];
    const vencendoHoje = installments.filter(
      (i: any) => i.status === "pending" && i.due_date.startsWith(todayStr)
    );

    // Next 7 days
    const in7days = new Date(now.getTime() + 7 * 86400000);
    const proximos7 = installments.filter((i: any) => {
      if (i.status !== "pending") return false;
      const d = new Date(i.due_date);
      return d > now && d <= in7days;
    });

    // Recent payments (last 10)
    const recentPayments = paidInstallments
      .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      .slice(0, 8);

    // Overdue list with client info and days
    const overdueList = overdueInstallments.map((i: any) => {
      const contract = contracts.find((c: any) => c.id === i.contract_id);
      const daysOverdue = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return { ...i, clientName: contract?.clients?.name || "—", daysOverdue, contractId: i.contract_id };
    }).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    return {
      capitalNaRua,
      lucroRecebido,
      lucroAReceber,
      taxaInadimplencia,
      contratosAtivos: activeContracts.length,
      contratosAtraso: contracts.filter((c: any) => c.status === "overdue").length,
      totalClientes: clients.length,
      overdueCount: overdueInstallments.length,
      vencendoHoje: vencendoHoje.length,
      proximos7: proximos7.length,
      overdueList,
      recentPayments,
      goals,
      contracts,
    };
  }, [data]);

  if (isLoading || !metrics) {
    return <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>;
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Capital na Rua", value: `R$ ${fmt(metrics.capitalNaRua)}`, sub: "Total emprestado em contratos ativos", icon: <Landmark size={20} />, color: "text-foreground" },
          { title: "Lucro Recebido", value: `R$ ${fmt(metrics.lucroRecebido)}`, sub: "Contratos já quitados", icon: <CheckCircle size={20} />, color: "text-emerald-500" },
          { title: "Lucro a Receber", value: `R$ ${fmt(metrics.lucroAReceber)}`, sub: "Contratos ativos", icon: <TrendingUp size={20} />, color: "text-amber-500" },
          { title: "Inadimplência", value: `${metrics.taxaInadimplencia.toFixed(1)}%`, sub: `${metrics.overdueCount} parcelas atrasadas`, icon: <Percent size={20} />, color: metrics.taxaInadimplencia > 20 ? "text-red-500" : "text-foreground" },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.title}</span>
              <span className="text-muted-foreground">{card.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Contratos Ativos", value: metrics.contratosAtivos, icon: <FileSignature size={16} />, color: "text-emerald-500" },
          { label: "Em Atraso", value: metrics.contratosAtraso, icon: <AlertCircle size={16} />, color: "text-red-500" },
          { label: "Clientes", value: metrics.totalClientes, icon: <Users size={16} />, color: "text-foreground" },
          { label: "Parcelas Atrasadas", value: metrics.overdueCount, icon: <Clock size={16} />, color: "text-red-500" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-accent ${item.color}`}>{item.icon}</div>
            <div>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Urgency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-5 ${metrics.overdueCount > 0 ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className={metrics.overdueCount > 0 ? "text-red-500" : "text-muted-foreground"} />
            <span className={`font-semibold text-sm ${metrics.overdueCount > 0 ? "text-red-500" : "text-foreground"}`}>
              {metrics.overdueCount} Atrasados
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Parcelas com vencimento ultrapassado</p>
        </div>
        <div className={`rounded-xl border p-5 ${metrics.vencendoHoje > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className={metrics.vencendoHoje > 0 ? "text-amber-500" : "text-muted-foreground"} />
            <span className={`font-semibold text-sm ${metrics.vencendoHoje > 0 ? "text-amber-500" : "text-foreground"}`}>
              {metrics.vencendoHoje} Vencendo Hoje
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Parcelas que vencem hoje</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-muted-foreground" />
            <span className="font-semibold text-sm text-foreground">{metrics.proximos7} Próximos 7 dias</span>
          </div>
          <p className="text-xs text-muted-foreground">Parcelas vencendo na próxima semana</p>
        </div>
      </div>

      {/* Two Columns: Overdue List + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Parcelas Atrasadas</h2>
            <button onClick={() => navigate("/mesa-cobranca")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {metrics.overdueList.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma parcela atrasada 🎉</div>
          ) : (
            <div className="divide-y divide-border">
              {metrics.overdueList.slice(0, 6).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/contratos/${item.contractId}`)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      Parcela {item.installment_number} · R$ {fmt(Number(item.amount))}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                    {item.daysOverdue}d atraso
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Pagamentos Recentes</h2>
          </div>
          {metrics.recentPayments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado</div>
          ) : (
            <div className="divide-y divide-border">
              {metrics.recentPayments.map((item: any) => {
                const contract = metrics.contracts.find((c: any) => c.id === item.contract_id);
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                      <DollarSign size={14} className="text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {contract?.clients?.name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parcela {item.installment_number} · {item.paid_at ? new Date(item.paid_at).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-500">
                      +R$ {fmt(Number(item.paid_amount || item.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Goals */}
      {metrics.goals.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Metas</h2>
            <button onClick={() => navigate("/ferramentas/metas")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Gerenciar <ArrowRight size={12} />
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.goals.slice(0, 4).map((g: any) => {
              const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{g.description}</p>
                    <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    R$ {fmt(Number(g.current_amount))} / R$ {fmt(Number(g.target_amount))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
