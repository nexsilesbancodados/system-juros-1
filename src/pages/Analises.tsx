import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import { Download, CalendarIcon, BarChart3, Brain, FileText } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { PredictiveAnalytics } from "@/components/analises/PredictiveAnalytics";

const COLORS = ["hsl(142,71%,45%)", "hsl(0,84%,60%)", "hsl(45,93%,47%)", "hsl(210,80%,55%)", "hsl(280,60%,55%)"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

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

const Analises = () => {
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState<PresetKey>("6m");
  const [dateFrom, setDateFrom] = useState<Date>(subMonths(new Date(), 6));
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
      const [contracts, installments, clients, transactions] = await Promise.all([
        supabase.from("contracts").select("*").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*, clients(id, name)").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status").eq("user_id", user!.id),
        supabase.from("transactions").select("*").eq("user_id", user!.id),
      ]);
      return {
        contracts: contracts.data || [],
        installments: installments.data || [],
        clients: clients.data || [],
        transactions: transactions.data || [],
      };
    },
    enabled: !!user,
  });

  const charts = useMemo(() => {
    if (!data) return null;
    const { contracts, installments, clients } = data;
    const now = new Date();
    const rangeStart = startOfDay(dateFrom);
    const rangeEnd = endOfDay(dateTo);

    // Filter data by date range
    const filteredInstallments = installments.filter((i: any) => {
      const d = new Date(i.due_date);
      return d >= rangeStart && d <= rangeEnd;
    });

    const filteredContracts = contracts.filter((c: any) => {
      const d = new Date(c.created_at);
      return d >= rangeStart && d <= rangeEnd;
    });

    const filteredPaidInstallments = installments.filter((i: any) => {
      if (i.status !== "paid" || !i.paid_at) return false;
      const d = new Date(i.paid_at);
      return d >= rangeStart && d <= rangeEnd;
    });

    // Build monthly buckets from range
    const months: { month: number; year: number; label: string }[] = [];
    const cursor = new Date(startOfMonth(rangeStart));
    const endMonth = endOfMonth(rangeEnd);
    while (cursor <= endMonth) {
      months.push({
        month: cursor.getMonth(),
        year: cursor.getFullYear(),
        label: format(cursor, "MMM/yy", { locale: ptBR }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // 1. Monthly revenue
    const monthlyRevenue = months.map((m) => {
      const received = filteredPaidInstallments
        .filter((inst: any) => { const pd = new Date(inst.paid_at); return pd.getMonth() === m.month && pd.getFullYear() === m.year; })
        .reduce((s: number, inst: any) => s + Number(inst.paid_amount || inst.amount), 0);

      const lent = filteredContracts
        .filter((c: any) => { const cd = new Date(c.created_at); return cd.getMonth() === m.month && cd.getFullYear() === m.year; })
        .reduce((s: number, c: any) => s + Number(c.capital), 0);

      return { name: m.label, recebido: received, emprestado: lent };
    });

    // 2. Installment status pie (within range)
    const paid = filteredInstallments.filter((i: any) => i.status === "paid").length;
    const overdue = filteredInstallments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now).length;
    const pending = filteredInstallments.filter((i: any) => i.status === "pending" && new Date(i.due_date) >= now).length;
    const installmentPie = [
      { name: "Pagas", value: paid },
      { name: "Atrasadas", value: overdue },
      { name: "Pendentes", value: pending },
    ].filter((d) => d.value > 0);

    // 3. Credit score distribution (all clients)
    const scoreRanges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];
    const scoreDistribution = scoreRanges.map((r) => ({
      range: r.range,
      clientes: clients.filter((c: any) => {
        const s = Number(c.credit_score || 100);
        return s >= r.min && s <= r.max;
      }).length,
    }));

    // 4. Portfolio aging
    const agingBuckets = [
      { label: "1-7d", min: 1, max: 7 },
      { label: "8-15d", min: 8, max: 15 },
      { label: "16-30d", min: 16, max: 30 },
      { label: "31-60d", min: 31, max: 60 },
      { label: "60+d", min: 61, max: 9999 },
    ];
    const overdueInsts = filteredInstallments.filter(
      (i: any) => i.status === "pending" && new Date(i.due_date) < now
    );
    const aging = agingBuckets.map((b) => ({
      faixa: b.label,
      parcelas: overdueInsts.filter((i: any) => {
        const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
        return days >= b.min && days <= b.max;
      }).length,
      valor: overdueInsts.filter((i: any) => {
        const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
        return days >= b.min && days <= b.max;
      }).reduce((s: number, i: any) => s + Number(i.amount), 0),
    }));

    // 5. Monthly default rate
    const defaultRate = months.map((m) => {
      const monthInsts = filteredInstallments.filter((inst: any) => {
        const dd = new Date(inst.due_date);
        return dd.getMonth() === m.month && dd.getFullYear() === m.year;
      });
      const monthOverdue = monthInsts.filter((inst: any) => inst.status === "pending" && new Date(inst.due_date) < now);
      const rate = monthInsts.length > 0 ? (monthOverdue.length / monthInsts.length) * 100 : 0;
      return { name: m.label, taxa: parseFloat(rate.toFixed(1)) };
    });

    // 6. Loan frequency (within range)
    const freqMap: Record<string, number> = {};
    filteredContracts.forEach((c: any) => {
      const f = c.frequency || "monthly";
      const labels: Record<string, string> = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };
      const label = labels[f] || f;
      freqMap[label] = (freqMap[label] || 0) + 1;
    });
    const loanFrequency = Object.entries(freqMap).map(([name, value]) => ({ name, value }));

    // Stats (within range)
    const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
    const totalCapital = activeContracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
    const totalReceived = filteredPaidInstallments.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const totalLent = filteredContracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
    const inadRate = filteredInstallments.length > 0 ? (overdue / filteredInstallments.length) * 100 : 0;

    // Overdue (sempre — saldo atual, não filtrado por range)
    const overdueAllNow = installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now);
    const overdueAllNowAmount = overdueAllNow.reduce((s: number, i: any) => s + Number(i.amount), 0);

    // Lucro estimado (juros) recebidos no período = paid_amount - principal proporcional
    const lucroPeriodo = filteredPaidInstallments.reduce((s: number, i: any) => {
      const c = contracts.find((c: any) => c.id === i.contract_id);
      if (!c || !c.num_installments) return s + 0;
      const principalParcela = Number(c.capital) / Number(c.num_installments);
      const recebido = Number(i.paid_amount || i.amount);
      return s + Math.max(0, recebido - principalParcela);
    }, 0);

    // Contratos quitados no período (todas parcelas pagas e última paga no range)
    const contratosQuitados = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      if (insts.length === 0) return false;
      if (insts.some((i: any) => i.status !== "paid")) return false;
      const lastPaid = insts
        .map((i: any) => i.paid_at ? new Date(i.paid_at).getTime() : 0)
        .reduce((a: number, b: number) => Math.max(a, b), 0);
      return lastPaid >= rangeStart.getTime() && lastPaid <= rangeEnd.getTime();
    }).length;

    // Novos clientes no período
    const novosClientes = clients.filter((c: any) => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d >= rangeStart && d <= rangeEnd;
    }).length;

    // Ticket médio dos contratos do período
    const ticketMedio = filteredContracts.length > 0 ? totalLent / filteredContracts.length : 0;

    // Taxa de cobrança no período: pagas / (pagas + vencidas no range)
    const pagasRange = filteredInstallments.filter((i: any) => i.status === "paid").length;
    const vencidasRange = filteredInstallments.filter((i: any) => new Date(i.due_date) <= now).length;
    const taxaCobranca = vencidasRange > 0 ? (pagasRange / vencidasRange) * 100 : 0;

    // Comparação com período anterior equivalente
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    const prevStart = new Date(rangeStart.getTime() - rangeMs - 1);
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevLent = contracts
      .filter((c: any) => { const d = new Date(c.created_at); return d >= prevStart && d <= prevEnd; })
      .reduce((s: number, c: any) => s + Number(c.capital), 0);
    const prevReceived = installments
      .filter((i: any) => {
        if (i.status !== "paid" || !i.paid_at) return false;
        const d = new Date(i.paid_at);
        return d >= prevStart && d <= prevEnd;
      })
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const delta = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    // 7. Ranking dos piores pagadores (top 10 por valor em atraso)
    const overdueByClient = new Map<string, { name: string; amount: number; count: number; maxDays: number }>();
    installments.forEach((i: any) => {
      if (i.status !== "pending" || new Date(i.due_date) >= now) return;
      const cid = i.client_id;
      const cname = i.clients?.name || clients.find((c: any) => c.id === cid)?.name || "—";
      const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      const cur = overdueByClient.get(cid) || { name: cname, amount: 0, count: 0, maxDays: 0 };
      cur.amount += Number(i.amount);
      cur.count += 1;
      cur.maxDays = Math.max(cur.maxDays, days);
      overdueByClient.set(cid, cur);
    });
    const worstPayers = Array.from(overdueByClient.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // 8. Previsão de recebimento (próximos 30 dias por semana)
    const weeks: { label: string; valor: number; parcelas: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const start = new Date(now);
      start.setDate(now.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const wInsts = installments.filter((i: any) => {
        if (i.status !== "pending") return false;
        const d = new Date(i.due_date);
        return d >= start && d <= end;
      });
      weeks.push({
        label: `Sem ${w + 1}`,
        valor: wInsts.reduce((s: number, i: any) => s + Number(i.amount), 0),
        parcelas: wInsts.length,
      });
    }

    return {
      monthlyRevenue, installmentPie, scoreDistribution, aging, defaultRate, loanFrequency,
      worstPayers, forecast: weeks,
      stats: {
        totalCapital, totalReceived, totalLent, inadRate,
        totalContracts: filteredContracts.length, totalClients: clients.length, overdue,
        overdueAllNowAmount, overdueAllNowCount: overdueAllNow.length,
        lucroPeriodo, contratosQuitados, novosClientes, ticketMedio, taxaCobranca,
        deltaLent: delta(totalLent, prevLent),
        deltaReceived: delta(totalReceived, prevReceived),
      },
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

  if (isLoading || !charts) return <div className="text-center py-12 text-muted-foreground">Carregando análises...</div>;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Análises & BI</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gestão de portfólio e inteligência preditiva</p>
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
            <FileText size={14} /> Relatórios Clássicos
          </TabsTrigger>
          <TabsTrigger value="predictive" className="flex items-center gap-2">
            <Brain size={14} /> Inteligência Preditiva (IA)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictive">
          <PredictiveAnalytics />
        </TabsContent>

        <TabsContent value="classic" className="space-y-6">
          {/* ─── Period Selector ─── */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-label shrink-0">Período</span>
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePreset(p.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                      activePreset === p.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

          {/* Date pickers - always visible */}
          <div className="flex items-center gap-2 ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8 gap-1.5", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "dd/MM/yy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => { if (d) { setDateFrom(d); setActivePreset("custom"); } }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8 gap-1.5", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "dd/MM/yy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => { if (d) { setDateTo(d); setActivePreset("custom"); } }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Stats principais do período (com comparação vs período anterior) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Emprestado no período", value: `R$ ${fmt(charts.stats.totalLent)}`, delta: charts.stats.deltaLent, positiveIsGood: true },
          { label: "Recebido no período", value: `R$ ${fmt(charts.stats.totalReceived)}`, delta: charts.stats.deltaReceived, positiveIsGood: true },
          { label: "Lucro (juros) recebido", value: `R$ ${fmt(charts.stats.lucroPeriodo)}` },
          { label: "Em atraso (atual)", value: `R$ ${fmt(charts.stats.overdueAllNowAmount)}`, hint: `${charts.stats.overdueAllNowCount} parcela(s)`, danger: charts.stats.overdueAllNowAmount > 0 },
        ].map((s: any) => {
          const showDelta = typeof s.delta === "number" && isFinite(s.delta);
          const up = showDelta && s.delta >= 0;
          const good = showDelta && (s.positiveIsGood ? up : !up);
          return (
            <div key={s.label} className={cn("glass-card rounded-2xl p-4", s.danger && "border-destructive/30")}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("text-xl font-bold mt-1", s.danger ? "text-destructive" : "text-foreground")}>{s.value}</p>
              {showDelta ? (
                <p className={cn("text-[11px] mt-1 font-semibold", good ? "text-success" : "text-destructive")}>
                  {up ? "▲" : "▼"} {Math.abs(s.delta).toFixed(1)}% vs período anterior
                </p>
              ) : s.hint ? (
                <p className="text-[11px] text-muted-foreground mt-1">{s.hint}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Stats secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Capital Ativo", value: `R$ ${fmt(charts.stats.totalCapital)}` },
          { label: "Ticket médio", value: `R$ ${fmt(charts.stats.ticketMedio)}` },
          { label: "Taxa de cobrança", value: `${charts.stats.taxaCobranca.toFixed(1)}%` },
          { label: "Novos contratos", value: charts.stats.totalContracts },
          { label: "Contratos quitados", value: charts.stats.contratosQuitados },
          { label: "Novos clientes", value: charts.stats.novosClientes },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-base font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>


      {/* Row 1: Revenue + Default Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recebido vs Emprestado</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${fmt(v)}`} />
              <Legend />
              <Bar dataKey="recebido" name="Recebido" fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
              <Bar dataKey="emprestado" name="Emprestado" fill="hsl(210,80%,55%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Taxa de Inadimplência Mensal</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={charts.defaultRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Area type="monotone" dataKey="taxa" name="Inadimplência" stroke="hsl(0,84%,60%)" fill="hsl(0,84%,60%)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Pie + Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Status das Parcelas</h2>
          {charts.installmentPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={charts.installmentPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {charts.installmentPie.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Distribuição de Score de Crédito</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="clientes" name="Clientes" fill="hsl(280,60%,55%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Aging + Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Aging do Portfólio</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.aging}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="faixa" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => name === "valor" ? `R$ ${fmt(v)}` : v} />
              <Legend />
              <Bar dataKey="parcelas" name="Parcelas" fill="hsl(0,84%,60%)" radius={[4,4,0,0]} />
              <Bar dataKey="valor" name="Valor (R$)" fill="hsl(45,93%,47%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Frequência de Empréstimos</h2>
          {charts.loanFrequency.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={charts.loanFrequency} cx="50%" cy="50%" outerRadius={95} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {charts.loanFrequency.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem contratos</div>
          )}
        </div>
      </div>

      {/* Row 4: Forecast + Worst Payers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Previsão de Recebimento (4 semanas)</h2>
            <span className="text-xs text-success font-bold">
              R$ {fmt(charts.forecast.reduce((s, w) => s + w.valor, 0))}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={charts.forecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => name === "valor" ? `R$ ${fmt(v)}` : `${v} parcelas`}
              />
              <Area type="monotone" dataKey="valor" name="Valor previsto" stroke="hsl(142,71%,45%)" fill="hsl(142,71%,45%)" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Top 10 Piores Pagadores</h2>
            <span className="text-xs text-destructive font-bold">{charts.worstPayers.length}</span>
          </div>
          {charts.worstPayers.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem inadimplentes 🎉</div>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {charts.worstPayers.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-destructive/5 border border-destructive/15">
                  <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.count} parcela{p.count > 1 ? "s" : ""} · {p.maxDays}d em atraso
                    </p>
                  </div>
                  <p className="text-sm font-bold text-destructive shrink-0">R$ {fmt(p.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  </Tabs>
</div>
);
};

export default Analises;
