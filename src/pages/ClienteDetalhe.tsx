import { useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText, DollarSign,
  CheckCircle, AlertTriangle, Clock, Edit, Trash2, Plus, Send, Copy,
  MessageSquare, Star, Ban, RotateCcw, Download, TrendingUp,
  Calendar, Receipt, Activity, Search, X, Percent, Wallet, Printer, Camera
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const FREQ: Record<string, string> = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };
const INPUT = "w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const ClienteDetalhe = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"resumo" | "contratos" | "parcelas" | "historico">("resumo");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [editAddressMode, setEditAddressMode] = useState(false);
  const [addrData, setAddrData] = useState<any>({});
  const [newLoanMode, setNewLoanMode] = useState(false);
  const [partialPayModal, setPartialPayModal] = useState<any>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [loanCapital, setLoanCapital] = useState("");
  const [loanInstallments, setLoanInstallments] = useState("");
  const [loanFreq, setLoanFreq] = useState("monthly");
  const [loanStart, setLoanStart] = useState(new Date().toISOString().split("T")[0]);
  const [loanInterestRate, setLoanInterestRate] = useState("10");
  const [loanDailyFee, setLoanDailyFee] = useState("0.33");
  const [loanLateFee, setLoanLateFee] = useState("2");
  const [loanLoading, setLoanLoading] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  const inv = useCallback((key: string) => qc.invalidateQueries({ queryKey: [key, id] }), [qc, id]);
  const invAll = useCallback(() => {
    ["client-detail", "client-contracts", "client-installments", "client-transactions", "client-profits"].forEach(k => inv(k));
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
  }, [inv, qc]);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
    staleTime: 30_000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!user,
    staleTime: 30_000,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["client-installments", id],
    queryFn: async () => {
      const { data } = await supabase.from("contract_installments").select("*, contracts(capital, frequency)").eq("client_id", id!).order("due_date");
      const now = new Date();
      return (data || []).map((i: any) => i.status === "pending" && new Date(i.due_date) < now ? { ...i, status: "overdue" } : i);
    },
    enabled: !!id && !!user,
    staleTime: 30_000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["client-transactions", id],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("client_id", id!).order("date", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!id && !!user,
    staleTime: 30_000,
  });

  const { data: profits = [] } = useQuery({
    queryKey: ["client-profits", id],
    queryFn: async () => {
      const { data } = await supabase.from("profits").select("*").eq("client_id", id!).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!user,
    staleTime: 30_000,
  });

  const kpis = useMemo(() => {
    const totalCapital = contracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
    const totalAmount = contracts.reduce((s: number, c: any) => s + Number(c.total_amount || 0), 0);
    const paidInst = installments.filter((i: any) => i.status === "paid");
    const overdueInst = installments.filter((i: any) => i.status === "overdue");
    const pendingInst = installments.filter((i: any) => i.status === "pending");
    const totalPaid = paidInst.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const totalOverdue = overdueInst.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const totalPending = pendingInst.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const totalProfit = profits.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return { totalCapital, totalAmount, totalPaid, totalOverdue, totalPending, totalProfit, remaining: totalAmount - totalPaid, paidInst, overdueInst, pendingInst };
  }, [contracts, installments, profits]);

  const loanCalc = useMemo(() => {
    const cap = parseFloat(loanCapital) || 0;
    const rate = parseFloat(loanInterestRate) || 0;
    const n = parseInt(loanInstallments) || 0;
    if (!cap || !n) return null;
    const totalInterest = cap * (rate / 100) * n;
    return { totalInterest, total: cap + totalInterest, installmentAmount: (cap + totalInterest) / n };
  }, [loanCapital, loanInterestRate, loanInstallments]);

  // Actions
  const startEdit = () => {
    setEditData({ name: client?.name || "", phone: client?.phone || "", email: client?.email || "", cpf_cnpj: client?.cpf_cnpj || "", whatsapp: client?.whatsapp || "" });
    setEditMode(true);
  };

  const saveEdit = async () => {
    const { error } = await supabase.from("clients").update(editData).eq("id", id!);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente atualizado!" }); setEditMode(false); inv("client-detail");
  };

  const startEditAddress = () => {
    const a = (client?.address as any) || {};
    setAddrData({ cep: a.cep || "", street: a.street || "", number: a.number || "", neighborhood: a.neighborhood || "", city: a.city || "", state: a.state || "" });
    setEditAddressMode(true);
  };

  const buscarCep = async () => {
    const raw = (addrData.cep || "").replace(/\D/g, "");
    if (raw.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (!data.erro) setAddrData((prev: any) => ({ ...prev, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" }));
    } catch {}
  };

  const saveAddress = async () => {
    await supabase.from("clients").update({ address: addrData }).eq("id", id!);
    toast({ title: "Endereço atualizado!" }); setEditAddressMode(false); inv("client-detail");
  };

  const generateDueDates = (start: string, freq: string, count: number) => {
    const dates: string[] = [];
    const d = new Date(start + "T12:00:00");
    for (let i = 0; i < count; i++) {
      const nd = new Date(d);
      if (freq === "daily") nd.setDate(d.getDate() + (i + 1));
      else if (freq === "weekly") nd.setDate(d.getDate() + (i + 1) * 7);
      else if (freq === "biweekly") nd.setDate(d.getDate() + (i + 1) * 14);
      else nd.setMonth(d.getMonth() + (i + 1));
      dates.push(nd.toISOString());
    }
    return dates;
  };

  const handleCreateLoan = async () => {
    if (!user || !loanCalc) return;
    setLoanLoading(true);
    try {
      const n = parseInt(loanInstallments);
      const { data: contract, error: cErr } = await supabase.from("contracts").insert({
        user_id: user.id, client_id: id!, capital: parseFloat(loanCapital),
        interest_rate: parseFloat(loanInterestRate), num_installments: n,
        installment_amount: loanCalc.installmentAmount, frequency: loanFreq,
        start_date: new Date(loanStart + "T12:00:00").toISOString(),
        late_fee_percent: parseFloat(loanLateFee), daily_interest_percent: parseFloat(loanDailyFee),
        total_amount: loanCalc.total, total_interest: loanCalc.totalInterest, status: "active",
      }).select().single();
      if (cErr) throw cErr;

      const dueDates = generateDueDates(loanStart, loanFreq, n);
      const { error: iErr } = await supabase.from("contract_installments").insert(
        dueDates.map((dd, i) => ({ user_id: user.id, contract_id: contract.id, client_id: id!, installment_number: i + 1, amount: loanCalc.installmentAmount, due_date: dd, status: "pending" }))
      );
      if (iErr) throw iErr;

      await supabase.from("transactions").insert({
        user_id: user.id, amount: parseFloat(loanCapital), type: "loan",
        description: `Empréstimo para ${client?.name} - ${n}x R$ ${fmt(loanCalc.installmentAmount)}`,
        client_id: id, contract_id: contract.id,
      });

      toast({ title: "Empréstimo criado!", description: `${n} parcelas geradas.` });
      setNewLoanMode(false); setLoanCapital(""); setLoanInstallments("");
      invAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setLoanLoading(false); }
  };

  const payFull = async (instId: string, amount: number) => {
    if (!user) return;
    const { error } = await supabase.from("contract_installments").update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: amount }).eq("id", instId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    const inst = installments.find((i: any) => i.id === instId);
    if (inst) {
      const contract = contracts.find((c: any) => c.id === inst.contract_id);
      if (contract) {
        const rate = Number(contract.interest_rate || 0) / 100;
        const interest = amount * (rate / (1 + rate));
        if (interest > 0) await supabase.from("profits").insert({ user_id: user.id, amount: interest, description: `Juros parcela #${inst.installment_number} - ${client?.name}`, client_id: id });
      }
      await supabase.from("transactions").insert({ user_id: user.id, amount, type: "payment", description: `Pagamento parcela #${inst.installment_number} - ${client?.name}`, client_id: id, contract_id: inst.contract_id });
      const otherUnpaid = installments.filter((i: any) => i.contract_id === inst.contract_id && i.id !== instId && i.status !== "paid");
      if (otherUnpaid.length === 0) await supabase.from("contracts").update({ status: "completed" }).eq("id", inst.contract_id);
    }
    toast({ title: "Parcela quitada!" }); invAll();
  };

  const handlePartialPay = async () => {
    if (!partialPayModal || !user) return;
    const val = parseFloat(partialAmount);
    if (!val || val <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    const instAmount = Number(partialPayModal.amount);
    const alreadyPaid = Number(partialPayModal.paid_amount || 0);
    if (val + alreadyPaid >= instAmount) {
      await payFull(partialPayModal.id, instAmount);
    } else {
      await supabase.from("contract_installments").update({ paid_amount: alreadyPaid + val }).eq("id", partialPayModal.id);
      await supabase.from("transactions").insert({ user_id: user.id, amount: val, type: "partial_payment", description: `Pagamento parcial #${partialPayModal.installment_number} - ${client?.name}`, client_id: id, contract_id: partialPayModal.contract_id });
      toast({ title: `R$ ${fmt(val)} registrado!` });
      invAll();
    }
    setPartialPayModal(null);
  };

  const reversePayment = async (instId: string) => {
    if (!confirm("Estornar pagamento?")) return;
    await supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", instId);
    toast({ title: "Estornado!" }); invAll();
  };

  const getPhone = () => (client?.whatsapp || client?.phone || "").replace(/\D/g, "");

  const sendBilling = (inst: any) => {
    const phone = getPhone();
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const msg = encodeURIComponent(`Olá ${client?.name}, sua parcela #${inst.installment_number} de R$ ${fmt(Number(inst.amount))} venceu em ${new Date(inst.due_date).toLocaleDateString("pt-BR")}. Regularize o pagamento.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const sendAllOverdue = () => {
    if (!kpis.overdueInst.length) { toast({ title: "Sem parcelas atrasadas" }); return; }
    const phone = getPhone();
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const total = kpis.overdueInst.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const msg = encodeURIComponent(`Olá ${client?.name}, você possui ${kpis.overdueInst.length} parcela(s) em atraso, total R$ ${fmt(total)}. Entre em contato para regularizar.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const payAllPending = async () => {
    const unpaid = installments.filter((i: any) => i.status !== "paid");
    if (!unpaid.length) { toast({ title: "Todas pagas!" }); return; }
    if (!confirm(`Quitar ${unpaid.length} parcela(s)?`)) return;
    for (const inst of unpaid) await payFull(inst.id, Number(inst.amount));
    toast({ title: `${unpaid.length} parcelas quitadas!` });
  };

  const copyClientInfo = () => {
    navigator.clipboard.writeText(`Nome: ${client?.name}\nCPF: ${client?.cpf_cnpj || "—"}\nTel: ${client?.phone || "—"}\nWhatsApp: ${client?.whatsapp || "—"}\nEmail: ${client?.email || "—"}`);
    toast({ title: "Copiado!" });
  };

  const exportSummary = () => {
    navigator.clipboard.writeText([
      `=== ${client?.name} ===`, `CPF: ${client?.cpf_cnpj || "—"}`,
      `Capital: R$ ${fmt(kpis.totalCapital)}`, `Recebido: R$ ${fmt(kpis.totalPaid)}`,
      `Atraso: R$ ${fmt(kpis.totalOverdue)}`, `Restante: R$ ${fmt(kpis.remaining)}`,
    ].join("\n"));
    toast({ title: "Resumo copiado!" });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    doc.setFillColor(20, 20, 25); doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DO CLIENTE", 14, 16);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Emitido em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`, 14, 24);
    doc.text(`Cliente: ${client?.name || "—"}  |  CPF/CNPJ: ${client?.cpf_cnpj || "—"}`, 14, 31);

    let y = 46;
    doc.setTextColor(40, 40, 40); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Resumo Financeiro", 14, y); y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Valor"]],
      body: [
        ["Capital Emprestado", `R$ ${fmt(kpis.totalCapital)}`],
        ["Total Recebido", `R$ ${fmt(kpis.totalPaid)}`],
        ["Total em Atraso", `R$ ${fmt(kpis.totalOverdue)}`],
        ["Saldo Restante", `R$ ${fmt(kpis.remaining)}`],
        ["Lucro Gerado", `R$ ${fmt(kpis.totalProfit)}`],
      ],
      theme: "grid",
      headStyles: { fillColor: [20, 20, 25], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 82, halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (installments.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Parcelas", 14, y); y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Nº", "Valor", "Vencimento", "Status"]],
        body: installments.map((i: any) => [String(i.installment_number), `R$ ${fmt(Number(i.amount))}`, new Date(i.due_date).toLocaleDateString("pt-BR"), i.status === "paid" ? "Pago" : i.status === "overdue" ? "Atrasada" : "Pendente"]),
        theme: "grid", headStyles: { fillColor: [20, 20, 25], fontSize: 8 }, bodyStyles: { fontSize: 7.5 }, margin: { left: 14, right: 14 },
        didParseCell: (data: any) => { if (data.section === "body" && data.column.index === 3) { if (data.cell.raw === "Atrasada") data.cell.styles.textColor = [220, 50, 50]; else if (data.cell.raw === "Pago") data.cell.styles.textColor = [34, 139, 34]; } },
      });
    }

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(7); doc.setTextColor(140); doc.text(`Página ${p}/${pages}`, 105, 290, { align: "center" }); }
    doc.save(`extrato_${(client?.name || "cliente").replace(/\s+/g, "_")}.pdf`);
    toast({ title: "PDF gerado!" });
  };

  const toggleStatus = async () => {
    const s = client?.status === "Ativo" ? "Inativo" : "Ativo";
    await supabase.from("clients").update({ status: s }).eq("id", id!);
    toast({ title: `Status: ${s}` }); inv("client-detail");
  };

  const updateScore = async (delta: number) => {
    const ns = Math.max(0, Math.min(1000, (client?.credit_score || 100) + delta));
    await supabase.from("clients").update({ credit_score: ns }).eq("id", id!);
    toast({ title: `Score: ${ns}` }); inv("client-detail");
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este cliente e todos os dados?")) return;
    await supabase.from("contract_installments").delete().eq("client_id", id!);
    await supabase.from("contracts").delete().eq("client_id", id!);
    await supabase.from("installments").delete().eq("client_id", id!);
    await supabase.from("transactions").delete().eq("client_id", id!);
    await supabase.from("clients").delete().eq("id", id!);
    toast({ title: "Cliente excluído!" }); navigate("/clientes");
  };

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );

  if (!client) return (
    <div className="text-center py-16"><User size={48} className="mx-auto text-muted-foreground/20 mb-4" /><p className="text-muted-foreground">Cliente não encontrado</p></div>
  );

  const address = client.address as any;
  const scoreClr = (client.credit_score || 0) >= 700 ? "text-success" : (client.credit_score || 0) >= 400 ? "text-warning" : "text-destructive";

  const tabs = [
    { key: "resumo" as const, label: "Resumo", Icon: Activity },
    { key: "contratos" as const, label: "Contratos", Icon: FileText },
    { key: "parcelas" as const, label: "Parcelas", Icon: Receipt },
    { key: "historico" as const, label: "Histórico", Icon: Clock },
  ];

  const moreActions = [
    { icon: Copy, label: "Copiar Dados", action: copyClientInfo },
    { icon: Download, label: "Exportar Resumo", action: exportSummary },
    { icon: Printer, label: "Gerar PDF", action: generatePDF },
    { icon: Star, label: "Score +50", action: () => updateScore(50) },
    { icon: TrendingUp, label: "Score -50", action: () => updateScore(-50) },
    { icon: Ban, label: client.status === "Ativo" ? "Inativar" : "Reativar", action: toggleStatus },
    { icon: Trash2, label: "Excluir", action: handleDelete, destructive: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/clientes")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary overflow-hidden">
                {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
              </div>
              <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform opacity-0 group-hover:opacity-100" style={{ background: "var(--gradient-button)" }}>
                <Camera size={10} className="text-white" />
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !id) return;
                  const ext = file.name.split(".").pop();
                  const path = `client-avatars/${id}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
                  if (!upErr) {
                    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
                    await supabase.from("clients").update({ avatar_url: urlData.publicUrl + "?t=" + Date.now() }).eq("id", id);
                    inv("client-detail");
                    toast({ title: "✓ Foto atualizada!" });
                  } else {
                    toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" });
                  }
                }} className="hidden" />
              </label>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{client.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{client.cpf_cnpj || "Sem CPF"}</span>
                <Badge variant="outline" className={client.status === "Ativo" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{client.status}</Badge>
                <span className={`text-xs font-bold ${scoreClr}`}>Score: {client.credit_score || 0}</span>
              </div>
            </div>
          </div>
        </div>
        <button onClick={startEdit} className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors" title="Editar"><Edit size={16} /></button>
        <div className="relative">
          <button onClick={() => setShowMoreActions(!showMoreActions)} className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-colors"><Activity size={16} /></button>
          {showMoreActions && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
              <div className="absolute right-0 top-10 w-48 bg-card border border-border rounded-2xl shadow-lg z-50 py-1">
                {moreActions.map((item, idx) => (
                  <button key={idx} onClick={() => { item.action(); setShowMoreActions(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-accent transition-colors ${item.destructive ? "text-destructive" : "text-foreground"}`}>
                    <item.icon size={14} className={item.destructive ? "text-destructive" : "text-muted-foreground"} />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== MODALS ===== */}

      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditMode(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar Cliente</h2>
              <button onClick={() => setEditMode(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            {[{ k: "name", l: "Nome", t: "text" }, { k: "phone", l: "Telefone", t: "tel" }, { k: "whatsapp", l: "WhatsApp", t: "tel" }, { k: "email", l: "E-mail", t: "email" }, { k: "cpf_cnpj", l: "CPF/CNPJ", t: "text" }].map(f => (
              <div key={f.k}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.l}</label>
                <input type={f.t} value={editData[f.k] || ""} onChange={e => setEditData({ ...editData, [f.k]: e.target.value })} className={INPUT} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={saveEdit} className="action-btn-primary">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {editAddressMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditAddressMode(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar Endereço</h2>
              <button onClick={() => setEditAddressMode(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">CEP</label>
                <input type="text" placeholder="00000-000" value={addrData.cep || ""} onChange={e => setAddrData({ ...addrData, cep: e.target.value })} className={INPUT} />
              </div>
              <button onClick={buscarCep} className="self-end px-3 py-2.5 rounded-lg bg-accent border border-border text-foreground hover:bg-accent/70 transition-colors"><Search size={16} /></button>
            </div>
            {[{ k: "street", l: "Rua" }, { k: "number", l: "Número" }, { k: "neighborhood", l: "Bairro" }, { k: "city", l: "Cidade" }, { k: "state", l: "Estado" }].map(f => (
              <div key={f.k}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.l}</label>
                <input type="text" value={addrData[f.k] || ""} onChange={e => setAddrData({ ...addrData, [f.k]: e.target.value })} className={INPUT} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditAddressMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={saveAddress} className="action-btn-primary">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {newLoanMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setNewLoanMode(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Novo Empréstimo</h2>
              <button onClick={() => setNewLoanMode(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <p className="text-xs text-muted-foreground">Para: <strong className="text-foreground">{client.name}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital (R$)</label>
                <input type="number" value={loanCapital} onChange={e => setLoanCapital(e.target.value)} placeholder="1000" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº Parcelas</label>
                <input type="number" value={loanInstallments} onChange={e => setLoanInstallments(e.target.value)} placeholder="12" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Taxa (%)</label>
                <input type="number" step="0.1" value={loanInterestRate} onChange={e => setLoanInterestRate(e.target.value)} className={INPUT} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequência</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(FREQ).map(([v, l]) => (
                    <button key={v} onClick={() => setLoanFreq(v)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${loanFreq === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">1º Vencimento</label>
                <input type="date" value={loanStart} onChange={e => setLoanStart(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Diária (%)</label>
                <input type="number" step="0.01" value={loanDailyFee} onChange={e => setLoanDailyFee(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Mensal (%)</label>
                <input type="number" step="0.1" value={loanLateFee} onChange={e => setLoanLateFee(e.target.value)} className={INPUT} />
              </div>
            </div>
            {loanCalc && (
              <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Juros</p><p className="font-semibold text-foreground">R$ {fmt(loanCalc.totalInterest)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Total</p><p className="font-semibold text-foreground">R$ {fmt(loanCalc.total)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Parcela</p><p className="font-semibold text-primary">R$ {fmt(loanCalc.installmentAmount)}</p></div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setNewLoanMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={handleCreateLoan} disabled={loanLoading || !loanCalc}
                className="action-btn-primary disabled:opacity-50">
                {loanLoading ? "Criando..." : "Criar Empréstimo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {partialPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPartialPayModal(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Pagamento</h2>
              <button onClick={() => setPartialPayModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Parcela #{partialPayModal.installment_number}</p>
              <p className="text-lg font-bold text-foreground">R$ {fmt(Number(partialPayModal.amount))}</p>
              {Number(partialPayModal.paid_amount || 0) > 0 && <p className="text-xs text-success">Já pago: R$ {fmt(Number(partialPayModal.paid_amount))}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label>
              <input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder={fmt(Number(partialPayModal.amount))} className={INPUT} autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPartialAmount(String(partialPayModal.amount))} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">Total</button>
              <button onClick={() => setPartialAmount(String(Number(partialPayModal.amount) / 2))} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">Metade</button>
            </div>
            <button onClick={handlePartialPay} disabled={!partialAmount || parseFloat(partialAmount) <= 0}
              className="action-btn-primary w-full">
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* ===== CONTENT ===== */}

      {/* Contact */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { Icon: Phone, label: "Telefone", value: client.phone },
            { Icon: Mail, label: "E-mail", value: client.email },
            { Icon: MessageSquare, label: "WhatsApp", value: client.whatsapp },
            { Icon: MapPin, label: "Cidade", value: address?.city ? `${address.city}/${address.state}` : null },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <item.Icon size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <p className="text-xs text-foreground font-medium truncate">{item.value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
        {address?.street && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <MapPin size={12} className="inline mr-1" />
            {address.street}{address.number ? `, ${address.number}` : ""} - {address.neighborhood} · {address.city}/{address.state}
          </p>
        )}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
          <button onClick={() => { const p = client.phone; if (p) window.open(`tel:${p.replace(/\D/g, "")}`, "_self"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"><Phone size={13} /> Ligar</button>
          <button onClick={() => { const p = getPhone(); if (p) window.open(`https://wa.me/${p}`, "_blank"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"><MessageSquare size={13} /> WhatsApp</button>
          <button onClick={() => { if (client.email) window.open(`mailto:${client.email}`, "_blank"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"><Mail size={13} /> E-mail</button>
          <button onClick={startEditAddress} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs font-medium hover:bg-accent transition-colors ml-auto"><MapPin size={13} /> Editar Endereço</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { Icon: DollarSign, label: "Capital na Rua", value: `R$ ${fmt(kpis.totalCapital)}`, color: "text-foreground", bg: "bg-primary/10" },
          { Icon: CheckCircle, label: "Recebido", value: `R$ ${fmt(kpis.totalPaid)}`, color: "text-success", bg: "bg-success/10" },
          { Icon: AlertTriangle, label: "Em Atraso", value: `R$ ${fmt(kpis.totalOverdue)}`, color: "text-destructive", bg: "bg-destructive/10" },
          { Icon: Wallet, label: "Restante", value: `R$ ${fmt(kpis.remaining)}`, color: "text-primary", bg: "bg-primary/10" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-3.5">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}><s.Icon size={16} className={s.color} /></div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setNewLoanMode(true)} className="action-btn-primary">
          <Plus size={15} /> Novo Empréstimo
        </button>
        <button onClick={payAllPending} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-success/10 text-success border border-success/20 text-sm font-medium hover:bg-success/20 transition-colors">
          <CheckCircle size={15} /> Quitar Todas
        </button>
        {kpis.overdueInst.length > 0 && (
          <button onClick={sendAllOverdue} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium hover:bg-destructive/20 transition-colors">
            <Send size={15} /> Cobrar ({kpis.overdueInst.length})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-2xl p-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <tab.Icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumo */}
      {activeTab === "resumo" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Activity size={16} className="text-primary" /> Visão Geral</h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><p className="text-2xl font-bold text-foreground">{contracts.length}</p><p className="text-[10px] text-muted-foreground uppercase">Contratos</p></div>
              <div><p className="text-2xl font-bold text-success">{kpis.paidInst.length}</p><p className="text-[10px] text-muted-foreground uppercase">Pagas</p></div>
              <div><p className="text-2xl font-bold text-destructive">{kpis.overdueInst.length}</p><p className="text-[10px] text-muted-foreground uppercase">Atrasadas</p></div>
              <div><p className="text-2xl font-bold text-foreground">{kpis.pendingInst.length}</p><p className="text-[10px] text-muted-foreground uppercase">Pendentes</p></div>
            </div>
          </div>
          {contracts.map((c: any) => {
            const cInst = installments.filter((i: any) => i.contract_id === c.id);
            const cPaid = cInst.filter((i: any) => i.status === "paid").length;
            const pct = Math.round((cPaid / (c.num_installments || 1)) * 100);
            return (
              <div key={c.id} className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setActiveTab("parcelas")}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">R$ {fmt(Number(c.capital))} · {c.num_installments}x</p>
                  <Badge variant="outline" className={c.status === "active" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{c.status === "active" ? "Ativo" : c.status}</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
                <p className="text-[10px] text-muted-foreground mt-1">{cPaid}/{c.num_installments} pagas · {pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Contratos */}
      {activeTab === "contratos" && (
        <div className="space-y-3">
          <button onClick={() => setNewLoanMode(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
            <Plus size={16} /> Novo Empréstimo
          </button>
          {contracts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum contrato</p>
          ) : contracts.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/contratos/${c.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.capital))}</p>
                  <p className="text-xs text-muted-foreground">{c.num_installments}x R$ {fmt(Number(c.installment_amount))} · {FREQ[c.frequency] || c.frequency}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{new Date(c.start_date).toLocaleDateString("pt-BR")}</p>
                  <p className="text-xs font-medium text-primary">Lucro: R$ {fmt(Number(c.total_interest))}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Parcelas */}
      {activeTab === "parcelas" && (
        <div className="space-y-2">
          {installments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma parcela</p>
          ) : installments.map((inst: any) => {
            const isOverdue = inst.status === "overdue";
            const isPaid = inst.status === "paid";
            const partial = !isPaid && Number(inst.paid_amount || 0) > 0;
            return (
              <div key={inst.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${isOverdue ? "bg-destructive/5 border-destructive/15" : isPaid ? "bg-success/5 border-success/15" : "bg-card border-border"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isOverdue ? "bg-destructive/10 text-destructive" : isPaid ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {inst.installment_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">R$ {fmt(Number(inst.amount))}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                    {inst.paid_at && ` · Pago: ${new Date(inst.paid_at).toLocaleDateString("pt-BR")}`}
                    {partial && ` · Parcial: R$ ${fmt(Number(inst.paid_amount))}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isPaid ? (
                    <button onClick={() => reversePayment(inst.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Estornar"><RotateCcw size={14} /></button>
                  ) : (
                    <>
                      <button onClick={() => sendBilling(inst)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Cobrar"><Send size={14} /></button>
                      <button onClick={() => { setPartialPayModal(inst); setPartialAmount(""); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Parcial"><Percent size={14} /></button>
                      <button onClick={() => payFull(inst.id, Number(inst.amount))} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-success/10 text-success hover:bg-success/20 transition-colors">Quitar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === "historico" && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma transação</p>
          ) : transactions.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "income" || t.type === "payment" ? "bg-success/10" : "bg-destructive/10"}`}>
                {t.type === "income" || t.type === "payment" ? <TrendingUp size={14} className="text-success" /> : <DollarSign size={14} className="text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className={`text-sm font-bold ${t.type === "income" || t.type === "payment" ? "text-success" : "text-foreground"}`}>
                R$ {fmt(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClienteDetalhe;
