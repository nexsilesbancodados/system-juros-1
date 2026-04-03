import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, ArrowRight,
  DollarSign, Percent, FileSignature, Clock, CheckCircle, Sparkles,
  ArrowUpRight, Activity, Wallet, Target, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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
      <div className="space-y-6 p-1">
        <div className="h-28 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted/20 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 rounded-2xl bg-muted/20 animate-pulse" />
          <div className="h-72 rounded-2xl bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const timeStr = currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const mainCards = [
    {
      title: "Capital na Rua",
      value: `R$ ${fmt(metrics.capitalNaRua)}`,
      icon: Landmark,
      accent: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-foreground",
    },
    {
      title: "Lucro Recebido",
      value: `R$ ${fmt(metrics.lucroRecebido)}`,
      icon: CheckCircle,
      accent: "from-success/20 to-success/5",
      iconBg: "bg-success/10",
      iconColor: "text-success",
      valueColor: "text-success",
    },
    {
      title: "Lucro a Receber",
      value: `R$ ${fmt(metrics.lucroAReceber)}`,
      icon: TrendingUp,
      accent: "from-warning/20 to-warning/5",
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      valueColor: "text-warning",
    },
    {
      title: "Inadimplência",
      value: `${metrics.taxaInadimplencia.toFixed(1)}%`,
      icon: Percent,
      accent: metrics.taxaInadimplencia > 20 ? "from-destructive/20 to-destructive/5" : "from-muted/30 to-muted/10",
      iconBg: metrics.taxaInadimplencia > 20 ? "bg-destructive/10" : "bg-muted/30",
      iconColor: metrics.taxaInadimplencia > 20 ? "text-destructive" : "text-muted-foreground",
      valueColor: metrics.taxaInadimplencia > 20 ? "text-destructive" : "text-foreground",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5 pb-8">
      {/* ─── Hero Header ─── */}
      <div className="animate-fade-in">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <p className="text-label">{greeting}</p>
              <span className="text-label opacity-50">·</span>
              <p className="text-label">{timeStr}</p>
            </div>
            <h1 className="text-display text-3xl md:text-5xl text-foreground">
              {profile?.name?.split(" ")[0] || "Usuário"}
            </h1>
            <p className="text-[11px] text-muted-foreground capitalize mt-0.5">{dateStr}</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        {mainCards.map((card, i) => (
          <div
            key={card.title}
            className="group relative bento-item glass-card overflow-hidden micro-press animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Gradient accent top border */}
            <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${card.accent} opacity-60`} />
            <div className="p-4 md:p-5 flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-label">{card.title}</span>
                <div className={`w-8 h-8 rounded-xl ${card.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                  <card.icon size={15} className={card.iconColor} />
                </div>
              </div>
              <p className={`text-headline text-xl md:text-2xl lg:text-3xl ${card.valueColor} mt-auto`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Quick Stats Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        {[
          { label: "Contratos Ativos", value: metrics.contratosAtivos, icon: FileSignature, color: "text-success", bg: "bg-success/8" },
          { label: "Em Atraso", value: metrics.contratosAtraso, icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/8" },
          { label: "Total Clientes", value: metrics.totalClientes, icon: Users, color: "text-primary", bg: "bg-primary/8" },
          { label: "Parcelas Atrasadas", value: metrics.overdueCount, icon: Clock, color: "text-warning", bg: "bg-warning/8" },
        ].map((item, i) => (
          <div
            key={item.label}
            className="glass-card rounded-2xl p-4 flex items-center gap-3 micro-press animate-fade-in"
            style={{ animationDelay: `${(i + 4) * 60}ms` }}
          >
            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
              <item.icon size={17} className={item.color} />
            </div>
            <div className="min-w-0">
              <p className={`text-headline text-xl ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Urgency Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            count: metrics.overdueCount,
            label: "Parcelas Atrasadas",
            sub: "Necessitam atenção imediata",
            icon: AlertCircle,
            active: metrics.overdueCount > 0,
            color: "text-destructive",
            bg: "bg-destructive/8",
            border: "border-destructive/20",
            onClick: () => navigate("/cobrancas"),
          },
          {
            count: metrics.vencendoHoje,
            label: "Vencendo Hoje",
            sub: "Cobranças do dia",
            icon: Calendar,
            active: metrics.vencendoHoje > 0,
            color: "text-warning",
            bg: "bg-warning/8",
            border: "border-warning/20",
            onClick: () => navigate("/cobrancas"),
          },
          {
            count: metrics.proximos7,
            label: "Próximos 7 Dias",
            sub: "Vencimentos da semana",
            icon: Clock,
            active: false,
            color: "text-info",
            bg: "bg-info/8",
            border: "border-info/20",
            onClick: () => navigate("/cobrancas"),
          },
        ].map((c, i) => (
          <div
            key={c.label}
            onClick={c.onClick}
            className={`group glass-card rounded-2xl p-5 cursor-pointer micro-press animate-fade-in transition-all duration-300 ${c.active ? `border ${c.border}` : ""}`}
            style={{ animationDelay: `${(i + 8) * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${c.active ? c.bg : "bg-muted/40"} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                  <c.icon size={19} className={c.active ? c.color : "text-muted-foreground"} />
                </div>
                <div>
                  <p className={`text-headline text-2xl ${c.active ? c.color : "text-foreground"}`}>{c.count}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{c.label}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-3">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Two-Column Detail ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue List */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle size={14} className="text-destructive" />
              </div>
              <h2 className="text-headline text-sm text-foreground">Parcelas Atrasadas</h2>
            </div>
            <button
              onClick={() => navigate("/cobrancas")}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold micro-bounce uppercase tracking-wider transition-colors"
            >
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          <div className="border-t border-border/40">
            {metrics.overdueList.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-success/8 flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={24} className="text-success/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Nenhuma parcela atrasada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {metrics.overdueList.slice(0, 5).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/30 cursor-pointer transition-all duration-200 micro-bounce"
                    onClick={() => navigate(`/contratos/${item.contractId}`)}
                  >
                    <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                      {item.installment_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground">R$ {fmt(Number(item.amount))}</p>
                    </div>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold rounded-lg px-2">
                      {item.daysOverdue}d
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <Activity size={14} className="text-success" />
              </div>
              <h2 className="text-headline text-sm text-foreground">Pagamentos Recentes</h2>
            </div>
          </div>
          <div className="border-t border-border/40">
            {metrics.recentPayments.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <DollarSign size={24} className="text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sem pagamentos</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Nenhum pagamento registrado ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {metrics.recentPayments.map((item: any) => {
                  const contract = metrics.contracts.find((c: any) => c.id === item.contract_id);
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/30 transition-all duration-200">
                      <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                        <ArrowUpRight size={15} className="text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{contract?.clients?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Parcela {item.installment_number} · {item.paid_at ? new Date(item.paid_at).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-success whitespace-nowrap">
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

      {/* ─── Goals ─── */}
      {metrics.goals.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target size={14} className="text-primary" />
              </div>
              <h2 className="text-headline text-sm text-foreground">Metas</h2>
            </div>
            <button
              onClick={() => navigate("/ferramentas/metas")}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold micro-bounce uppercase tracking-wider transition-colors"
            >
              Gerenciar <ArrowRight size={10} />
            </button>
          </div>
          <div className="border-t border-border/40 p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {metrics.goals.slice(0, 4).map((g: any) => {
              const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
              return (
                <div key={g.id} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate mr-2">{g.description}</p>
                    <span className="text-xs font-bold text-primary shrink-0">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
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
