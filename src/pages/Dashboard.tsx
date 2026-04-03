import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, ArrowRight,
  DollarSign, Percent, FileSignature, Clock, CheckCircle, Sparkles,
  ArrowUpRight, ArrowDownRight, Activity,
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
      .slice(0, 6);

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
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
          <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
        </div>
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Header — Bold Typography */}
      <div className="animate-fade-in">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-label mb-1">{greeting}</p>
            <h1 className="text-display text-4xl md:text-5xl text-foreground">
              {profile?.name?.split(" ")[0] || "Usuário"}
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full glass-card">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">Sistema operacional</span>
          </div>
        </div>
      </div>

      {/* Bento Grid — Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          {
            title: "Capital na Rua",
            value: `R$ ${fmt(metrics.capitalNaRua)}`,
            icon: Landmark,
            color: "text-foreground",
            iconColor: "text-primary",
            span: "",
          },
          {
            title: "Lucro Recebido",
            value: `R$ ${fmt(metrics.lucroRecebido)}`,
            icon: CheckCircle,
            color: "text-emerald-500",
            iconColor: "text-emerald-500",
            span: "",
          },
          {
            title: "Lucro a Receber",
            value: `R$ ${fmt(metrics.lucroAReceber)}`,
            icon: TrendingUp,
            color: "text-amber-500",
            iconColor: "text-amber-500",
            span: "",
          },
          {
            title: "Inadimplência",
            value: `${metrics.taxaInadimplencia.toFixed(1)}%`,
            icon: Percent,
            color: metrics.taxaInadimplencia > 20 ? "text-destructive" : "text-foreground",
            iconColor: metrics.taxaInadimplencia > 20 ? "text-destructive" : "text-muted-foreground",
            span: "",
          },
        ].map((card, i) => (
          <div
            key={card.title}
            className={`bento-item glass-card p-5 flex flex-col justify-between min-h-[140px] micro-press animate-fade-in ${card.span}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-label">{card.title}</span>
              <card.icon size={18} className={`${card.iconColor} opacity-60`} />
            </div>
            <div>
              <p className={`text-headline text-2xl lg:text-3xl ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bento Row — Activity Counters */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Contratos", value: metrics.contratosAtivos, icon: FileSignature, color: "text-emerald-500" },
          { label: "Em Atraso", value: metrics.contratosAtraso, icon: AlertCircle, color: "text-destructive" },
          { label: "Clientes", value: metrics.totalClientes, icon: Users, color: "text-primary" },
          { label: "Atrasadas", value: metrics.overdueCount, icon: Clock, color: "text-amber-500" },
        ].map((item, i) => (
          <div key={item.label} className="bento-item glass-card p-4 flex items-center gap-3 micro-press animate-fade-in" style={{ animationDelay: `${(i + 4) * 60}ms` }}>
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <item.icon size={18} className={item.color} />
            </div>
            <div className="min-w-0">
              <p className={`text-headline text-xl ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Urgency Bento — Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { count: metrics.overdueCount, label: "Atrasados", sub: "Parcelas vencidas", icon: AlertCircle, active: metrics.overdueCount > 0, activeColor: "text-destructive", activeBg: "bg-destructive/8" },
          { count: metrics.vencendoHoje, label: "Vencendo Hoje", sub: "Vencem hoje", icon: Calendar, active: metrics.vencendoHoje > 0, activeColor: "text-amber-500", activeBg: "bg-amber-500/8" },
          { count: metrics.proximos7, label: "Próximos 7 dias", sub: "Próxima semana", icon: Clock, active: false, activeColor: "text-primary", activeBg: "bg-primary/8" },
        ].map((c, i) => (
          <div key={c.label} className={`bento-item glass-card p-5 micro-press animate-fade-in`} style={{ animationDelay: `${(i + 8) * 60}ms` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${c.active ? c.activeBg : "bg-muted/50"} flex items-center justify-center`}>
                <c.icon size={18} className={c.active ? c.activeColor : "text-muted-foreground"} />
              </div>
              <div>
                <p className={`text-headline text-lg ${c.active ? c.activeColor : "text-foreground"}`}>{c.count}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/70">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-Column Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue List */}
        <div className="bento-item glass-card overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-destructive" />
              <h2 className="text-headline text-sm text-foreground">Parcelas Atrasadas</h2>
            </div>
            <button onClick={() => navigate("/cobrancas")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium micro-bounce uppercase tracking-wider">
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          <div className="border-t border-border/50">
            {metrics.overdueList.length === 0 ? (
              <div className="py-12 text-center">
                <Sparkles size={32} className="mx-auto text-emerald-500/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma parcela atrasada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {metrics.overdueList.slice(0, 5).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 cursor-pointer transition-all duration-200 micro-bounce"
                    onClick={() => navigate(`/contratos/${item.contractId}`)}
                  >
                    <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">
                      {item.installment_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground">R$ {fmt(Number(item.amount))}</p>
                    </div>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold rounded-lg">
                      {item.daysOverdue}d
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bento-item glass-card overflow-hidden animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" />
              <h2 className="text-headline text-sm text-foreground">Pagamentos Recentes</h2>
            </div>
          </div>
          <div className="border-t border-border/50">
            {metrics.recentPayments.length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign size={32} className="mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {metrics.recentPayments.map((item: any) => {
                  const contract = metrics.contracts.find((c: any) => c.id === item.contract_id);
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-all duration-200">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <ArrowUpRight size={16} className="text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{contract?.clients?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Parcela {item.installment_number} · {item.paid_at ? new Date(item.paid_at).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-500">
                        +R$ {fmt(Number(item.paid_amount || item.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Goals Bento */}
      {metrics.goals.length > 0 && (
        <div className="bento-item glass-card overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-headline text-sm text-foreground">Metas</h2>
            </div>
            <button onClick={() => navigate("/ferramentas/metas")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium micro-bounce uppercase tracking-wider">
              Gerenciar <ArrowRight size={10} />
            </button>
          </div>
          <div className="border-t border-border/50 p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {metrics.goals.slice(0, 4).map((g: any) => {
              const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{g.description}</p>
                    <span className="text-xs font-bold text-primary">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, background: "var(--gradient-gold)" }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
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
