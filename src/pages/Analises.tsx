import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import { Download, CalendarIcon, BarChart3 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["hsl(142,71%,45%)", "hsl(0,84%,60%)", "hsl(45,93%,47%)", "hsl(210,80%,55%)", "hsl(280,60%,55%)"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

type PresetKey = "7d" | "30d" | "3m" | "6m" | "12m" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
  { key: "custom", label: "Personalizado" },
];

function getPresetRange(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
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
        supabase.from("contract_installments").select("*").eq("user_id", user!.id),
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
    const inadRate = filteredInstallments.length > 0 ? (overdue / filteredInstallments.length) * 100 : 0;

    return {
      monthlyRevenue, installmentPie, scoreDistribution, aging, defaultRate, loanFrequency,
      stats: { totalCapital, totalReceived, inadRate, totalContracts: filteredContracts.length, totalClients: clients.length, overdue },
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
              <h1 className="text-2xl font-bold text-shimmer">Análises</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Relatórios e gráficos avançados do seu portfólio</p>
            </div>
          </div>
          <button onClick={handleExport} className="btn-ghost">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Capital Ativo", value: `R$ ${fmt(charts.stats.totalCapital)}` },
          { label: "Total Recebido", value: `R$ ${fmt(charts.stats.totalReceived)}` },
          { label: "Inadimplência", value: `${charts.stats.inadRate.toFixed(1)}%` },
          { label: "Contratos", value: charts.stats.totalContracts },
          { label: "Clientes", value: charts.stats.totalClients },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
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
    </div>
  );
};

export default Analises;
