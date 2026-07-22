import { useState, useEffect } from "react";
import { FileText, Download, Calendar, TrendingUp, ArrowDownRight, Wallet, Users, Receipt, CheckCircle, AlertTriangle, Clock, BarChart3, FileDown, Sparkles, Loader2, Lightbulb, ShieldCheck, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAll } from "@/lib/fetchAll";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast as sonnerToast } from "sonner";
import { formatBR } from "@/lib/dateUtils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Relatorios = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("settings").select("company_name, company_cnpj, company_logo_url").eq("user_id", user.id).single()
      .then(({ data }) => setCompanySettings(data));
  }, [user]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  const runAiAnalysis = async () => {
    if (!user || !data) return;
    setAiLoading(true);
    try {
      const [year, mon] = month.split("-").map(Number);
      const start_date = new Date(year, mon - 1, 1).toISOString();
      const end_date = new Date(year, mon, 0, 23, 59, 59).toISOString();

      const { data: res, error } = await supabase.functions.invoke("report-ai", {
        body: { start_date, end_date }
      });
      if (error) throw error;
      setAiAnalysis(res.analysis);
      sonnerToast.success("Análise de IA concluída!");
    } catch (err: any) {
      sonnerToast.error("Erro ao gerar análise de IA: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchReport = async () => {
    if (!user) return;
    setLoading(true);
    const [year, mon] = month.split("-").map(Number);
    const startDate = new Date(year, mon - 1, 1).toISOString();
    const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString();

    const [profitData, expenseData, clientData, installmentData] = await Promise.all([
      fetchAll((f, t) => supabase.from("profits").select("*").eq("user_id", user.id).gte("date", startDate).lte("date", endDate).range(f, t)),
      fetchAll((f, t) => supabase.from("expenses").select("*").eq("user_id", user.id).gte("date", startDate).lte("date", endDate).range(f, t)),
      fetchAll((f, t) => supabase.from("clients").select("*").eq("user_id", user.id).range(f, t)),
      fetchAll((f, t) => supabase.from("contract_installments").select("*").eq("user_id", user.id).gte("due_date", startDate).lte("due_date", endDate).range(f, t)),
    ]);

    const totalProfit = profitData.reduce((a: number, p: any) => a + Number(p.amount), 0);
    const totalExpense = expenseData.reduce((a: number, e: any) => a + Number(e.amount), 0);
    const paidInstallments = installmentData.filter((i: any) => i.status === "paid");
    const overdueInstallments = installmentData.filter((i: any) => i.status !== "paid" && new Date(i.due_date) < new Date());
    const totalReceived = paidInstallments.reduce((a: number, i: any) => a + Number(i.amount), 0);
    const totalOverdue = overdueInstallments.reduce((a: number, i: any) => a + Number(i.amount), 0);

    setData({
      profitData, expenseData, clientData, installmentData,
      totalProfit, totalExpense, totalReceived, totalOverdue,
      paidCount: paidInstallments.length,
      overdueCount: overdueInstallments.length,
      pendingCount: installmentData.filter((i: any) => i.status === "pending" && new Date(i.due_date) >= new Date()).length,
      activeClients: clientData.filter((c: any) => c.status === "Ativo").length,
      balance: totalProfit - totalExpense,
    });
    setLoading(false);
  };

  useEffect(() => { 
    fetchReport(); 
    setAiAnalysis(null);
  }, [user, month]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("realtime-relatorios")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "profits", filter: `user_id=eq.${user.id}` }, () => fetchReport())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${user.id}` }, () => fetchReport())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "installments", filter: `user_id=eq.${user.id}` }, () => fetchReport())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "clients", filter: `user_id=eq.${user.id}` }, () => fetchReport())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, month]);

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  const handleExportCSV = () => {
    if (!data) return;
    let csv = "RELATÓRIO MENSAL - " + monthLabel.toUpperCase() + "\n\n";
    csv += "RESUMO\n";
    csv += `Lucro Total,R$ ${data.totalProfit.toFixed(2)}\n`;
    csv += `Gastos Total,R$ ${data.totalExpense.toFixed(2)}\n`;
    csv += `Saldo,R$ ${data.balance.toFixed(2)}\n`;
    csv += `Recebido (parcelas),R$ ${data.totalReceived.toFixed(2)}\n`;
    csv += `Em atraso,R$ ${data.totalOverdue.toFixed(2)}\n\n`;

    csv += "LUCROS\nData,Descrição,Valor\n";
    data.profitData.forEach((p: any) => {
      csv += `${formatBR(p.date)},"${p.description}",R$ ${Number(p.amount).toFixed(2)}\n`;
    });
    csv += "\nGASTOS\nData,Descrição,Categoria,Valor\n";
    data.expenseData.forEach((e: any) => {
      csv += `${formatBR(e.date)},"${e.description}","${e.category || "-"}",R$ ${Number(e.amount).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "✓ Relatório exportado!" });
  };

  const handleExportPDF = async () => {
    if (!data) return;
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const companyName = companySettings?.company_name || profile?.name || "Sistema Juros";

      // Header com gradient simulado
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 42, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text(companyName, 14, 16);
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text("Relatório Financeiro Mensal", 14, 24);
      doc.setFontSize(8);
      doc.text(`Período: ${monthLabel}  |  Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, 32);
      if (companySettings?.company_cnpj) doc.text(`CNPJ: ${companySettings.company_cnpj}`, 14, 38);

      let y = 52;
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro", 14, y); y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Valor"]],
        body: [
          ["Lucro Total", `R$ ${fmt(data.totalProfit)}`],
          ["Gastos Total", `R$ ${fmt(data.totalExpense)}`],
          ["Saldo Líquido", `R$ ${fmt(data.balance)}`],
          ["Total Recebido (parcelas)", `R$ ${fmt(data.totalReceived)}`],
          ["Total em Atraso", `R$ ${fmt(data.totalOverdue)}`],
          ["Clientes Ativos", String(data.activeClients)],
        ],
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Parcelas
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("Parcelas do Período", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Status", "Quantidade"]],
        body: [
          ["Pagas", String(data.paidCount)],
          ["Atrasadas", String(data.overdueCount)],
          ["Pendentes", String(data.pendingCount)],
        ],
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Lucros detalhados
      if (data.profitData.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text(`Lucros (${data.profitData.length})`, 14, y); y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Data", "Descrição", "Valor"]],
          body: data.profitData.map((p: any) => [
            formatBR(p.date),
            p.description,
            `R$ ${fmt(Number(p.amount))}`,
          ]),
          theme: "grid",
          headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 2: { halign: "right" } },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Gastos detalhados
      if (data.expenseData.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text(`Gastos (${data.expenseData.length})`, 14, y); y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Data", "Descrição", "Categoria", "Valor"]],
          body: data.expenseData.map((e: any) => [
            formatBR(e.date),
            e.description,
            e.category || "—",
            `R$ ${fmt(Number(e.amount))}`,
          ]),
          theme: "grid",
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 3: { halign: "right" } },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer em todas as páginas
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setTextColor(140);
        doc.text(`${companyName} · Página ${p}/${pages}`, pageW / 2, 290, { align: "center" });
      }

      doc.save(`relatorio-${month}.pdf`);
      toast({ title: "✓ PDF gerado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="page-hero animate-fade-in relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="page-hero-content flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center shadow-2xl shadow-primary/20 ring-1 ring-primary/20 transition-transform group-hover:scale-110">
              <BarChart3 size={28} className="text-primary" />
            </div>
            <div>
              <h1 className="text-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Relatórios BI</h1>
              <p className="text-muted-foreground text-sm font-medium opacity-70">Business Intelligence & Análise de Performance</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card/40 border border-border/10 backdrop-blur-md shadow-inner">
              <Calendar size={16} className="text-primary shrink-0" />
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none [color-scheme:dark]" />
            </div>
            <div className="h-10 w-px bg-border/20 hidden sm:block mx-1" />
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} disabled={!data} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-muted/40 border border-border/20 text-xs font-bold hover:bg-muted/60 transition-all active:scale-95 disabled:opacity-50">
                <Download size={15} /> CSV
              </button>
              <button onClick={handleExportPDF} disabled={!data} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50">
                <FileDown size={15} /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-8 w-48 skeleton-shimmer rounded-lg" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-xl skeleton-shimmer" />)}</div>
        </div>
      ) : !data ? null : (
        <>
          {/* Month label */}
          <div className="flex items-center gap-2 animate-fade-in">
            <BarChart3 size={16} className="text-primary" />
            <h2 className="text-headline text-lg text-foreground capitalize">{monthLabel}</h2>
          </div>

          {/* AI Insights Section */}
          <div className="rounded-[2rem] border border-border/10 bg-card/30 backdrop-blur-xl overflow-hidden shadow-2xl animate-fade-in relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary animate-pulse" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Consultoria AI BI</h2>
              </div>
              {!aiAnalysis && !aiLoading && (
                <button 
                  onClick={runAiAnalysis}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
                >
                  <Sparkles size={12} /> Gerar Insights
                </button>
              )}
              {aiAnalysis && (
                <button 
                  onClick={runAiAnalysis}
                  disabled={aiLoading}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                  title="Re-analisar"
                >
                  <Clock size={14} className={aiLoading ? "animate-spin" : ""} />
                </button>
              )}
            </div>

            <div className="p-5">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <Sparkles size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Processando dados do período...</p>
                    <p className="text-[10px] text-muted-foreground">O Agente IA está analisando sua performance financeira</p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-display font-bold text-foreground leading-tight tracking-tighter">{aiAnalysis.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{aiAnalysis.summary_text}</p>
                    </div>
                    <div className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border ${
                      aiAnalysis.business_health === "excelente" || aiAnalysis.business_health === "bom" 
                        ? "bg-success/10 border-success/30 text-success" 
                        : aiAnalysis.business_health === "estavel" 
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}>
                      <Activity size={18} className="mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{aiAnalysis.business_health}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <Lightbulb size={12} className="text-primary" /> Insights de Dados
                      </div>
                      <ul className="space-y-2">
                        {aiAnalysis.insights.map((insight: string, i: number) => (
                          <li key={i} className="flex gap-2 text-xs text-foreground/80 leading-relaxed bg-muted/30 p-2 rounded-lg border border-border/50">
                            <span className="text-primary font-bold">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <ShieldCheck size={12} className="text-success" /> Recomendações
                      </div>
                      <ul className="space-y-2">
                        {aiAnalysis.recommendations.map((rec: string, i: number) => (
                          <li key={i} className="flex gap-2 text-xs text-foreground/80 leading-relaxed bg-success/5 p-2 rounded-lg border border-success/10">
                            <TrendingUp size={11} className="text-success mt-0.5 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Análise de IA disponível</p>
                    <p className="text-xs text-muted-foreground">Clique para gerar insights estratégicos baseados nos seus números de {monthLabel}.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 stagger-fade-in">
            {[
              { label: "Lucros", value: `R$ ${fmt(data.totalProfit)}`, icon: TrendingUp, color: "text-success", bg: "bg-success/8", glow: data.totalProfit > 0 ? "success-glow" : "" },
              { label: "Gastos", value: `R$ ${fmt(data.totalExpense)}`, icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/8", glow: "" },
              { label: "Saldo", value: `R$ ${fmt(data.balance)}`, icon: Wallet, color: data.balance >= 0 ? "text-success" : "text-destructive", bg: data.balance >= 0 ? "bg-success/8" : "bg-destructive/8", glow: data.balance >= 0 ? "success-glow" : "danger-glow" },
              { label: "Recebido", value: `R$ ${fmt(data.totalReceived)}`, icon: CheckCircle, color: "text-success", bg: "bg-success/8", glow: "" },
              { label: "Em Atraso", value: `R$ ${fmt(data.totalOverdue)}`, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/8", glow: data.totalOverdue > 0 ? "danger-glow" : "" },
              { label: "Clientes Ativos", value: String(data.activeClients), icon: Users, color: "text-primary", bg: "bg-primary/8", glow: "" },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border border-border bg-card p-4 card-shine ${s.glow}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon size={16} className={s.color} />
                  </div>
                  <p className="text-label">{s.label}</p>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Installments summary */}
          <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Receipt size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Parcelas do Mês</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Pagas", value: data.paidCount, icon: CheckCircle, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
                { label: "Atrasadas", value: data.overdueCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
                { label: "Pendentes", value: data.pendingCount, icon: Clock, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl ${s.bg} border ${s.border} p-4 text-center`}>
                  <s.icon size={18} className={`${s.color} mx-auto mb-1`} />
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            {data.installmentData.length > 0 && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-success transition-all duration-500" style={{ width: `${(data.paidCount / data.installmentData.length) * 100}%` }} />
                  <div className="h-full bg-destructive/60 transition-all duration-500" style={{ width: `${(data.overdueCount / data.installmentData.length) * 100}%` }} />
                  <div className="h-full bg-warning/40 transition-all duration-500" style={{ width: `${(data.pendingCount / data.installmentData.length) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>{data.paidCount} pagas</span>
                  <span>{data.installmentData.length} total</span>
                </div>
              </div>
            )}
          </div>

          {/* Profit details */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky-header">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center"><TrendingUp size={14} className="text-success" /></div>
                <h2 className="text-sm font-semibold text-foreground">Lucros ({data.profitData.length})</h2>
              </div>
              <span className="text-sm font-bold text-success">+R$ {fmt(data.totalProfit)}</span>
            </div>
            {data.profitData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lucro neste período.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
                {data.profitData.map((p: any) => (
                  <div key={p.id} className="data-row">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                      <TrendingUp size={14} className="text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{p.description}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBR(p.date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-success">+R$ {fmt(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense details */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky-header">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center"><ArrowDownRight size={14} className="text-destructive" /></div>
                <h2 className="text-sm font-semibold text-foreground">Gastos ({data.expenseData.length})</h2>
              </div>
              <span className="text-sm font-bold text-destructive">−R$ {fmt(data.totalExpense)}</span>
            </div>
            {data.expenseData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum gasto neste período.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
                {data.expenseData.map((e: any) => (
                  <div key={e.id} className="data-row">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <ArrowDownRight size={14} className="text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{e.description}</p>
                      <p className="text-[10px] text-muted-foreground">{e.category || "Sem categoria"} · {formatBR(e.date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">−R$ {fmt(Number(e.amount))}</span>
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
