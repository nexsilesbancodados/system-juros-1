import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import {
  Download, CalendarIcon, BarChart3, Brain, FileText,
  TrendingUp, TrendingDown, Wallet, HandCoins, AlertTriangle, CheckCircle2,
  Users, FileSignature, Clock, Target, PiggyBank, Receipt,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PredictiveAnalytics } from "@/components/analises/PredictiveAnalytics";

type PresetKey = "hoje" | "ontem" | "7d" | "30d" | "mes" | "3m" | "6m" | "12m" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
  { key: "custom", label: "Personalizado" },
];

function getPresetRange(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "hoje": return { from: startOfDay(now), to: endOfDay(now) };
    case "ontem": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "mes": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "3m": return { from: subMonths(now, 3), to: now };
    case "6m": return { from: subMonths(now, 6), to: now };
    case "12m": return { from: subMonths(now, 12), to: now };
    default: return { from: subMonths(now, 6), to: now };
  }
}

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type StatTone = "default" | "success" | "danger" | "warning" | "info";

const toneClasses: Record<StatTone, { value: string; icon: string; bg: string; border: string }> = {
  default: { value: "text-foreground", icon: "text-muted-foreground", bg: "bg-muted/30", border: "" },
  success: { value: "text-success", icon: "text-success", bg: "bg-success/10", border: "border-success/20" },
  danger:  { value: "text-destructive", icon: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  warning: { value: "text-amber-500", icon: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  info:    { value: "text-primary", icon: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
};

type Stat = {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;
  positiveIsGood?: boolean;
  tone?: StatTone;
  icon?: React.ComponentType<any>;
};

function StatCard({ s }: { s: Stat }) {
  const tone = toneClasses[s.tone || "default"];
  const Icon = s.icon;
  const showDelta = typeof s.delta === "number" && isFinite(s.delta);
  const up = showDelta && (s.delta as number) >= 0;
  const good = showDelta && ((s.positiveIsGood ?? true) ? up : !up);
  return (
    <div className={cn("glass-card rounded-2xl p-4 flex flex-col gap-2", tone.border)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
        {Icon ? (
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", tone.bg)}>
            <Icon size={15} className={tone.icon} />
          </div>
        ) : null}
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", tone.value)}>{s.value}</p>
      {showDelta ? (
        <p className={cn("text-[11px] font-semibold flex items-center gap-1", good ? "text-success" : "text-destructive")}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(s.delta as number).toFixed(1)}% vs período anterior
        </p>
      ) : s.hint ? (
        <p className="text-[11px] text-muted-foreground">{s.hint}</p>
      ) : null}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

const Analises = () => {
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState<PresetKey>("30d");
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key);
    if (key !== "custom") {
      const { from, to } = getPresetRange(key);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  useMultiTableRealtime(
    ["contracts", "contract_installments", "clients", "transactions"],
    [["analises-data", user?.id || ""]],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["analises-data", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients] = await Promise.all([
        supabase.from("contracts").select("*").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*, clients(id, name)").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status, created_at").eq("user_id", user!.id),
      ]);
      return {
        contracts: contracts.data || [],
        installments: installments.data || [],
        clients: clients.data || [],
      };
    },
    enabled: !!user,
  });

  const m = useMemo(() => {
    if (!data) return null;
    const { contracts, installments, clients } = data;
    const now = new Date();
    const rangeStart = startOfDay(dateFrom);
    const rangeEnd = endOfDay(dateTo);
    const inRange = (d: Date) => d >= rangeStart && d <= rangeEnd;

    const paidInRange = installments.filter((i: any) => i.status === "paid" && i.paid_at && inRange(new Date(i.paid_at)));
    const contractsInRange = contracts.filter((c: any) => c.created_at && inRange(new Date(c.created_at)));
    const dueInRange = installments.filter((i: any) => inRange(new Date(i.due_date)));

    // ─── Empréstimos no período
    const totalLent = contractsInRange.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
    const newContracts = contractsInRange.length;
    const ticketMedio = newContracts > 0 ? totalLent / newContracts : 0;
    const novosClientes = clients.filter((c: any) => c.created_at && inRange(new Date(c.created_at))).length;

    // ─── Recebimentos no período
    const totalReceived = paidInRange.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const paidCount = paidInRange.length;
    const lucroPeriodo = paidInRange.reduce((s: number, i: any) => {
      const c = contracts.find((c: any) => c.id === i.contract_id);
      if (!c?.num_installments) return s;
      const principal = Number(c.capital) / Number(c.num_installments);
      return s + Math.max(0, Number(i.paid_amount || i.amount) - principal);
    }, 0);
    const multas = paidInRange.reduce((s: number, i: any) => s + Number(i.late_fee || 0), 0);

    // ─── Atraso (saldo atual — não filtrado pelo período)
    const overdueAll = installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now);
    const overdueAmount = overdueAll.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const overdueClients = new Set(overdueAll.map((i: any) => i.client_id)).size;
    const ag = (min: number, max: number) => overdueAll.filter((i: any) => {
      const d = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      return d >= min && d <= max;
    });
    const aging = {
      a: ag(1, 7), b: ag(8, 15), c: ag(16, 30), d: ag(31, 60), e: ag(61, 9999),
    };
    const sumAmt = (arr: any[]) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);

    // ─── Carteira (snapshot atual)
    const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
    const capitalAtivo = activeContracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
    const aReceberTotal = installments
      .filter((i: any) => i.status === "pending")
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const quitados = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      return insts.length > 0 && insts.every((i: any) => i.status === "paid");
    }).length;
    const quitadosNoPeriodo = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      if (insts.length === 0 || insts.some((i: any) => i.status !== "paid")) return false;
      const last = insts.map((i: any) => i.paid_at ? new Date(i.paid_at).getTime() : 0).reduce((a, b) => Math.max(a, b), 0);
      return last >= rangeStart.getTime() && last <= rangeEnd.getTime();
    }).length;

    // ─── Cobrança / inadimplência
    const dueAlready = dueInRange.filter((i: any) => new Date(i.due_date) <= now);
    const pagasNoPrazo = dueAlready.filter((i: any) => i.status === "paid").length;
    const taxaCobranca = dueAlready.length > 0 ? (pagasNoPrazo / dueAlready.length) * 100 : 0;
    const inadRate = installments.length > 0 ? (overdueAll.length / installments.length) * 100 : 0;

    // ─── Previsão próximos 30 dias
    const next30Start = startOfDay(now);
    const next30End = endOfDay(subDays(now, -30));
    const upcoming = installments.filter((i: any) => {
      if (i.status !== "pending") return false;
      const d = new Date(i.due_date);
      return d >= next30Start && d <= next30End;
    });
    const upcoming7 = upcoming.filter((i: any) => new Date(i.due_date) <= endOfDay(subDays(now, -7)));
    const forecastAmount = upcoming.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const forecast7Amount = upcoming7.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    // ─── Vence hoje / amanhã
    const todayStr = format(now, "yyyy-MM-dd");
    const tomorrowStr = format(subDays(now, -1), "yyyy-MM-dd");
    const dueToday = installments.filter((i: any) => i.status === "pending" && i.due_date === todayStr);
    const dueTomorrow = installments.filter((i: any) => i.status === "pending" && i.due_date === tomorrowStr);

    // ─── Comparação com período anterior
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    const prevStart = new Date(rangeStart.getTime() - rangeMs - 1);
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevLent = contracts
      .filter((c: any) => { const d = new Date(c.created_at); return d >= prevStart && d <= prevEnd; })
      .reduce((s: number, c: any) => s + Number(c.capital), 0);
    const prevReceived = installments
      .filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= prevStart && new Date(i.paid_at) <= prevEnd)
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const prevPaidCount = installments.filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= prevStart && new Date(i.paid_at) <= prevEnd).length;
    const prevContracts = contracts.filter((c: any) => { const d = new Date(c.created_at); return d >= prevStart && d <= prevEnd; }).length;
    const delta = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    // ─── Top piores pagadores
    const overdueByClient = new Map<string, { name: string; amount: number; count: number; maxDays: number }>();
    overdueAll.forEach((i: any) => {
      const cid = i.client_id;
      const cname = i.clients?.name || clients.find((c: any) => c.id === cid)?.name || "—";
      const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      const cur = overdueByClient.get(cid) || { name: cname, amount: 0, count: 0, maxDays: 0 };
      cur.amount += Number(i.amount);
      cur.count += 1;
      cur.maxDays = Math.max(cur.maxDays, days);
      overdueByClient.set(cid, cur);
    });
    const worstPayers = Array.from(overdueByClient.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // ─── Frequência dos novos contratos do período
    const freqLabels: Record<string, string> = { daily: "Diários", weekly: "Semanais", biweekly: "Quinzenais", monthly: "Mensais" };
    const freqCount: Record<string, number> = { daily: 0, weekly: 0, biweekly: 0, monthly: 0 };
    contractsInRange.forEach((c: any) => {
      const f = c.frequency || "monthly";
      freqCount[f] = (freqCount[f] || 0) + 1;
    });

    return {
      // empréstimos
      totalLent, newContracts, ticketMedio, novosClientes,
      // recebimentos
      totalReceived, paidCount, lucroPeriodo, multas,
      // atraso
      overdueAmount, overdueCount: overdueAll.length, overdueClients, aging, sumAmt,
      // carteira
      capitalAtivo, aReceberTotal, activeCount: activeContracts.length, totalClients: clients.length,
      quitados, quitadosNoPeriodo,
      // cobrança
      taxaCobranca, inadRate,
      // previsão
      forecastAmount, forecast7Amount, upcomingCount: upcoming.length, upcoming7Count: upcoming7.length,
      dueTodayAmount: dueToday.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      dueTodayCount: dueToday.length,
      dueTomorrowAmount: dueTomorrow.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      dueTomorrowCount: dueTomorrow.length,
      // deltas
      deltaLent: delta(totalLent, prevLent),
      deltaReceived: delta(totalReceived, prevReceived),
      deltaPaidCount: delta(paidCount, prevPaidCount),
      deltaContracts: delta(newContracts, prevContracts),
      // listas
      worstPayers,
      freqLabels, freqCount,
    };
  }, [data, dateFrom, dateTo]);

  const handleExport = () => {
    if (!data) return;
    const rows = data.installments.map((i: any) => {
      const c = data.contracts.find((c: any) => c.id === i.contract_id);
      return `${i.installment_number},${i.amount},${i.due_date},${i.status},${i.paid_at || ""},${c?.capital || ""}`;
    });
    const csv = "Parcela,Valor,Vencimento,Status,Pago em,Capital\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-analises.csv";
    a.click();
  };

  if (isLoading || !m) return <div className="text-center py-12 text-muted-foreground">Carregando análises...</div>;

  const periodLabel = `${format(dateFrom, "dd/MM/yy")} → ${format(dateTo, "dd/MM/yy")}`;

  return (
    <div className="space-y-6">
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon"><BarChart3 size={22} /></div>
            <div>
              <h1 className="text-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Análises</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Totais organizados por tipo · {periodLabel}</p>
            </div>
          </div>
          <button onClick={handleExport} className="btn-ghost">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <Tabs defaultValue="classic" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="classic" className="flex items-center gap-2">
            <FileText size={14} /> Estatísticas
          </TabsTrigger>
          <TabsTrigger value="predictive" className="flex items-center gap-2">
            <Brain size={14} /> Inteligência Preditiva (IA)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictive">
          <PredictiveAnalytics />
        </TabsContent>

        <TabsContent value="classic" className="space-y-8">
          {/* ─── Período ─── */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
              <span className="text-label shrink-0">Período</span>
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePreset(p.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      activePreset === p.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(dateFrom, "dd/MM/yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { if (d) { setDateFrom(d); setActivePreset("custom"); } }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(dateTo, "dd/MM/yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { if (d) { setDateTo(d); setActivePreset("custom"); } }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* ─── EMPRÉSTIMOS ─── */}
          <Section title="Empréstimos no período" subtitle="Quanto saiu do caixa">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard s={{ label: "Total emprestado", value: fmtBRL(m.totalLent), tone: "info", icon: HandCoins, delta: m.deltaLent, positiveIsGood: true }} />
              <StatCard s={{ label: "Novos contratos", value: fmtNum(m.newContracts), tone: "default", icon: FileSignature, delta: m.deltaContracts, positiveIsGood: true }} />
              <StatCard s={{ label: "Ticket médio", value: fmtBRL(m.ticketMedio), tone: "default", icon: Target }} />
              <StatCard s={{ label: "Novos clientes", value: fmtNum(m.novosClientes), tone: "default", icon: Users }} />
            </div>
          </Section>

          {/* ─── RECEBIMENTOS ─── */}
          <Section title="Recebimentos no período" subtitle="Quanto entrou no caixa">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard s={{ label: "Total recebido", value: fmtBRL(m.totalReceived), tone: "success", icon: Wallet, delta: m.deltaReceived, positiveIsGood: true }} />
              <StatCard s={{ label: "Parcelas pagas", value: fmtNum(m.paidCount), tone: "success", icon: CheckCircle2, delta: m.deltaPaidCount, positiveIsGood: true }} />
              <StatCard s={{ label: "Lucro (juros)", value: fmtBRL(m.lucroPeriodo), tone: "success", icon: PiggyBank }} />
              <StatCard s={{ label: "Multas recebidas", value: fmtBRL(m.multas), tone: "default", icon: Receipt }} />
            </div>
          </Section>

          {/* ─── ATRASO (snapshot atual) ─── */}
          <Section title="Inadimplência (saldo atual)" subtitle="Independente do período selecionado">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard s={{ label: "Total em atraso", value: fmtBRL(m.overdueAmount), tone: "danger", icon: AlertTriangle, hint: `${m.overdueCount} parcela(s)` }} />
              <StatCard s={{ label: "Clientes inadimplentes", value: fmtNum(m.overdueClients), tone: "danger", icon: Users }} />
              <StatCard s={{ label: "Taxa de inadimplência", value: fmtPct(m.inadRate), tone: "warning", icon: TrendingDown }} />
              <StatCard s={{ label: "Taxa de cobrança", value: fmtPct(m.taxaCobranca), tone: "info", icon: TrendingUp, hint: "pagas no prazo / vencidas no período" }} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "1-7 dias",   data: m.aging.a },
                { label: "8-15 dias",  data: m.aging.b },
                { label: "16-30 dias", data: m.aging.c },
                { label: "31-60 dias", data: m.aging.d },
                { label: "60+ dias",   data: m.aging.e },
              ].map((b) => (
                <div key={b.label} className="glass-card rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{b.label}</p>
                  <p className="text-lg font-bold text-destructive mt-1 tabular-nums">{fmtBRL(m.sumAmt(b.data))}</p>
                  <p className="text-[11px] text-muted-foreground">{b.data.length} parcela(s)</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ─── CARTEIRA ─── */}
          <Section title="Carteira atual" subtitle="Visão geral do negócio agora">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard s={{ label: "Capital ativo na rua", value: fmtBRL(m.capitalAtivo), tone: "info", icon: Wallet }} />
              <StatCard s={{ label: "A receber (total)", value: fmtBRL(m.aReceberTotal), tone: "default", icon: HandCoins }} />
              <StatCard s={{ label: "Contratos ativos", value: fmtNum(m.activeCount), tone: "default", icon: FileSignature }} />
              <StatCard s={{ label: "Total de clientes", value: fmtNum(m.totalClients), tone: "default", icon: Users }} />
              <StatCard s={{ label: "Contratos quitados (total)", value: fmtNum(m.quitados), tone: "success", icon: CheckCircle2 }} />
              <StatCard s={{ label: "Quitados no período", value: fmtNum(m.quitadosNoPeriodo), tone: "success", icon: CheckCircle2 }} />
              <StatCard s={{ label: "Vence hoje", value: fmtBRL(m.dueTodayAmount), tone: "warning", icon: Clock, hint: `${m.dueTodayCount} parcela(s)` }} />
              <StatCard s={{ label: "Vence amanhã", value: fmtBRL(m.dueTomorrowAmount), tone: "warning", icon: Clock, hint: `${m.dueTomorrowCount} parcela(s)` }} />
            </div>
          </Section>

          {/* ─── PREVISÃO ─── */}
          <Section title="Previsão de recebimento" subtitle="Parcelas pendentes que ainda vão vencer">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard s={{ label: "Próximos 7 dias", value: fmtBRL(m.forecast7Amount), tone: "info", icon: Clock, hint: `${m.upcoming7Count} parcela(s)` }} />
              <StatCard s={{ label: "Próximos 30 dias", value: fmtBRL(m.forecastAmount), tone: "info", icon: Clock, hint: `${m.upcomingCount} parcela(s)` }} />
            </div>
          </Section>

          {/* ─── FREQUÊNCIA DOS CONTRATOS NO PERÍODO ─── */}
          <Section title="Frequência dos novos contratos" subtitle="Apenas dentro do período selecionado">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(m.freqLabels).map(([key, label]) => (
                <StatCard key={key} s={{ label, value: fmtNum(m.freqCount[key] || 0), tone: "default" }} />
              ))}
            </div>
          </Section>

          {/* ─── TOP PIORES PAGADORES ─── */}
          <Section title="Top 10 piores pagadores" subtitle="Ordenado por valor total em atraso">
            {m.worstPayers.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
                Sem inadimplentes 🎉
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-3 divide-y divide-border/50">
                {m.worstPayers.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-2 first:pt-2 last:pb-2">
                    <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.count} parcela{p.count > 1 ? "s" : ""} · {p.maxDays}d em atraso
                      </p>
                    </div>
                    <p className="text-sm font-bold text-destructive shrink-0 tabular-nums">{fmtBRL(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analises;
