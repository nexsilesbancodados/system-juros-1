import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const COLORS = ["hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)", "hsl(0, 0%, 55%)", "hsl(48, 96%, 53%)"];

const Analises = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [profits, setProfits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [c, p, e, i] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id", user.id),
        supabase.from("profits").select("*").eq("user_id", user.id),
        supabase.from("expenses").select("*").eq("user_id", user.id),
        supabase.from("installments").select("*").eq("user_id", user.id),
      ]);
      setClients(c.data || []);
      setProfits(p.data || []);
      setExpenses(e.data || []);
      setInstallments(i.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando análises...</div>;

  const totalLucros = profits.reduce((a, p) => a + Number(p.amount), 0);
  const totalGastos = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const capitalNaRua = clients.reduce((a, c) => a + Number((c.loan as any)?.amount || 0), 0);
  const totalJuros = clients.reduce((a, c) => a + Number((c.loan as any)?.total_interest || 0), 0);

  const paidInstallments = installments.filter((i) => i.status === "paid");
  const overdueInstallments = installments.filter((i) => i.status !== "paid" && new Date(i.due_date) < new Date());
  const pendingInstallments = installments.filter((i) => i.status === "pending" && new Date(i.due_date) >= new Date());

  // Pie chart data
  const pieData = [
    { name: "Pagas", value: paidInstallments.length },
    { name: "Atrasadas", value: overdueInstallments.length },
    { name: "Pendentes", value: pendingInstallments.length },
  ].filter((d) => d.value > 0);

  // Monthly revenue chart - last 6 months
  const monthlyData = (() => {
    const months: { name: string; lucros: number; gastos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

      const mLucros = profits
        .filter((p) => { const pd = new Date(p.date); return pd.getMonth() === month && pd.getFullYear() === year; })
        .reduce((a, p) => a + Number(p.amount), 0);

      const mGastos = expenses
        .filter((e) => { const ed = new Date(e.date); return ed.getMonth() === month && ed.getFullYear() === year; })
        .reduce((a, e) => a + Number(e.amount), 0);

      months.push({ name: label, lucros: mLucros, gastos: mGastos });
    }
    return months;
  })();

  // Loan types chart
  const loanTypes = (() => {
    const map: Record<string, number> = {};
    clients.forEach((c) => {
      const type = (c.loan as any)?.type || "Outro";
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  const stats = [
    { title: "Capital na Rua", value: `R$ ${capitalNaRua.toFixed(2)}`, color: "text-foreground" },
    { title: "Juros a Receber", value: `R$ ${totalJuros.toFixed(2)}`, color: "text-green-400" },
    { title: "Lucros Registrados", value: `R$ ${totalLucros.toFixed(2)}`, color: "text-green-400" },
    { title: "Gastos Registrados", value: `R$ ${totalGastos.toFixed(2)}`, color: "text-destructive" },
    { title: "Saldo Líquido", value: `R$ ${(totalLucros - totalGastos).toFixed(2)}`, color: totalLucros - totalGastos >= 0 ? "text-green-400" : "text-destructive" },
    { title: "Taxa de Inadimplência", value: installments.length > 0 ? `${((overdueInstallments.length / installments.length) * 100).toFixed(1)}%` : "0%", color: overdueInstallments.length > 0 ? "text-destructive" : "text-green-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Análises</h1>
        <p className="text-muted-foreground text-sm mt-1">Métricas detalhadas do seu negócio.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.title}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Lucros vs Gastos (últimos 6 meses)</h2>
          {monthlyData.some((m) => m.lucros > 0 || m.gastos > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="name" stroke="hsl(0 0% 55%)" fontSize={12} />
                <YAxis stroke="hsl(0 0% 55%)" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "8px", color: "hsl(0 0% 92%)" }}
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="lucros" name="Lucros" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados suficientes.</div>
          )}
        </div>

        {/* Installment Status Pie */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Status das Parcelas</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "8px", color: "hsl(0 0% 92%)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem parcelas geradas.</div>
          )}
        </div>
      </div>

      {/* Loan types */}
      {loanTypes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Clientes por Tipo de Empréstimo</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={loanTypes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis type="number" stroke="hsl(0 0% 55%)" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="hsl(0 0% 55%)" fontSize={12} width={100} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "8px", color: "hsl(0 0% 92%)" }} />
              <Bar dataKey="value" name="Clientes" fill="hsl(0 0% 65%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default Analises;
