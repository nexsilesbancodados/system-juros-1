import { useState, useMemo } from "react";
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
  Calendar, Receipt, Activity, Search, X, ArrowRight, Check, Percent, Wallet, Printer
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const freqOpts = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
];

const ClienteDetalhe = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"resumo" | "contratos" | "parcelas" | "historico">("resumo");
  // Modals
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [editAddressMode, setEditAddressMode] = useState(false);
  const [addrData, setAddrData] = useState<any>({});
  const [newLoanMode, setNewLoanMode] = useState(false);
  const [partialPayModal, setPartialPayModal] = useState<any>(null);
  const [partialAmount, setPartialAmount] = useState("");
  // New loan inline
  const [loanCapital, setLoanCapital] = useState("");
  const [loanInstallments, setLoanInstallments] = useState("");
  const [loanFreq, setLoanFreq] = useState("monthly");
  const [loanStart, setLoanStart] = useState(new Date().toISOString().split("T")[0]);
  const [loanInterestRate, setLoanInterestRate] = useState("10");
  const [loanDailyFee, setLoanDailyFee] = useState("0.33");
  const [loanLateFee, setLoanLateFee] = useState("2");
  const [loanLoading, setLoanLoading] = useState(false);

  const inv = (key: string) => qc.invalidateQueries({ queryKey: [key, id] });

  // ===== QUERIES =====
  const { data: client, isLoading } = useQuery({
    queryKey: ["client-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["client-installments", id],
    queryFn: async () => {
      const { data } = await supabase.from("contract_installments").select("*, contracts(capital, frequency)").eq("client_id", id!).order("due_date", { ascending: true });
      const now = new Date();
      return (data || []).map((inst: any) => {
        if (inst.status === "pending" && new Date(inst.due_date) < now) return { ...inst, status: "overdue" };
        return inst;
      });
    },
    enabled: !!id && !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["client-transactions", id],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("client_id", id!).order("date", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const { data: profits = [] } = useQuery({
    queryKey: ["client-profits", id],
    queryFn: async () => {
      const { data } = await supabase.from("profits").select("*").eq("client_id", id!).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!user,
  });

  // ===== CALCULATIONS =====
  const totalCapital = contracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
  const totalAmount = contracts.reduce((s: number, c: any) => s + Number(c.total_amount || 0), 0);
  const paidInst = installments.filter((i: any) => i.status === "paid");
  const overdueInst = installments.filter((i: any) => i.status === "overdue");
  const pendingInst = installments.filter((i: any) => i.status === "pending");
  const totalPaid = paidInst.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
  const totalOverdue = overdueInst.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const totalPending = pendingInst.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const totalProfit = profits.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const remaining = totalAmount - totalPaid;

  // Loan calc
  const loanCalc = useMemo(() => {
    const cap = parseFloat(loanCapital) || 0;
    const rate = parseFloat(loanInterestRate) || 0;
    const n = parseInt(loanInstallments) || 0;
    if (!cap || !n) return null;
    const totalInterest = cap * (rate / 100) * n;
    const total = cap + totalInterest;
    return { totalInterest, total, installmentAmount: total / n };
  }, [loanCapital, loanInterestRate, loanInstallments]);

  // ===== TOOL FUNCTIONS (all usable within the page) =====

  // 1. Editar Ficha
  const startEdit = () => {
    setEditData({ name: client?.name || "", phone: client?.phone || "", email: client?.email || "", cpf_cnpj: client?.cpf_cnpj || "", whatsapp: client?.whatsapp || "" });
    setEditMode(true);
  };
  const saveEdit = async () => {
    const { error } = await supabase.from("clients").update(editData).eq("id", id!);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente atualizado!" }); setEditMode(false); inv("client-detail");
  };

  // 2. Editar Endereço
  const startEditAddress = () => {
    const a = (client?.address as any) || {};
    setAddrData({ cep: a.cep || "", street: a.street || "", number: a.number || "", neighborhood: a.neighborhood || "", city: a.city || "", state: a.state || "" });
    setEditAddressMode(true);
  };
  const buscarCep = async () => {
    if ((addrData.cep || "").replace(/\D/g, "").length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${addrData.cep.replace(/\D/g, "")}/json/`);
      const data = await res.json();
      if (!data.erro) setAddrData({ ...addrData, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" });
    } catch {}
  };
  const saveAddress = async () => {
    await supabase.from("clients").update({ address: addrData }).eq("id", id!);
    toast({ title: "Endereço atualizado!" }); setEditAddressMode(false); inv("client-detail");
  };

  // 3. Novo Empréstimo (inline)
  const generateDueDates = (start: string, freq: string, count: number) => {
    const dates: string[] = [];
    const d = new Date(start + "T12:00:00");
    for (let i = 0; i < count; i++) {
      const nd = new Date(d);
      switch (freq) {
        case "daily": nd.setDate(d.getDate() + (i + 1)); break;
        case "weekly": nd.setDate(d.getDate() + (i + 1) * 7); break;
        case "biweekly": nd.setDate(d.getDate() + (i + 1) * 14); break;
        case "monthly": nd.setMonth(d.getMonth() + (i + 1)); break;
      }
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
      const insts = dueDates.map((dd, i) => ({
        user_id: user.id, contract_id: contract.id, client_id: id!,
        installment_number: i + 1, amount: loanCalc.installmentAmount, due_date: dd, status: "pending",
      }));
      const { error: iErr } = await supabase.from("contract_installments").insert(insts);
      if (iErr) throw iErr;

      // Register loan disbursement transaction
      await supabase.from("transactions").insert({
        user_id: user.id, amount: parseFloat(loanCapital), type: "loan",
        description: `Empréstimo para ${client?.name} - ${n}x R$ ${fmt(loanCalc.installmentAmount)}`,
        client_id: id, contract_id: contract.id,
      });

      toast({ title: "Empréstimo criado!", description: `${n} parcelas geradas.` });
      setNewLoanMode(false); setLoanCapital(""); setLoanInstallments("");
      inv("client-contracts"); inv("client-installments"); inv("client-transactions");
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setLoanLoading(false); }
  };

  // 4. Quitar Parcela (total)
  const payFull = async (instId: string, amount: number) => {
    if (!user) return;
    const { error } = await supabase.from("contract_installments").update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: amount }).eq("id", instId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    // Find the installment to get contract info
    const inst = installments.find((i: any) => i.id === instId);
    if (inst) {
      // Register profit (interest portion)
      const contract = contracts.find((c: any) => c.id === inst.contract_id);
      if (contract) {
        const interestRate = Number(contract.interest_rate || 0) / 100;
        const interestPortion = amount * (interestRate / (1 + interestRate));
        if (interestPortion > 0) {
          await supabase.from("profits").insert({
            user_id: user.id, amount: interestPortion,
            description: `Juros parcela #${inst.installment_number} - ${client?.name}`,
            client_id: id,
          });
        }
      }
      // Register transaction
      await supabase.from("transactions").insert({
        user_id: user.id, amount, type: "payment",
        description: `Pagamento parcela #${inst.installment_number} - ${client?.name}`,
        client_id: id, contract_id: inst.contract_id,
      });

      // Check if all installments for this contract are paid
      const otherUnpaid = installments.filter((i: any) => i.contract_id === inst.contract_id && i.id !== instId && i.status !== "paid");
      if (otherUnpaid.length === 0 && contract) {
        await supabase.from("contracts").update({ status: "completed" }).eq("id", inst.contract_id);
        inv("client-contracts");
      }
    }

    toast({ title: "Parcela quitada!" }); inv("client-installments"); inv("client-transactions"); inv("client-profits");
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
  };

  // 5. Pagamento Parcial
  const openPartialPay = (inst: any) => { setPartialPayModal(inst); setPartialAmount(""); };
  const handlePartialPay = async () => {
    if (!partialPayModal || !user) return;
    const val = parseFloat(partialAmount);
    if (!val || val <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    const instAmount = Number(partialPayModal.amount);
    if (val >= instAmount) {
      await payFull(partialPayModal.id, instAmount);
    } else {
      const alreadyPaid = Number(partialPayModal.paid_amount || 0);
      const newPaid = alreadyPaid + val;
      if (newPaid >= instAmount) {
        await payFull(partialPayModal.id, instAmount);
      } else {
        await supabase.from("contract_installments").update({ paid_amount: newPaid }).eq("id", partialPayModal.id);
        // Register partial transaction
        await supabase.from("transactions").insert({
          user_id: user.id, amount: val, type: "partial_payment",
          description: `Pagamento parcial #${partialPayModal.installment_number} - ${client?.name}`,
          client_id: id, contract_id: partialPayModal.contract_id,
        });
      }
      toast({ title: `R$ ${fmt(val)} registrado!` });
    }
    setPartialPayModal(null);
    inv("client-installments"); inv("client-transactions");
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
  };

  // 6. Estornar Pagamento
  const reversePayment = async (instId: string) => {
    if (!confirm("Estornar pagamento desta parcela?")) return;
    await supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", instId);
    toast({ title: "Estornado!" });
    inv("client-installments"); inv("client-contracts"); inv("client-transactions"); inv("client-profits");
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
  };

  // 7. Enviar Cobrança Individual
  const sendBilling = (inst: any) => {
    const phone = client?.whatsapp || client?.phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const msg = encodeURIComponent(`Olá ${client?.name}, sua parcela #${inst.installment_number} no valor de R$ ${fmt(Number(inst.amount))} venceu em ${new Date(inst.due_date).toLocaleDateString("pt-BR")}. Por favor, regularize o pagamento.`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  // 8. Cobrar Todas Atrasadas
  const sendAllOverdue = () => {
    if (!overdueInst.length) { toast({ title: "Sem parcelas atrasadas" }); return; }
    const phone = client?.whatsapp || client?.phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const total = overdueInst.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const msg = encodeURIComponent(`Olá ${client?.name}, você possui ${overdueInst.length} parcela(s) em atraso totalizando R$ ${fmt(total)}. Entre em contato para regularizar.`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  // 9. Quitar Todas Pendentes
  const payAllPending = async () => {
    const unpaid = installments.filter((i: any) => i.status !== "paid");
    if (!unpaid.length) { toast({ title: "Todas as parcelas já estão pagas!" }); return; }
    if (!confirm(`Quitar ${unpaid.length} parcela(s)?`)) return;
    for (const inst of unpaid) {
      await payFull(inst.id, Number(inst.amount));
    }
    toast({ title: `${unpaid.length} parcelas quitadas!` });
  };

  // 10. Copiar Dados
  const copyClientInfo = () => {
    const text = `Nome: ${client?.name}\nCPF/CNPJ: ${client?.cpf_cnpj || "—"}\nTelefone: ${client?.phone || "—"}\nWhatsApp: ${client?.whatsapp || "—"}\nEmail: ${client?.email || "—"}`;
    navigator.clipboard.writeText(text); toast({ title: "Dados copiados!" });
  };

  // 11. Exportar Resumo Financeiro
  const exportSummary = () => {
    const lines = [
      `=== FICHA: ${client?.name} ===`, `CPF: ${client?.cpf_cnpj || "—"}`, `Score: ${client?.credit_score || 0}`,
      ``, `=== FINANCEIRO ===`, `Capital: R$ ${fmt(totalCapital)}`, `Recebido: R$ ${fmt(totalPaid)}`,
      `Em atraso: R$ ${fmt(totalOverdue)}`, `Pendente: R$ ${fmt(totalPending)}`, `Restante: R$ ${fmt(remaining)}`,
      `Contratos: ${contracts.length}`, `Pagas: ${paidInst.length}`, `Atrasadas: ${overdueInst.length}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")); toast({ title: "Resumo copiado!" });
  };

  // PDF Extrato Completo
  const generatePDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const pg = { x: 14, w: 182 };

    // Header
    doc.setFillColor(20, 20, 25);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO DO CLIENTE", pg.x, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Emitido em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`, pg.x, 24);
    doc.text(`Cliente: ${client?.name || "—"}  |  CPF/CNPJ: ${client?.cpf_cnpj || "—"}`, pg.x, 31);

    let y = 46;

    // Dados do Cliente
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Dados do Cliente", pg.x, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const addr = client?.address as any;
    const infoLines = [
      `Nome: ${client?.name || "—"}`,
      `CPF/CNPJ: ${client?.cpf_cnpj || "—"}`,
      `Telefone: ${client?.phone || "—"}  |  WhatsApp: ${client?.whatsapp || "—"}`,
      `Email: ${client?.email || "—"}`,
      `Endereço: ${addr ? `${addr.street || ""}, ${addr.number || ""} - ${addr.neighborhood || ""}, ${addr.city || ""}/${addr.state || ""}` : "Não informado"}`,
      `Score: ${client?.credit_score || 0}  |  Status: ${client?.status || "—"}`,
    ];
    infoLines.forEach(l => { doc.text(l, pg.x, y); y += 5; });

    y += 4;

    // Resumo Financeiro
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Financeiro", pg.x, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Valor"]],
      body: [
        ["Capital Emprestado", `R$ ${fmt(totalCapital)}`],
        ["Total com Juros", `R$ ${fmt(totalAmount)}`],
        ["Total Recebido", `R$ ${fmt(totalPaid)}`],
        ["Total em Atraso", `R$ ${fmt(totalOverdue)}`],
        ["Total Pendente", `R$ ${fmt(totalPending)}`],
        ["Saldo Restante", `R$ ${fmt(remaining)}`],
        ["Lucro Gerado", `R$ ${fmt(totalProfit)}`],
        ["Contratos Ativos", String(contracts.filter((c: any) => c.status === "active").length)],
        ["Parcelas Pagas", String(paidInst.length)],
        ["Parcelas Atrasadas", String(overdueInst.length)],
        ["Parcelas Pendentes", String(pendingInst.length)],
      ],
      theme: "grid",
      headStyles: { fillColor: [20, 20, 25], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 82, halign: "right" } },
      margin: { left: pg.x, right: pg.x },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Contratos
    if (contracts.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("Contratos", pg.x, y);
      y += 2;

      const freqMap: any = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };
      autoTable(doc, {
        startY: y,
        head: [["#", "Capital", "Juros", "Total", "Parcelas", "Freq.", "Início", "Status"]],
        body: contracts.map((c: any, i: number) => [
          String(i + 1),
          `R$ ${fmt(Number(c.capital))}`,
          `${c.interest_rate}%`,
          `R$ ${fmt(Number(c.total_amount))}`,
          `${c.num_installments}x R$ ${fmt(Number(c.installment_amount))}`,
          freqMap[c.frequency] || c.frequency,
          new Date(c.start_date).toLocaleDateString("pt-BR"),
          c.status === "active" ? "Ativo" : c.status,
        ]),
        theme: "grid",
        headStyles: { fillColor: [20, 20, 25], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: pg.x, right: pg.x },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Parcelas
    const allInst = [...overdueInst, ...pendingInst, ...paidInst];
    if (allInst.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("Parcelas", pg.x, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Nº", "Valor", "Vencimento", "Pago em", "Valor Pago", "Status"]],
        body: allInst.map((i: any) => [
          String(i.installment_number),
          `R$ ${fmt(Number(i.amount))}`,
          new Date(i.due_date).toLocaleDateString("pt-BR"),
          i.paid_at ? new Date(i.paid_at).toLocaleDateString("pt-BR") : "—",
          i.paid_amount ? `R$ ${fmt(Number(i.paid_amount))}` : "—",
          i.status === "paid" ? "Pago" : i.status === "overdue" ? "Atrasada" : "Pendente",
        ]),
        theme: "grid",
        headStyles: { fillColor: [20, 20, 25], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: pg.x, right: pg.x },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const v = data.cell.raw;
            if (v === "Atrasada") data.cell.styles.textColor = [220, 50, 50];
            else if (v === "Pago") data.cell.styles.textColor = [34, 139, 34];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Página ${p}/${pageCount}`, 105, 290, { align: "center" });
      doc.text("Documento gerado automaticamente — System Juros", 105, 294, { align: "center" });
    }

    doc.save(`extrato_${(client?.name || "cliente").replace(/\s+/g, "_")}_${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "PDF gerado!", description: "O download iniciou automaticamente." });
  };

  // 12. Ativar/Inativar
  const toggleStatus = async () => {
    const s = client?.status === "Ativo" ? "Inativo" : "Ativo";
    await supabase.from("clients").update({ status: s }).eq("id", id!);
    toast({ title: `Status: ${s}` }); inv("client-detail");
  };

  // 13. Alterar Score
  const updateScore = async (delta: number) => {
    const ns = Math.max(0, Math.min(1000, (client?.credit_score || 100) + delta));
    await supabase.from("clients").update({ credit_score: ns }).eq("id", id!);
    toast({ title: `Score: ${ns}` }); inv("client-detail");
  };

  // 14. Ligar
  const callClient = () => {
    const p = client?.phone; if (!p) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    window.open(`tel:${p.replace(/\D/g, "")}`, "_self");
  };

  // 15. WhatsApp
  const openWhatsApp = () => {
    const p = (client?.whatsapp || client?.phone || "").replace(/\D/g, "");
    if (!p) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    window.open(`https://wa.me/${p}`, "_blank");
  };

  // 16. Email
  const emailClient = () => {
    if (!client?.email) { toast({ title: "Sem e-mail", variant: "destructive" }); return; }
    window.open(`mailto:${client.email}`, "_blank");
  };

  // 17. Excluir Cliente
  const handleDelete = async () => {
    if (!confirm("Excluir este cliente e todos os dados?")) return;
    await supabase.from("contract_installments").delete().eq("client_id", id!);
    await supabase.from("contracts").delete().eq("client_id", id!);
    await supabase.from("installments").delete().eq("client_id", id!);
    await supabase.from("transactions").delete().eq("client_id", id!);
    await supabase.from("clients").delete().eq("id", id!);
    toast({ title: "Cliente excluído!" }); navigate("/clientes");
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

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
  const scoreColor = (client.credit_score || 0) >= 700 ? "text-success" : (client.credit_score || 0) >= 400 ? "text-warning" : "text-destructive";

  const tabs = [
    { key: "resumo", label: "Resumo", icon: Activity },
    { key: "contratos", label: "Contratos", icon: FileText },
    { key: "parcelas", label: "Parcelas", icon: Receipt },
    { key: "historico", label: "Histórico", icon: Clock },
  ] as const;

  const toolButtons = [
    { icon: Edit, label: "Editar Ficha", action: startEdit, color: "text-primary" },
    { icon: MapPin, label: "Editar Endereço", action: startEditAddress, color: "text-primary" },
    { icon: Plus, label: "Novo Empréstimo", action: () => setNewLoanMode(true), color: "text-success" },
    { icon: CheckCircle, label: "Quitar Todas", action: payAllPending, color: "text-success" },
    { icon: Send, label: "Cobrar Atrasadas", action: sendAllOverdue, color: "text-destructive" },
    { icon: Phone, label: "Ligar", action: callClient, color: "text-primary" },
    { icon: MessageSquare, label: "WhatsApp", action: openWhatsApp, color: "text-success" },
    { icon: Mail, label: "E-mail", action: emailClient, color: "text-primary" },
    { icon: Copy, label: "Copiar Dados", action: copyClientInfo, color: "text-muted-foreground" },
    { icon: Download, label: "Exportar Resumo", action: exportSummary, color: "text-primary" },
    { icon: Printer, label: "Gerar PDF", action: generatePDF, color: "text-primary" },
    { icon: Star, label: "Score +50", action: () => updateScore(50), color: "text-warning" },
    { icon: TrendingUp, label: "Score -50", action: () => updateScore(-50), color: "text-destructive" },
    { icon: Ban, label: client?.status === "Ativo" ? "Inativar" : "Reativar", action: toggleStatus, color: client?.status === "Ativo" ? "text-warning" : "text-success" },
    { icon: Trash2, label: "Excluir", action: handleDelete, color: "text-destructive" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in">
        <button onClick={() => navigate("/clientes")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{client.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{client.cpf_cnpj || "Sem CPF"}</span>
                <Badge variant="outline" className={client.status === "Ativo" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                  {client.status}
                </Badge>
                <span className={`text-xs font-bold ${scoreColor}`}>Score: {client.credit_score || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== MODALS ========== */}

      {/* Edit Client Modal */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar Cliente</h2>
              <button onClick={() => setEditMode(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            {[
              { key: "name", label: "Nome", type: "text" },
              { key: "phone", label: "Telefone", type: "tel" },
              { key: "whatsapp", label: "WhatsApp", type: "tel" },
              { key: "email", label: "E-mail", type: "email" },
              { key: "cpf_cnpj", label: "CPF/CNPJ", type: "text" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type} value={editData[f.key] || ""} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })} className={inputCls} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={saveEdit} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Address Modal */}
      {editAddressMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar Endereço</h2>
              <button onClick={() => setEditAddressMode(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">CEP</label>
                <input type="text" placeholder="00000-000" value={addrData.cep || ""} onChange={e => setAddrData({ ...addrData, cep: e.target.value })} className={inputCls} />
              </div>
              <button onClick={buscarCep} className="self-end px-3 py-2.5 rounded-lg bg-accent border border-border text-foreground hover:bg-accent/70 transition-colors">
                <Search size={16} />
              </button>
            </div>
            {[
              { key: "street", label: "Rua" }, { key: "number", label: "Número" },
              { key: "neighborhood", label: "Bairro" }, { key: "city", label: "Cidade" }, { key: "state", label: "Estado" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type="text" value={addrData[f.key] || ""} onChange={e => setAddrData({ ...addrData, [f.key]: e.target.value })} className={inputCls} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditAddressMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={saveAddress} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* New Loan Modal */}
      {newLoanMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Novo Empréstimo</h2>
              <button onClick={() => setNewLoanMode(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <p className="text-xs text-muted-foreground">Para: <strong className="text-foreground">{client.name}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital (R$)</label>
                <input type="number" value={loanCapital} onChange={e => setLoanCapital(e.target.value)} placeholder="1000" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº Parcelas</label>
                <input type="number" value={loanInstallments} onChange={e => setLoanInstallments(e.target.value)} placeholder="12" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Taxa de Juros (%)</label>
                <input type="number" step="0.1" value={loanInterestRate} onChange={e => setLoanInterestRate(e.target.value)} placeholder="10" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequência</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {freqOpts.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setLoanFreq(o.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                        loanFreq === o.value
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/30"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">1º Vencimento</label>
                <input type="date" value={loanStart} onChange={e => setLoanStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Diária (%)</label>
                <input type="number" step="0.01" value={loanDailyFee} onChange={e => setLoanDailyFee(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Mensal (%)</label>
                <input type="number" step="0.1" value={loanLateFee} onChange={e => setLoanLateFee(e.target.value)} className={inputCls} />
              </div>
            </div>
            {loanCalc && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-[10px] text-muted-foreground">Juros</p><p className="font-semibold text-foreground">R$ {fmt(loanCalc.totalInterest)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Total</p><p className="font-semibold text-foreground">R$ {fmt(loanCalc.total)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Parcela</p><p className="font-semibold text-primary">R$ {fmt(loanCalc.installmentAmount)}</p></div>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setNewLoanMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={handleCreateLoan} disabled={loanLoading || !loanCalc} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
                {loanLoading ? "Criando..." : "Criar Empréstimo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {partialPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Pagamento</h2>
              <button onClick={() => setPartialPayModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Parcela #{partialPayModal.installment_number}</p>
              <p className="text-lg font-bold text-foreground">R$ {fmt(Number(partialPayModal.amount))}</p>
              {partialPayModal.paid_amount > 0 && (
                <p className="text-xs text-success">Já pago: R$ {fmt(Number(partialPayModal.paid_amount))}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor do pagamento (R$)</label>
              <input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder={fmt(Number(partialPayModal.amount))} className={inputCls} autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPartialAmount(String(partialPayModal.amount)); }} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">
                Valor Total
              </button>
              <button onClick={() => { setPartialAmount(String(Number(partialPayModal.amount) / 2)); }} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">
                Metade
              </button>
            </div>
            <button onClick={handlePartialPay} disabled={!partialAmount || parseFloat(partialAmount) <= 0} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              Confirmar Pagamento
            </button>
          </div>
        </div>
      )}

      {/* ========== CONTENT ========== */}

      {/* Contact Info */}
      <div className="bg-card border border-border rounded-2xl p-4 animate-fade-in" style={{ animationDelay: "80ms" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Phone, label: "Telefone", value: client.phone },
            { icon: Mail, label: "E-mail", value: client.email },
            { icon: MessageSquare, label: "WhatsApp", value: client.whatsapp },
            { icon: MapPin, label: "Cidade", value: address?.city ? `${address.city}/${address.state}` : null },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <item.icon size={14} className="text-muted-foreground mt-0.5 shrink-0" />
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
            {address.street}{address.number ? `, ${address.number}` : ""} - {address.neighborhood} · {address.city}/{address.state} · CEP {address.cep}
          </p>
        )}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: "120ms" }}>
        {[
          { icon: DollarSign, label: "Capital na Rua", value: `R$ ${fmt(totalCapital)}`, color: "text-foreground", bg: "bg-primary/10" },
          { icon: CheckCircle, label: "Recebido", value: `R$ ${fmt(totalPaid)}`, color: "text-success", bg: "bg-success/10" },
          { icon: AlertTriangle, label: "Em Atraso", value: `R$ ${fmt(totalOverdue)}`, color: "text-destructive", bg: "bg-destructive/10" },
          { icon: Wallet, label: "Restante", value: `R$ ${fmt(remaining)}`, color: "text-primary", bg: "bg-primary/10" },
        ].map((s, idx) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-3.5 card-hover">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tool Buttons */}
      <div className="animate-fade-in" style={{ animationDelay: "160ms" }}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ferramentas ({toolButtons.length})</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {toolButtons.map((tool, idx) => (
            <button key={idx} onClick={tool.action} className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border border-border bg-card hover:bg-accent/50 transition-all text-center card-hover" title={tool.label}>
              <tool.icon size={16} className={tool.color} />
              <span className="text-[9px] font-medium text-muted-foreground leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 animate-fade-in" style={{ animationDelay: "200ms" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumo */}
      {activeTab === "resumo" && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Activity size={16} className="text-primary" /> Visão Geral</h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><p className="text-2xl font-bold text-foreground">{contracts.length}</p><p className="text-[10px] text-muted-foreground uppercase">Contratos</p></div>
              <div><p className="text-2xl font-bold text-success">{paidInst.length}</p><p className="text-[10px] text-muted-foreground uppercase">Pagas</p></div>
              <div><p className="text-2xl font-bold text-destructive">{overdueInst.length}</p><p className="text-[10px] text-muted-foreground uppercase">Atrasadas</p></div>
              <div><p className="text-2xl font-bold text-foreground">{pendingInst.length}</p><p className="text-[10px] text-muted-foreground uppercase">Pendentes</p></div>
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
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                <p className="text-[10px] text-muted-foreground mt-1">{cPaid}/{c.num_installments} pagas · {pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Contratos */}
      {activeTab === "contratos" && (
        <div className="space-y-3 animate-fade-in">
          <button onClick={() => setNewLoanMode(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
            <Plus size={16} /> Novo Empréstimo
          </button>
          {contracts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum contrato</p>
          ) : contracts.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.capital))}</p>
                  <p className="text-xs text-muted-foreground">{c.num_installments}x R$ {fmt(Number(c.installment_amount))} · {freqOpts.find(f => f.value === c.frequency)?.label || c.frequency}</p>
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
        <div className="space-y-2 animate-fade-in">
          {installments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma parcela</p>
          ) : installments.map((inst: any) => {
            const isOverdue = inst.status === "overdue";
            const isPaid = inst.status === "paid";
            const partiallyPaid = !isPaid && Number(inst.paid_amount || 0) > 0;
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
                    {partiallyPaid && ` · Parcial: R$ ${fmt(Number(inst.paid_amount))}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isPaid ? (
                    <button onClick={() => reversePayment(inst.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Estornar">
                      <RotateCcw size={14} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => sendBilling(inst)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Cobrar">
                        <Send size={14} />
                      </button>
                      <button onClick={() => openPartialPay(inst)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Pgto Parcial">
                        <Percent size={14} />
                      </button>
                      <button onClick={() => payFull(inst.id, Number(inst.amount))} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-success/10 text-success hover:bg-success/20 transition-all">
                        Quitar
                      </button>
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
        <div className="space-y-2 animate-fade-in">
          {transactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma transação</p>
          ) : transactions.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}>
                {t.type === "income" ? <TrendingUp size={14} className="text-success" /> : <DollarSign size={14} className="text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className={`text-sm font-bold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                {t.type === "income" ? "+" : "-"}R$ {fmt(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClienteDetalhe;
