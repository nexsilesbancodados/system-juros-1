import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, ArrowRight,
  DollarSign, Percent, FileSignature, Clock, CheckCircle, Sparkles,
  ArrowUpRight, Activity, Wallet, Target, ChevronRight, Zap,
  BarChart3, PieChart, Receipt, Bot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import eagleLogo from "@/assets/eagle-logo.webp";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import DailyBriefing from "@/components/dashboard/DailyBriefing";
import PeriodComparison from "@/components/dashboard/PeriodComparison";
import { formatBR } from "@/lib/dateUtils";

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Realtime: re-fetch when any relevant table changes
  useMultiTableRealtime(
    ["contracts", "contract_installments", "profits", "clients", "goals"],
    [["dashboard-data", user?.id || ""]],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-data", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients, goals, profits] = await Promise.all([
        supabase.from("contracts").select("*, clients(name, cpf_cnpj)").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status").eq("user_id", user!.id),
        supabase.from("goals").select("*").eq("user_id", user!.id),
        supabase.from("profits").select("amount, date").eq("user_id", user!.id).order("date", { ascending: false }).limit(30),
      ]);
      return {
        contracts: contracts.data || [],
        installments: installments.data || [],
        clients: clients.data || [],
        goals: goals.data || [],
        profits: profits.data || [],
      };
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    const { contracts, installments, clients, goals, profits } = data;
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

    // Total received from paid installments
    const totalReceived = paidInstallments.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);

    // Overdue amount
    const totalOverdueAmount = overdueInstallments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

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

    // Weekly payment activity (last 7 days)
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now);
      day.setDate(day.getDate() - (6 - i));
      const dayStr = day.toISOString().split("T")[0];
      const count = paidInstallments.filter((p: any) => p.paid_at?.startsWith(dayStr)).length;
      return { day: day.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3), count };
    });
    const maxActivity = Math.max(...weeklyActivity.map(w => w.count), 1);

    const recentPayments = paidInstallments
      .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      .slice(0, 6);

    const overdueList = overdueInstallments.map((i: any) => {
      const contract = contracts.find((c: any) => c.id === i.contract_id);
      const daysOverdue = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return { ...i, clientName: contract?.clients?.name || "—", daysOverdue, contractId: i.contract_id };
    }).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    // Total paid today
    const paidToday = paidInstallments.filter((p: any) => p.paid_at?.startsWith(todayStr));
    const paidTodayAmount = paidToday.reduce((s: number, p: any) => s + Number(p.paid_amount || p.amount), 0);

    // Total profit: from profits table + interest portion of paid installments
    const profitsTableAmount = profits.reduce((s: number, p: any) => s + Number(p.amount), 0);
    // Also compute interest earned from paid installments (totalReceived - capital returned)
    const totalCapitalReturned = paidInstallments.reduce((s: number, i: any) => {
      const contract = contracts.find((c: any) => c.id === i.contract_id);
      if (!contract) return s;
      const capitalPerInstallment = Number(contract.capital) / Number(contract.num_installments);
      return s + capitalPerInstallment;
    }, 0);
    const interestEarned = totalReceived - totalCapitalReturned;
    // Use the higher of: profits table total OR calculated interest (avoid double counting)
    const totalProfitAmount = Math.max(profitsTableAmount, interestEarned > 0 ? interestEarned : 0);

    // ROI
    const totalCapitalEver = contracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
    const roi = totalCapitalEver > 0 ? ((totalProfitAmount / totalCapitalEver) * 100) : 0;

    return {
      capitalNaRua, lucroRecebido, lucroAReceber, taxaInadimplencia,
      totalReceived, totalOverdueAmount, roi,
      contratosAtivos: activeContracts.length,
      contratosAtraso: contracts.filter((c: any) => c.status === "overdue").length,
      totalClientes: clients.length,
      overdueCount: overdueInstallments.length,
      vencendoHoje: vencendoHoje.length,
      proximos7: proximos7.length,
      overdueList, recentPayments, goals, contracts,
      weeklyActivity, maxActivity, paidTodayAmount, totalProfitAmount,
    };
  }, [data]);

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-white/5 rounded-full" />
            <div className="h-12 w-48 bg-white/10 rounded-2xl" />
          </div>
          <div className="hidden md:flex gap-3">
            <div className="h-10 w-28 bg-white/5 rounded-full" />
            <div className="h-10 w-28 bg-white/5 rounded-full" />
          </div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-3xl bg-white/5 border border-white/5" />
          ))}
        </div>

        {/* Main Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-white/5 border border-white/10" />
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 rounded-3xl bg-white/5 border border-white/5" />
          <div className="h-72 rounded-3xl bg-white/5 border border-white/5" />
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
      title: "Total Recebido",
      value: `R$ ${fmt(metrics.totalReceived)}`,
      icon: Wallet,
      accent: "from-success/20 to-success/5",
      iconBg: "bg-success/10",
      iconColor: "text-success",
      valueColor: "text-success",
    },
    {
      title: "Lucro Gerado",
      value: `R$ ${fmt(metrics.totalProfitAmount)}`,
      icon: TrendingUp,
      accent: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
      sub: `ROI: ${metrics.roi.toFixed(1)}%`,
    },
    {
      title: "Em Atraso",
      value: `R$ ${fmt(metrics.totalOverdueAmount)}`,
      icon: AlertCircle,
      accent: metrics.totalOverdueAmount > 0 ? "from-destructive/20 to-destructive/5" : "from-muted/30 to-muted/10",
      iconBg: metrics.totalOverdueAmount > 0 ? "bg-destructive/10" : "bg-muted/30",
      iconColor: metrics.totalOverdueAmount > 0 ? "text-destructive" : "text-muted-foreground",
      valueColor: metrics.totalOverdueAmount > 0 ? "text-destructive" : "text-foreground",
      sub: `${metrics.taxaInadimplencia.toFixed(1)}% inadimplência`,
    },
  ];

  return (
    <div className="relative space-y-6 md:space-y-8 pb-8 max-w-[1600px] mx-auto animate-fade-in">
      {/* ─── Background Eagle (Refined Overlay) ─── */}
      <div className="eagle-bg-overlay overflow-hidden">
        <img src={eagleLogo} alt="" className="w-full h-full object-contain animate-pulse-slow" />
      </div>

      {/* ─── Hero Header ─── */}
      <div className="animate-fade-in relative z-10">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <p className="text-label font-medium opacity-70 tracking-wide uppercase">{greeting}</p>
              <span className="text-label opacity-30">·</span>
              <p className="text-label font-medium opacity-70 tracking-wide uppercase">{timeStr}</p>
            </div>
            <h1 className="text-display text-4xl md:text-7xl font-bold text-foreground tracking-tight leading-none">
              {profile?.name?.split(" ")[0] || "Usuário"}
            </h1>
            <p className="text-[11px] font-bold text-primary/60 tracking-[0.2em] uppercase mt-1.5">{dateStr}</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {metrics.paidTodayAmount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card animate-slide-in-right">
                <Zap size={12} className="text-success" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Hoje: <span className="text-success font-bold">+R$ {fmt(metrics.paidTodayAmount)}</span>
                </span>
              </div>
            )}
            <button
              onClick={() => navigate("/tv")}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass-card hover:bg-primary/10 transition group"
              title="Modo Apresentação"
            >
              <Activity size={12} className="text-primary group-hover:scale-110 transition" />
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Modo TV</span>
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card">
              <span className="status-dot status-dot-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions Grid ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
        {[
          { label: "Novo Cliente", icon: Users, path: "/clientes/novo", color: "bg-primary/10 text-primary", border: "border-primary/20" },
          { label: "Nova Cobrança", icon: Receipt, path: "/cobrancas", color: "bg-success/10 text-success", border: "border-success/20" },
          { label: "Ver Carteira", icon: Wallet, path: "/carteira", color: "bg-indigo-500/10 text-indigo-400", border: "border-indigo-500/20" },
          { label: "Agente IA", icon: Bot, path: "/agente-ia", color: "bg-violet-500/10 text-violet-400", border: "border-violet-500/20" },
        ].map((action, i) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={`flex flex-col items-center justify-center p-5 rounded-[32px] border ${action.border} ${action.color} hover:scale-[1.03] active:scale-95 transition-all duration-300 shadow-xl group relative overflow-hidden`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-3 group-hover:rotate-6 transition-all duration-500 shadow-inner">
              <action.icon size={22} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{action.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Daily AI Briefing ─── */}
      <DailyBriefing />

      {/* ─── Main Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        {mainCards.map((card, i) => (
          <div
            key={card.title}
            className="group relative rounded-[32px] glass-premium overflow-hidden micro-press animate-fade-in hover:bg-white/[0.08] hover:border-white/10 transition-all duration-500"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${card.accent} opacity-40 group-hover:opacity-100 transition-opacity`} />
            <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-gradient-to-br ${card.accent} opacity-[0.03] blur-2xl group-hover:scale-150 transition-transform duration-700`} />
            <div className="relative z-10 p-4 md:p-5 flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-label">{card.title}</span>
                <div className={`w-9 h-9 rounded-2xl ${card.iconBg} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                  <card.icon size={16} className={card.iconColor} />
                </div>
              </div>
              <p className={`text-headline text-xl md:text-2xl lg:text-3xl ${card.valueColor} mt-auto`}>{card.value}</p>
              {(card as any).sub && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{(card as any).sub}</p>
              )}
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
            className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-4 flex items-center gap-3 micro-press animate-fade-in hover:bg-card/40 transition-colors"
            style={{ animationDelay: `${(i + 4) * 60}ms` }}
          >
            <div className={`w-10 h-10 rounded-2xl ${item.bg} flex items-center justify-center shrink-0`}>
              <item.icon size={17} className={item.color} />
            </div>
            <div className="min-w-0">
              <p className={`text-headline text-xl ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Weekly Activity Bar ─── */}
      <div className="rounded-3xl border border-border/20 bg-card/30 backdrop-blur-md p-6 animate-fade-in shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BarChart3 size={14} className="text-primary" />
            </div>
            <h2 className="text-headline text-sm text-foreground">Atividade Semanal</h2>
          </div>
          <span className="text-[10px] text-muted-foreground">Pagamentos recebidos</span>
        </div>
        <div className="flex items-end gap-2.5 h-16">
          {metrics.weeklyActivity.map((w: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-full rounded-lg transition-all duration-700 ${w.count > 0 ? 'bg-gradient-to-t from-primary/40 to-primary/70' : 'bg-muted/30'}`}
                style={{
                  height: `${Math.max(4, (w.count / metrics.maxActivity) * 48)}px`,
                  animationDelay: `${i * 80}ms`
                }}
              />
              <span className="text-[9px] text-muted-foreground font-medium">{w.day}</span>
            </div>
          ))}
        </div>
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
            glow: "danger-glow",
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
            glow: "",
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
            glow: "",
            onClick: () => navigate("/cobrancas"),
          },
        ].map((c, i) => (
          <div
            key={c.label}
            onClick={c.onClick}
            className={`group rounded-2xl border border-border/10 bg-card/30 backdrop-blur-sm p-5 cursor-pointer micro-press animate-fade-in transition-all duration-300 ${c.active ? `border ${c.border} ${c.glow}` : "hover:bg-card/50"}`}
            style={{ animationDelay: `${(i + 8) * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl ${c.active ? c.bg : "bg-muted/40"} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
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

      {/* ─── Period Comparison ─── */}
      <PeriodComparison installments={data?.installments || []} />

      {/* ─── Interactive Charts ─── */}
      <DashboardCharts
        contracts={metrics.contracts}
        installments={data?.installments || []}
        profits={data?.profits || []}
      />

      {/* ─── Two-Column Detail ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue List */}
        <div className="premium-card overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4 sticky-header">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle size={15} className="text-destructive" />
              </div>
              <h2 className="text-headline text-sm text-foreground">Parcelas Atrasadas</h2>
              {metrics.overdueCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">{metrics.overdueCount}</span>
              )}
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
              <div className="empty-state">
                <div className="empty-state-icon">
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
                    className="data-row cursor-pointer micro-bounce"
                    onClick={() => navigate(`/clientes/${item.clientId || item.client_id}`)}
                  >
                    <div className="num-badge bg-destructive/10 text-destructive">
                      {item.installment_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground">R$ {fmt(Number(item.amount))}</p>
                    </div>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold rounded-lg px-2 badge-pulse">
                      {item.daysOverdue}d
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="premium-card overflow-hidden animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between px-5 py-4 sticky-header">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-success/10 flex items-center justify-center">
                <Activity size={15} className="text-success" />
              </div>
              <h2 className="text-headline text-sm text-foreground">Pagamentos Recentes</h2>
            </div>
          </div>
          <div className="border-t border-border/40">
            {metrics.recentPayments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
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
                    <div key={item.id} className="data-row">
                      <div className="w-9 h-9 rounded-2xl bg-success/10 flex items-center justify-center shrink-0 group-hover:bg-success/15 transition-colors">
                        <ArrowUpRight size={15} className="text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{contract?.clients?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Parcela {item.installment_number} · {item.paid_at ? formatBR(item.paid_at) : "—"}
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

      {/* ─── Quick Actions ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: "500ms" }}>
        {[
          { label: "Novo Contrato", icon: FileSignature, color: "text-primary", bg: "bg-primary/8", path: "/clientes/novo" },
          { label: "Novo Cliente", icon: Users, color: "text-success", bg: "bg-success/8", path: "/clientes/novo" },
          { label: "Cobranças", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/8", path: "/cobrancas" },
          { label: "Relatórios", icon: PieChart, color: "text-info", bg: "bg-info/8", path: "/relatorios" },
        ].map((action, i) => (
          <button
            key={action.label + i}
            onClick={() => navigate(action.path)}
            className="premium-card p-4 flex items-center gap-3 text-left group"
          >
            <div className={`w-10 h-10 rounded-2xl ${action.bg} flex items-center justify-center shrink-0`}>
              <action.icon size={18} className={action.color} />
            </div>
            <span className="text-sm font-medium text-foreground">{action.label}</span>
            <ChevronRight size={14} className="text-muted-foreground/30 ml-auto group-hover:text-muted-foreground transition-colors" />
          </button>
        ))}
      </div>

      {/* ─── Goals ─── */}
      {metrics.goals.length > 0 && (
        <div className="premium-card overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Target size={15} className="text-primary" />
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
