import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Calendar, Landmark, TrendingUp, Users, ArrowRight,
  DollarSign, FileSignature, Clock, Sparkles,
  ArrowUpRight, Activity, Wallet, Target, ChevronRight, Zap,
  BarChart3, Receipt, Bot, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import DailyBriefing from "@/components/dashboard/DailyBriefing";
import PeriodComparison from "@/components/dashboard/PeriodComparison";
import NarrativeHero from "@/components/dashboard/NarrativeHero";
import ExecutiveKPIs from "@/components/dashboard/ExecutiveKPIs";
import BentoKPI from "@/components/dashboard/BentoKPI";
import { formatBR } from "@/lib/dateUtils";
import { fetchAll } from "@/lib/fetchAll";

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useMultiTableRealtime(
    ["contracts", "contract_installments", "profits", "clients", "goals"],
    [["dashboard-data", user?.id || ""]],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-data", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients, goals, profits] = await Promise.all([
        fetchAll((f, t) => supabase.from("contracts").select("*, clients(name, cpf_cnpj)").eq("user_id", user!.id).range(f, t)),
        fetchAll((f, t) => supabase.from("contract_installments").select("*").eq("user_id", user!.id).range(f, t)),
        fetchAll((f, t) => supabase.from("clients").select("id, name, credit_score, status").eq("user_id", user!.id).range(f, t)),
        fetchAll((f, t) => supabase.from("goals").select("*").eq("user_id", user!.id).range(f, t)),
        supabase.from("profits").select("amount, date").eq("user_id", user!.id).order("date", { ascending: false }).limit(30),
      ]);
      return {
        contracts, installments, clients, goals,
        profits: (profits as any).data || [],
      };
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    const { contracts, installments, clients, goals, profits } = data;
    const now = new Date();

    // ⚡ FOCO: apenas contratos ativos (exclui "completed"/quitados).
    // O histórico de contratos encerrados vive em /historico-financeiro.
    const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
    const activeIds = new Set(activeContracts.map((c: any) => c.id));
    const activeInstallments = installments.filter((i: any) => activeIds.has(i.contract_id));

    const capitalNaRua = activeContracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
    const lucroAReceber = activeContracts.reduce((s: number, c: any) => s + Number(c.total_interest), 0);
    // Lucro já recebido dentro de contratos AINDA ATIVOS
    const lucroRecebido = 0;

    const totalInstallments = activeInstallments.length;
    const overdueInstallments = activeInstallments.filter(
      (i: any) => i.status === "pending" && new Date(i.due_date) < now
    );
    const paidInstallments = activeInstallments.filter((i: any) => i.status === "paid");
    const taxaInadimplencia = totalInstallments > 0
      ? (overdueInstallments.length / totalInstallments) * 100
      : 0;

    const totalReceived = paidInstallments.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const totalOverdueAmount = overdueInstallments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    const todayStr = now.toISOString().split("T")[0];
    const vencendoHoje = activeInstallments.filter(
      (i: any) => i.status === "pending" && i.due_date.startsWith(todayStr)
    );

    const in7days = new Date(now.getTime() + 7 * 86400000);
    const proximos7 = activeInstallments.filter((i: any) => {
      if (i.status !== "pending") return false;
      const d = new Date(i.due_date);
      return d > now && d <= in7days;
    });

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

    const paidToday = paidInstallments.filter((p: any) => p.paid_at?.startsWith(todayStr));
    const paidTodayAmount = paidToday.reduce((s: number, p: any) => s + Number(p.paid_amount || p.amount), 0);

    // Lucro operacional considera SÓ contratos ativos (juros já recebidos deles)
    const totalCapitalReturned = paidInstallments.reduce((s: number, i: any) => {
      const contract = activeContracts.find((c: any) => c.id === i.contract_id);
      if (!contract) return s;
      const capitalPerInstallment = Number(contract.capital) / Number(contract.num_installments);
      return s + capitalPerInstallment;
    }, 0);
    const interestEarned = Math.max(0, totalReceived - totalCapitalReturned);
    const totalProfitAmount = interestEarned;

    const roi = capitalNaRua > 0 ? ((totalProfitAmount / capitalNaRua) * 100) : 0;

    // Totais mostrados agora refletem só o que está NA RUA
    const totalLent = capitalNaRua;
    const pendingReceivable = activeInstallments
      .filter((i: any) => i.status === "pending" || i.status === "overdue" || (i.status !== "paid" && !i.paid_at))
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    return {
      capitalNaRua, lucroRecebido, lucroAReceber, taxaInadimplencia,
      totalReceived, totalOverdueAmount, roi,
      totalLent, pendingReceivable,
      contratosAtivos: activeContracts.length,
      contratosAtraso: contracts.filter((c: any) => c.status === "overdue").length,
      totalContratos: activeContracts.length,
      totalClientes: clients.length,
      overdueCount: overdueInstallments.length,
      vencendoHoje: vencendoHoje.length,
      proximos7: proximos7.length,
      overdueList, recentPayments, goals, contracts: activeContracts,
      weeklyActivity, maxActivity, paidTodayAmount, totalProfitAmount,
    };
  }, [data]);

  // ⚠️ IMPORTANTE: todos os hooks antes de qualquer early return
  const deltaReceived = useMemo(() => {
    if (!data) return undefined;
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);
    const paid = data.installments.filter((i: any) => i.status === "paid" && i.paid_at);
    const cur = paid.filter((i: any) => new Date(i.paid_at) >= d30).reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const prev = paid.filter((i: any) => { const d = new Date(i.paid_at); return d >= d60 && d < d30; }).reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  }, [data]);

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto animate-pulse">
        <div className="h-32 rounded-3xl bg-white/5" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/5" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 rounded-2xl bg-white/5" />)}
        </div>
        <div className="h-72 rounded-3xl bg-white/5" />
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const timeStr = currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const firstName = profile?.name?.split(" ")[0] || "Usuário";

  const quickActions = [
    { label: "Novo cliente",    icon: Users,    path: "/clientes/novo", tone: "from-primary/25 to-primary/5",       ring: "ring-primary/30",    iconColor: "text-primary" },
    { label: "Nova cobrança",   icon: Receipt,  path: "/cobrancas",     tone: "from-success/25 to-success/5",       ring: "ring-success/30",    iconColor: "text-success" },
    { label: "Ver carteira",    icon: Wallet,   path: "/carteira",      tone: "from-indigo-500/25 to-indigo-500/5", ring: "ring-indigo-500/30", iconColor: "text-indigo-400" },
    { label: "Agente IA",       icon: Bot,      path: "/agente-ia",     tone: "from-violet-500/25 to-violet-500/5", ring: "ring-violet-500/30", iconColor: "text-violet-400" },
  ];

  const urgencyCards = [
    { count: metrics.overdueCount, label: "Parcelas atrasadas", sub: "Necessitam atenção imediata", icon: AlertCircle, tone: "danger",  path: "/cobrancas" },
    { count: metrics.vencendoHoje, label: "Vencendo hoje",      sub: "Cobranças do dia",             icon: Calendar,    tone: "warning", path: "/cobrancas" },
    { count: metrics.proximos7,    label: "Próximos 7 dias",    sub: "Vencimentos da semana",        icon: Clock,       tone: "info",    path: "/cobrancas" },
  ];

  const toneMap: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    danger:  { text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/25", glow: "shadow-[0_0_40px_-15px_hsl(var(--destructive)/0.5)]" },
    warning: { text: "text-warning",     bg: "bg-warning/10",     border: "border-warning/25",     glow: "shadow-[0_0_40px_-15px_hsl(var(--warning)/0.4)]" },
    info:    { text: "text-info",        bg: "bg-info/10",        border: "border-info/25",        glow: "" },
  };

  return (
    <div className="relative space-y-6 md:space-y-7 pb-8 max-w-[1400px] mx-auto animate-fade-in">
      {/* ─── HERO — saudação + ações principais ─── */}
      <section className="relative overflow-hidden rounded-[28px] border border-border/40 bg-gradient-to-br from-card/80 via-card/40 to-card/20 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
        {/* aurora glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-success/10 blur-3xl opacity-50" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="status-dot status-dot-success animate-pulse" />
                Ao vivo
              </span>
              <span className="opacity-30">·</span>
              <span>{timeStr}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-none">
              <span className="opacity-70 font-normal">{greeting},</span>{" "}
              <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">{firstName}</span>
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{dateStr}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {metrics.paidTodayAmount > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-success/10 border border-success/25">
                <Zap size={13} className="text-success" />
                <span className="text-xs font-semibold text-success tabular-nums">
                  +R$ {fmt(metrics.paidTodayAmount)} hoje
                </span>
              </div>
            )}
            <button
              onClick={() => navigate("/tv")}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card/60 border border-border/40 hover:bg-card/90 hover:border-primary/40 transition text-xs font-medium"
            >
              <Activity size={13} className="text-primary" />
              Modo TV
            </button>
            <button
              onClick={() => navigate("/clientes/novo")}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-95 transition text-xs font-bold"
            >
              <Plus size={14} strokeWidth={2.5} />
              Novo
            </button>
          </div>
        </div>

        {/* Quick actions inline */}
        <div className="relative z-10 mt-7 grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
          {quickActions.map((a, i) => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`group relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${a.tone} border border-border/40 hover:border-border/70 ring-1 ring-transparent hover:${a.ring} transition-all duration-300 hover:-translate-y-0.5 text-left`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`w-10 h-10 rounded-xl bg-background/40 backdrop-blur flex items-center justify-center ${a.iconColor} shrink-0 group-hover:scale-110 transition`}>
                <a.icon size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{a.label}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Abrir →</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Daily AI Briefing ─── */}
      <DailyBriefing />

      {/* ─── Narrativa Executiva ─── */}
      <NarrativeHero
        userName={profile?.name}
        capitalOnStreet={metrics.capitalNaRua}
        totalLent={metrics.totalLent}
        pendingReceivable={metrics.pendingReceivable}
        totalReceived={metrics.totalReceived}
        totalProfit={metrics.totalProfitAmount}
        roi={metrics.roi}
        overdueAmount={metrics.totalOverdueAmount}
        overdueCount={metrics.overdueCount}
        paidTodayAmount={metrics.paidTodayAmount}
        vencendoHoje={metrics.vencendoHoje}
        deltaReceived={deltaReceived}
        activeContracts={metrics.contratosAtivos}
        totalContracts={metrics.totalContratos}
      />


      {/* ─── KPIs financeiros ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        <BentoKPI label="Capital na Rua" value={`R$ ${fmt(metrics.capitalNaRua)}`} explanation="Soma do capital de todos os contratos que ainda estão ativos ou em atraso. É o dinheiro que está trabalhando por você." hint={`${metrics.contratosAtivos} contrato${metrics.contratosAtivos === 1 ? "" : "s"} ativo${metrics.contratosAtivos === 1 ? "" : "s"}`} icon={Landmark} tone="primary" onClick={() => navigate("/carteira")} />
        <BentoKPI label="Total Recebido" value={`R$ ${fmt(metrics.totalReceived)}`} explanation="Tudo que já entrou no caixa vindo das parcelas pagas — capital + juros." hint="Somando todas as parcelas quitadas" icon={Wallet} tone="success" delta={deltaReceived} positiveIsGood onClick={() => navigate("/analises")} />
        <BentoKPI label="Lucro Gerado" value={`R$ ${fmt(metrics.totalProfitAmount)}`} explanation="Parte de juros dos pagamentos recebidos — o que sobra depois de devolver o capital emprestado." hint={`ROI de ${metrics.roi.toFixed(1)}% sobre o capital`} icon={TrendingUp} tone="primary" onClick={() => navigate("/analises")} />
        <BentoKPI label="Em Atraso" value={`R$ ${fmt(metrics.totalOverdueAmount)}`} explanation="Parcelas cujo vencimento já passou e continuam pendentes. Priorize a cobrança para não virar prejuízo." hint={`${metrics.taxaInadimplencia.toFixed(1)}% de inadimplência`} icon={AlertCircle} tone={metrics.totalOverdueAmount > 0 ? "danger" : "muted"} onClick={() => navigate("/cobrancas")} />
      </div>

      {/* ─── Urgency Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {urgencyCards.map((c, i) => {
          const active = c.count > 0;
          const t = toneMap[c.tone];
          return (
            <button
              key={c.label}
              onClick={() => navigate(c.path)}
              className={`group text-left rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 ${active ? `${t.border} ${t.bg} ${t.glow}` : "border-border/30 bg-card/30 hover:bg-card/50"}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${active ? t.bg : "bg-muted/40"}`}>
                    <c.icon size={19} className={active ? t.text : "text-muted-foreground"} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-2xl font-bold tabular-nums ${active ? t.text : "text-foreground"}`}>{c.count}</p>
                    <p className="text-xs font-semibold text-foreground/80 truncate">{c.label}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-1 transition-all mt-1" />
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-3">{c.sub}</p>
            </button>
          );
        })}
      </div>

      {/* ─── Tabs: Visão Geral / Análises / Listas ─── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full md:w-auto md:inline-flex grid-cols-3 rounded-2xl p-1 bg-card/40 backdrop-blur border border-border/30">
          <TabsTrigger value="overview" className="rounded-xl text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Visão geral</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Análises</TabsTrigger>
          <TabsTrigger value="lists" className="rounded-xl text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Listas</TabsTrigger>
        </TabsList>

        {/* ─── TAB: Visão geral ─── */}
        <TabsContent value="overview" className="space-y-5 mt-5">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
            {[
              { label: "Contratos ativos",   value: metrics.contratosAtivos, icon: FileSignature, color: "text-success",     bg: "bg-success/10" },
              { label: "Em atraso",          value: metrics.contratosAtraso, icon: AlertCircle,   color: "text-destructive", bg: "bg-destructive/10" },
              { label: "Total clientes",     value: metrics.totalClientes,   icon: Users,         color: "text-primary",     bg: "bg-primary/10" },
              { label: "Parcelas atrasadas", value: metrics.overdueCount,    icon: Clock,         color: "text-warning",     bg: "bg-warning/10" },
            ].map((item, i) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur p-4 flex items-center gap-3 hover:bg-card/60 hover:border-border/50 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${(i + 4) * 60}ms` }}
              >
                <div className={`w-11 h-11 rounded-2xl ${item.bg} flex items-center justify-center shrink-0`}>
                  <item.icon size={18} className={item.color} />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly Activity + Goals side by side em telas grandes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Activity */}
            <div className="rounded-3xl border border-border/30 bg-card/40 backdrop-blur-md p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 size={15} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Atividade semanal</h2>
                    <p className="text-[10px] text-muted-foreground">Pagamentos recebidos nos últimos 7 dias</p>
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-2 h-24">
                {metrics.weeklyActivity.map((w: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[10px] font-bold text-primary tabular-nums opacity-0 group-hover:opacity-100 transition">{w.count}</span>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-700 ${w.count > 0 ? 'bg-gradient-to-t from-primary/70 to-primary/30 group-hover:from-primary group-hover:to-primary/60' : 'bg-muted/30'}`}
                      style={{ height: `${Math.max(6, (w.count / metrics.maxActivity) * 72)}px`, animationDelay: `${i * 80}ms` }}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium capitalize">{w.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Goals */}
            {metrics.goals.length > 0 ? (
              <div className="rounded-3xl border border-border/30 bg-card/40 backdrop-blur-md overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Target size={15} className="text-primary" />
                    </div>
                    <h2 className="text-sm font-bold text-foreground">Metas</h2>
                  </div>
                  <button
                    onClick={() => navigate("/ferramentas/metas")}
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 font-semibold uppercase tracking-wider transition-colors"
                  >
                    Gerenciar <ArrowRight size={10} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {metrics.goals.slice(0, 3).map((g: any) => {
                    const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
                    return (
                      <div key={g.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground truncate mr-2">{g.description}</p>
                          <span className="text-xs font-bold text-primary shrink-0 tabular-nums">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          R$ {fmt(Number(g.current_amount))} / R$ {fmt(Number(g.target_amount))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border/40 bg-card/20 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <Target size={20} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Defina sua primeira meta</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Acompanhe seu progresso mensal</p>
                <button onClick={() => navigate("/ferramentas/metas")} className="text-xs font-semibold text-primary hover:underline">
                  Criar meta →
                </button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── TAB: Análises ─── */}
        <TabsContent value="analytics" className="space-y-5 mt-5">
          <PeriodComparison installments={data?.installments || []} />
          <DashboardCharts
            contracts={metrics.contracts}
            installments={data?.installments || []}
            profits={data?.profits || []}
          />
        </TabsContent>

        {/* ─── TAB: Listas ─── */}
        <TabsContent value="lists" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Overdue List */}
            <div className="rounded-3xl border border-border/30 bg-card/40 backdrop-blur-md overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <AlertCircle size={15} className="text-destructive" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">Parcelas atrasadas</h2>
                  {metrics.overdueCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{metrics.overdueCount}</span>
                  )}
                </div>
                <button
                  onClick={() => navigate("/cobrancas")}
                  className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 font-semibold uppercase tracking-wider transition-colors"
                >
                  Ver todas <ArrowRight size={10} />
                </button>
              </div>
              {metrics.overdueList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-3">
                    <Sparkles size={22} className="text-success" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
                  <p className="text-xs text-muted-foreground mt-1">Nenhuma parcela atrasada</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {metrics.overdueList.slice(0, 5).map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/clientes/${item.clientId || item.client_id}`)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-destructive/5 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center text-xs font-bold shrink-0">
                        {item.installment_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.clientName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">R$ {fmt(Number(item.amount))}</p>
                      </div>
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/25 text-[10px] font-bold rounded-lg px-2">
                        {item.daysOverdue}d
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div className="rounded-3xl border border-border/30 bg-card/40 backdrop-blur-md overflow-hidden animate-fade-in" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-success/10 flex items-center justify-center">
                    <Activity size={15} className="text-success" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">Pagamentos recentes</h2>
                </div>
              </div>
              {metrics.recentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                    <DollarSign size={22} className="text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Sem pagamentos</p>
                  <p className="text-xs text-muted-foreground mt-1">Nenhum pagamento registrado ainda</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {metrics.recentPayments.map((item: any) => {
                    const contract = metrics.contracts.find((c: any) => c.id === item.contract_id);
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-success/5 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                          <ArrowUpRight size={15} className="text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{contract?.clients?.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            Parcela {item.installment_number} · {item.paid_at ? formatBR(item.paid_at) : "—"}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-success whitespace-nowrap tabular-nums">
                          +R$ {fmt(Number(item.paid_amount || item.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
