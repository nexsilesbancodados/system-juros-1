import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["hsl(142,71%,45%)", "hsl(0,84%,60%)", "hsl(45,93%,47%)", "hsl(210,80%,55%)", "hsl(280,60%,55%)"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

const Analises = () => {
  const { user } = useAuth();

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
    const { contracts, installments, clients, transactions } = data;
    const now = new Date();

    // 1. Monthly revenue (last 6 months)
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

      const received = installments
        .filter((inst: any) => inst.status === "paid" && inst.paid_at) 
        .filter((inst: any) => { const pd = new Date(inst.paid_at); return pd.getMonth() === m && pd.getFullYear() === y; })
        .reduce((s: number, inst: any) => s + Number(inst.paid_amount || inst.amount), 0);

      const lent = contracts
        .filter((c: any) => { const cd = new Date(c.created_at); return cd.getMonth() === m && cd.getFullYear() === y; })
        .reduce((s: number, c: any) => s + Number(c.capital), 0);

      monthlyRevenue.push({ name: label, recebido: received, emprestado: lent });
    }

    // 2. Installment status pie
    const paid = installments.filter((i: any) => i.status === "paid").length;
    const overdue = installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now).length;
    const pending = installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) >= now).length;
    const installmentPie = [
      { name: "Pagas", value: paid },
      { name: "Atrasadas", value: overdue },
      { name: "Pendentes", value: pending },
    ].filter((d) => d.value > 0);

    // 3. Credit score distribution
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

    // 4. Portfolio aging (days overdue)
    const agingBuckets = [
      { label: "1-7 dias", min: 1, max: 7 },
      { label: "8-15 dias", min: 8, max: 15 },
      { label: "16-30 dias", min: 16, max: 30 },
      { label: "31-60 dias", min: 31, max: 60 },
      { label: "60+ dias", min: 61, max: 9999 },
    ];
    const overdueInsts = installments.filter(
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
    const defaultRate = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

      const monthInsts = installments.filter((inst: any) => {
        const dd = new Date(inst.due_date);
        return dd.getMonth() === m && dd.getFullYear() === y;
      });
      const monthOverdue = monthInsts.filter((inst: any) => inst.status === "pending" && new Date(inst.due_date) < now);
      const rate = monthInsts.length > 0 ? (monthOverdue.length / monthInsts.length) * 100 : 0;
      defaultRate.push({ name: label, taxa: parseFloat(rate.toFixed(1)) });
    }

    // 6. Loan frequency
    const freqMap: Record<string, number> = {};
    contracts.forEach((c: any) => {
      const f = c.frequency || "monthly";
      const labels: Record<string, string> = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };
      const label = labels[f] || f;
      freqMap[label] = (freqMap[label] || 0) + 1;
    });
    const loanFrequency = Object.entries(freqMap).map(([name, value]) => ({ name, value }));

    // Stats
    const totalCapital = contracts.filter((c: any) => c.status === "active" || c.status === "overdue").reduce((s: number, c: any) => s + Number(c.capital), 0);
    const totalReceived = installments.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const inadRate = installments.length > 0 ? (overdue / installments.length) * 100 : 0;

    return {
      monthlyRevenue, installmentPie, scoreDistribution, aging, defaultRate, loanFrequency,
      stats: { totalCapital, totalReceived, inadRate, totalContracts: contracts.length, totalClients: clients.length, overdue },
    };
  }, [data]);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análises</h1>
          <p className="text-muted-foreground text-sm">Relatórios e gráficos avançados do seu portfólio</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-foreground hover:bg-accent transition-colors">
          <Download size={16} /> Exportar CSV
        </button>
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
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Revenue + Default Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recebido vs Emprestado (6 meses)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `R$ ${fmt(v)}`} />
              <Legend />
              <Bar dataKey="recebido" name="Recebido" fill="hsl(142,71%,45%)" radius={[4,4,0,0]} />
              <Bar dataKey="emprestado" name="Emprestado" fill="hsl(210,80%,55%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Taxa de Inadimplência Mensal</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={charts.defaultRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Area type="monotone" dataKey="taxa" name="Inadimplência" stroke="hsl(0,84%,60%)" fill="hsl(0,84%,60%)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Pie + Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
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

        <div className="rounded-xl border border-border bg-card p-6">
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
        <div className="rounded-xl border border-border bg-card p-6">
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

        <div className="rounded-xl border border-border bg-card p-6">
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
