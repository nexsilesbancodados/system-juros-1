import { useState, useEffect } from "react";
import { FileText, Download, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Relatorios = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!user) return;
    setLoading(true);
    const [year, mon] = month.split("-").map(Number);
    const startDate = new Date(year, mon - 1, 1).toISOString();
    const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString();

    const [profits, expenses, clients, installments] = await Promise.all([
      supabase.from("profits").select("*").eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
      supabase.from("expenses").select("*").eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
      supabase.from("clients").select("*").eq("user_id", user.id),
      supabase.from("installments").select("*").eq("user_id", user.id).gte("due_date", startDate).lte("due_date", endDate),
    ]);

    const profitData = profits.data || [];
    const expenseData = expenses.data || [];
    const clientData = clients.data || [];
    const installmentData = installments.data || [];

    const totalProfit = profitData.reduce((a, p) => a + Number(p.amount), 0);
    const totalExpense = expenseData.reduce((a, e) => a + Number(e.amount), 0);
    const paidInstallments = installmentData.filter((i) => i.status === "paid");
    const overdueInstallments = installmentData.filter((i) => i.status !== "paid" && new Date(i.due_date) < new Date());
    const totalReceived = paidInstallments.reduce((a, i) => a + Number(i.amount), 0);
    const totalOverdue = overdueInstallments.reduce((a, i) => a + Number(i.amount), 0);

    setData({
      profitData, expenseData, clientData, installmentData,
      totalProfit, totalExpense, totalReceived, totalOverdue,
      paidCount: paidInstallments.length,
      overdueCount: overdueInstallments.length,
      pendingCount: installmentData.filter((i) => i.status === "pending" && new Date(i.due_date) >= new Date()).length,
      activeClients: clientData.filter((c) => c.status === "Ativo").length,
      balance: totalProfit - totalExpense,
    });
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, [user, month]);

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  const handleExportCSV = () => {
    if (!data) return;
    let csv = "RELATÓRIO MENSAL - " + monthLabel.toUpperCase() + "\n\n";
    csv += "RESUMO\n";
    csv += `Lucro Total,R$ ${data.totalProfit.toFixed(2)}\n`;
    csv += `Gastos Total,R$ ${data.totalExpense.toFixed(2)}\n`;
    csv += `Saldo,R$ ${data.balance.toFixed(2)}\n`;
    csv += `Recebido (parcelas),R$ ${data.totalReceived.toFixed(2)}\n`;
    csv += `Em atraso,R$ ${data.totalOverdue.toFixed(2)}\n`;
    csv += `Clientes ativos,${data.activeClients}\n\n`;

    csv += "LUCROS\n";
    csv += "Data,Descrição,Valor\n";
    data.profitData.forEach((p: any) => {
      csv += `${new Date(p.date).toLocaleDateString("pt-BR")},"${p.description}",R$ ${Number(p.amount).toFixed(2)}\n`;
    });

    csv += "\nGASTOS\n";
    csv += "Data,Descrição,Categoria,Valor\n";
    data.expenseData.forEach((e: any) => {
      csv += `${new Date(e.date).toLocaleDateString("pt-BR")},"${e.description}","${e.category || "-"}",R$ ${Number(e.amount).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Resumo mensal completo do seu negócio.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-muted-foreground" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button onClick={handleExportCSV} disabled={!data} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando relatório...</div>
      ) : !data ? null : (
        <>
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Resumo de {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Visão consolidada do período.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Lucros", value: `R$ ${data.totalProfit.toFixed(2)}`, color: "text-green-400" },
                { label: "Gastos", value: `R$ ${data.totalExpense.toFixed(2)}`, color: "text-destructive" },
                { label: "Saldo", value: `R$ ${data.balance.toFixed(2)}`, color: data.balance >= 0 ? "text-green-400" : "text-destructive" },
                { label: "Recebido", value: `R$ ${data.totalReceived.toFixed(2)}`, color: "text-foreground" },
                { label: "Em Atraso", value: `R$ ${data.totalOverdue.toFixed(2)}`, color: "text-destructive" },
                { label: "Clientes Ativos", value: String(data.activeClients), color: "text-foreground" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Parcelas summary */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Parcelas do Mês</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{data.paidCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Pagas</p>
              </div>
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{data.overdueCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Atrasadas</p>
              </div>
              <div className="rounded-lg bg-accent border border-border p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{data.pendingCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
              </div>
            </div>
          </div>

          {/* Profit details */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Detalhes de Lucros ({data.profitData.length})</h2>
            {data.profitData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lucro neste período.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.profitData.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-foreground">{p.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-green-400 font-semibold text-sm">R$ {Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense details */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Detalhes de Gastos ({data.expenseData.length})</h2>
            {data.expenseData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum gasto neste período.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.expenseData.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-foreground">{e.description}</p>
                      <p className="text-xs text-muted-foreground">{e.category || "Sem categoria"} · {new Date(e.date).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-destructive font-semibold text-sm">R$ {Number(e.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Relatorios;
