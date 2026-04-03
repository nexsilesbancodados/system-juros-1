import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, ArrowRight,
  DollarSign, Percent, FileSignature, Clock, CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { user, profile } = useAuth();
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

    const todayStr = now.toISOString().split("T")[0];
    const vencendoHoje = installments.filter(
      (i: any) => i.status === "pending" && i.due_date.startsWith(todayStr)
    );

    const in7days = new Date(now.getTime() + 7 * 86400000);
    const proximos7 = installments.filter((i: any) => {
      if (i.status !== "pending") return false;
      const d = new Date(i.due_date);
      return d > now && d <= in7days;
    });

    const recentPayments = paidInstallments
      .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      .slice(0, 8);

    const overdueList = overdueInstallments.map((i: any) => {
      const contract = contracts.find((c: any) => c.id === i.contract_id);
      const daysOverdue = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return { ...i, clientName: contract?.clients?.name || "—", daysOverdue, contractId: i.contract_id };
    }).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    return {
      capitalNaRua, lucroRecebido, lucroAReceber, taxaInadimplencia,
      contratosAtivos: activeContracts.length,
      contratosAtraso: contracts.filter((c: any) => c.status === "overdue").length,
      totalClientes: clients.length,
      overdueCount: overdueInstallments.length,
      vencendoHoje: vencendoHoje.length,
      proximos7: proximos7.length,
      overdueList, recentPayments, goals, contracts,
    };
  }, [data]);

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const greeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, <span className="text-gradient-gold">{profile?.name?.split(" ")[0] || "Usuário"}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Aqui está o resumo do seu negócio</p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Capital na Rua", value: `R$ ${fmt(metrics.capitalNaRua)}`, sub: "Emprestado em contratos ativos", icon: <Landmark size={20} />, accent: "text-primary", bg: "bg-primary/8" },
          { title: "Lucro Recebido", value: `R$ ${fmt(metrics.lucroRecebido)}`, sub: "Contratos quitados", icon: <CheckCircle size={20} />, accent: "text-success", bg: "bg-success/8" },
          { title: "Lucro a Receber", value: `R$ ${fmt(metrics.lucroAReceber)}`, sub: "Contratos ativos", icon: <TrendingUp size={20} />, accent: "text-warning", bg: "bg-warning/8" },
          { title: "Inadimplência", value: `${metrics.taxaInadimplencia.toFixed(1)}%`, sub: `${metrics.overdueCount} parcelas atrasadas`, icon: <Percent size={20} />, accent: metrics.taxaInadimplencia > 20 ? "text-destructive" : "text-foreground", bg: metrics.taxaInadimplencia > 20 ? "bg-destructive/8" : "bg-muted" },
        ].map((card, i) => (
          <div key={card.title} className="rounded-xl border border-border bg-card p-5 card-hover animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{card.title}</span>
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center ${card.accent}`}>
                {card.icon}
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.accent}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Contratos Ativos", value: metrics.contratosAtivos, icon: <FileSignature size={15} />, accent: "text-success", bg: "bg-success/8" },
          { label: "Em Atraso", value: metrics.contratosAtraso, icon: <AlertCircle size={15} />, accent: "text-destructive", bg: "bg-destructive/8" },
          { label: "Clientes", value: metrics.totalClientes, icon: <Users size={15} />, accent: "text-info", bg: "bg-info/8" },
          { label: "Parcelas Atrasadas", value: metrics.overdueCount, icon: <Clock size={15} />, accent: "text-destructive", bg: "bg-destructive/8" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 card-hover">
            <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center ${item.accent}`}>{item.icon}</div>
            <div>
              <p className={`text-xl font-bold ${item.accent}`}>{item.value}</p>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Urgency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { count: metrics.overdueCount, label: "Atrasados", sub: "Parcelas vencidas", icon: <AlertCircle size={18} />, active: metrics.overdueCount > 0, color: "destructive" },
          { count: metrics.vencendoHoje, label: "Vencendo Hoje", sub: "Vencem hoje", icon: <Calendar size={18} />, active: metrics.vencendoHoje > 0, color: "warning" },
          { count: metrics.proximos7, label: "Próximos 7 dias", sub: "Próxima semana", icon: <Clock size={18} />, active: false, color: "info" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-5 transition-all ${c.active ? `border-${c.color}/30 bg-${c.color}/5` : "border-border bg-card"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={c.active ? `text-${c.color}` : "text-muted-foreground"}>{c.icon}</span>
              <span className={`font-bold text-sm ${c.active ? `text-${c.color}` : "text-foreground"}`}>
                {c.count} {c.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Parcelas Atrasadas</h2>
            <button onClick={() => navigate("/mesa-cobranca")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {metrics.overdueList.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle size={32} className="mx-auto text-success/50 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma parcela atrasada 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {metrics.overdueList.slice(0, 6).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/contratos/${item.contractId}`)}>
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">
                    {item.installment_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground">R$ {fmt(Number(item.amount))}</p>
                  </div>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold">
                    {item.daysOverdue}d
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Pagamentos Recentes</h2>
          </div>
          {metrics.recentPayments.length === 0 ? (
            <div className="py-10 text-center">
              <DollarSign size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {metrics.recentPayments.map((item: any) => {
                const contract = metrics.contracts.find((c: any) => c.id === item.contract_id);
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <DollarSign size={14} className="text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{contract?.clients?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        Parcela {item.installment_number} · {item.paid_at ? new Date(item.paid_at).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-success">
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
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Metas</h2>
            <button onClick={() => navigate("/ferramentas/metas")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
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
                    <span className="text-xs font-bold text-primary">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: "var(--gradient-gold)" }}
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
