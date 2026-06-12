import { useState, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import AICreditScore from "@/components/clients/AICreditScore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText, DollarSign,
  CheckCircle, AlertTriangle, Clock, Edit, Trash2, Plus, Send, Copy,
  MessageSquare, Star, Ban, RotateCcw, Download, TrendingUp,
  Calendar, Receipt, Activity, Search, X, Percent, Wallet, Printer, Camera,
  Hash, Coins, TrendingDown, Target, PauseCircle, Wrench, Repeat, PhoneCall, StickyNote,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { formatBR } from "@/lib/dateUtils";
import { useConfirm } from "@/components/ConfirmProvider";
import { calculateLoan, LOAN_MODE_LABEL, type LoanMode } from "@/lib/loanMath";
import { getSignedUploadUrl } from "@/lib/storage";
import ClientToolsPanel, { type ToolGroup } from "@/components/clients/ClientToolsPanel";

const LOAN_MODES: { v: LoanMode; label: string; desc: string; Icon: any }[] = [
  { v: "installments", label: "Por Parcelas", desc: "Parcelas iguais (juros simples)", Icon: Hash },
  { v: "percentage", label: "Por Porcentagem", desc: "Paga % até quitar", Icon: Percent },
  { v: "interest_only", label: "Só Juros + Capital no Fim", desc: "Juros por período, capital na última", Icon: Coins },
  { v: "price", label: "Juros Compostos (Price)", desc: "PMT fixo com amortização", Icon: TrendingDown },
  { v: "bullet", label: "Pagamento Único", desc: "Tudo numa data futura", Icon: Target },
  { v: "grace", label: "Com Carência", desc: "X períodos sem pagar", Icon: PauseCircle },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const FREQ: Record<string, string> = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };
const INPUT = "w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const ClienteDetalhe = () => {
  const confirm = useConfirm();
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
  const [payMethod, setPayMethod] = useState<string>("pix");
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  const [payUploading, setPayUploading] = useState(false);
  const [loanCapital, setLoanCapital] = useState("");
  const [loanInstallments, setLoanInstallments] = useState("");
  const [loanFreq, setLoanFreq] = useState("monthly");
  const [loanStart, setLoanStart] = useState(new Date().toISOString().split("T")[0]);
  const [loanInterestRate, setLoanInterestRate] = useState("10");
  const [loanDailyFee, setLoanDailyFee] = useState("0.33");
  const [loanLateFee, setLoanLateFee] = useState("2");
  const [loanMode, setLoanMode] = useState<LoanMode>("installments");
  const [loanGracePeriods, setLoanGracePeriods] = useState("2");
  const [loanNotes, setLoanNotes] = useState("");
  const [loanLoading, setLoanLoading] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [editContract, setEditContract] = useState<any>(null);
  const [editContractForm, setEditContractForm] = useState<any>({});
  const [editContractRegen, setEditContractRegen] = useState(false);
  const [editContractSaving, setEditContractSaving] = useState(false);
  const [editInst, setEditInst] = useState<any>(null);
  const [editInstForm, setEditInstForm] = useState<{ amount: string; due_date: string }>({ amount: "", due_date: "" });
  const [editInstSaving, setEditInstSaving] = useState(false);

  const inv = useCallback((key: string) => qc.invalidateQueries({ queryKey: [key, id] }), [qc, id]);
  const invAll = useCallback(() => {
    ["client-detail", "client-contracts", "client-installments", "client-transactions", "client-profits"].forEach(k => inv(k));
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
  }, [inv, qc]);

  useMultiTableRealtime(
    ["clients", "contracts", "contract_installments", "transactions", "profits"],
    [
      ["client-detail", id || ""],
      ["client-contracts", id || ""],
      ["client-installments", id || ""],
      ["client-transactions", id || ""],
      ["client-profits", id || ""],
    ],
  );

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

  const groupedInstallments = useMemo(() => {
    const groups: Record<string, any[]> = {};
    installments.forEach((inst: any) => {
      const cid = inst.contract_id || "no-contract";
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(inst);
    });
    return groups;
  }, [installments]);

  const loanCalc = useMemo(() => {
    const cap = parseFloat(loanCapital) || 0;
    const rate = parseFloat(loanInterestRate) || 0;
    const n = parseInt(loanInstallments) || 0;
    const grace = parseInt(loanGracePeriods) || 0;
    if (!cap) return null;
    const r = calculateLoan({
      capital: cap, rate, periods: n,
      frequency: loanFreq as any, loanMode,
      gracePeriods: loanMode === "grace" ? grace : 0,
    });
    if (!r) return null;
    return {
      installmentAmount: r.installmentAmount,
      total: r.totalAmount,
      totalInterest: r.totalInterest,
      schedule: r.schedule,
      numInstallments: r.numInstallments,
    };
  }, [loanCapital, loanInterestRate, loanInstallments, loanFreq, loanMode, loanGracePeriods]);

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

  const generateDueDates = (start: string, freq: string, count: number, periodsAhead?: number) => {
    const dates: string[] = [];
    const [sy, sm, sd] = start.split("-").map(Number);
    const base = new Date(sy, (sm || 1) - 1, sd || 1, 12, 0, 0, 0);
    const stepFor = (i: number) => {
      const nd = new Date(base);
      if (freq === "daily") nd.setDate(base.getDate() + i);
      else if (freq === "weekly") nd.setDate(base.getDate() + i * 7);
      else if (freq === "biweekly") nd.setDate(base.getDate() + i * 14);
      else {
        const tm = base.getMonth() + i;
        const y = base.getFullYear() + Math.floor(tm / 12);
        const m = ((tm % 12) + 12) % 12;
        const lastDay = new Date(y, m + 1, 0).getDate();
        return new Date(y, m, Math.min(base.getDate(), lastDay), 12, 0, 0, 0);
      }
      return nd;
    };
    if (periodsAhead && count === 1) {
      dates.push(stepFor(periodsAhead).toISOString());
      return dates;
    }
    for (let i = 0; i < count; i++) dates.push(stepFor(i + 1).toISOString());
    return dates;
  };

  const handleCreateLoan = async () => {
    if (!user || !loanCalc) return;
    setLoanLoading(true);
    try {
      const nInput = parseInt(loanInstallments) || 0;
      const nReal = loanCalc.numInstallments;
      const periodsAhead = loanMode === "bullet" ? nInput : undefined;
      const { data: contract, error: cErr } = await supabase.from("contracts").insert({
        user_id: user.id, client_id: id!, capital: parseFloat(loanCapital),
        interest_rate: parseFloat(loanInterestRate), num_installments: nReal,
        installment_amount: loanCalc.installmentAmount, frequency: loanFreq,
        start_date: new Date(loanStart + "T12:00:00").toISOString(),
        late_fee_percent: parseFloat(loanLateFee), daily_interest_percent: parseFloat(loanDailyFee),
        total_amount: loanCalc.total, total_interest: loanCalc.totalInterest, status: "active",
        loan_mode: loanMode,
        grace_periods: loanMode === "grace" ? (parseInt(loanGracePeriods) || 0) : 0,
        notes: loanNotes || null,
      }).select().single();
      if (cErr) throw cErr;

      const dueDates = generateDueDates(loanStart, loanFreq, nReal, periodsAhead);
      const { error: iErr } = await supabase.from("contract_installments").insert(
        dueDates.map((dd, i) => ({ user_id: user.id, contract_id: contract.id, client_id: id!, installment_number: i + 1, amount: loanCalc.schedule[i] ?? loanCalc.installmentAmount, due_date: dd, status: "pending" }))
      );
      if (iErr) throw iErr;

      await supabase.from("transactions").insert({
        user_id: user.id, amount: parseFloat(loanCapital), type: "loan",
        description: `Empréstimo para ${client?.name} - ${LOAN_MODE_LABEL[loanMode]} - ${nReal}x R$ ${fmt(loanCalc.installmentAmount)}`,
        client_id: id, contract_id: contract.id,
      });

      toast({ title: "Empréstimo criado!", description: `${nReal} parcela(s) gerada(s).` });
      setNewLoanMode(false); setLoanCapital(""); setLoanInstallments(""); setLoanNotes("");
      invAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setLoanLoading(false); }
  };

  const openEditContract = (c: any) => {
    setEditContract(c);
    setEditContractForm({
      capital: String(c.capital ?? ""),
      interest_rate: String(c.interest_rate ?? ""),
      num_installments: String(c.num_installments ?? ""),
      installment_amount: String(c.installment_amount ?? ""),
      frequency: c.frequency || "monthly",
      start_date: c.start_date ? new Date(c.start_date).toISOString().split("T")[0] : "",
      late_fee_percent: String(c.late_fee_percent ?? "0"),
      daily_interest_percent: String(c.daily_interest_percent ?? "0"),
      notes: c.notes || "",
    });
    setEditContractRegen(false);
  };

  const handleSaveContract = async () => {
    if (!editContract || !user) return;
    setEditContractSaving(true);
    try {
      const f = editContractForm;
      const n = parseInt(f.num_installments);
      const cap = parseFloat(f.capital);
      const rate = parseFloat(f.interest_rate);
      const instAmt = parseFloat(f.installment_amount);
      const totalAmount = instAmt * n;
      const totalInterest = totalAmount - cap;

      const { error } = await supabase.from("contracts").update({
        capital: cap,
        interest_rate: rate,
        num_installments: n,
        installment_amount: instAmt,
        frequency: f.frequency,
        start_date: new Date(f.start_date + "T12:00:00").toISOString(),
        late_fee_percent: parseFloat(f.late_fee_percent),
        daily_interest_percent: parseFloat(f.daily_interest_percent),
        total_amount: totalAmount,
        total_interest: totalInterest,
        notes: f.notes || null,
      }).eq("id", editContract.id);
      if (error) throw error;

      if (editContractRegen) {
        // Apaga apenas parcelas não pagas e regera mantendo as pagas
        const existing = installments.filter((i: any) => i.contract_id === editContract.id);
        const paid = existing.filter((i: any) => i.status === "paid");
        const paidCount = paid.length;
        const remaining = Math.max(0, n - paidCount);

        await supabase.from("contract_installments")
          .delete()
          .eq("contract_id", editContract.id)
          .neq("status", "paid");

        if (remaining > 0) {
          const dueDates = generateDueDates(f.start_date, f.frequency, n).slice(paidCount);
          const newInst = dueDates.map((dd, i) => ({
            user_id: user.id,
            contract_id: editContract.id,
            client_id: id!,
            installment_number: paidCount + i + 1,
            amount: instAmt,
            due_date: dd,
            status: "pending",
          }));
          if (newInst.length) {
            const { error: iErr } = await supabase.from("contract_installments").insert(newInst);
            if (iErr) throw iErr;
          }
        }
      }

      toast({ title: "Contrato atualizado!", description: editContractRegen ? "Parcelas pendentes regeneradas." : undefined });
      setEditContract(null);
      invAll();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setEditContractSaving(false);
    }
  };
  
  const handleDeleteContract = async (contractId: string) => {
    const ok = await confirm({
      title: "Excluir Empréstimo?",
      description: "Isso apagará o contrato, todas as parcelas e movimentações ligadas a ele. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      cancelLabel: "Voltar",
      variant: "destructive"
    });
    if (!ok) return;

    try {
      // Deleta parcelas primeiro (FK)
      await supabase.from("contract_installments").delete().eq("contract_id", contractId);
      // Deleta transações ligadas ao contrato
      await supabase.from("transactions").delete().eq("contract_id", contractId);
      // Deleta o contrato
      const { error } = await supabase.from("contracts").delete().eq("id", contractId);
      
      if (error) throw error;
      
      toast({ title: "Empréstimo excluído com sucesso!" });
      invAll();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const openEditInst = (inst: any) => {
    setEditInst(inst);
    setEditInstForm({
      amount: String(inst.amount ?? ""),
      due_date: inst.due_date ? new Date(inst.due_date).toISOString().split("T")[0] : "",
    });
  };

  const handleSaveInst = async () => {
    if (!editInst) return;
    setEditInstSaving(true);
    try {
      const amt = parseFloat(editInstForm.amount);
      const dd = editInstForm.due_date ? new Date(editInstForm.due_date + "T12:00:00").toISOString() : editInst.due_date;
      if (isNaN(amt) || amt <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("contract_installments").update({ amount: amt, due_date: dd }).eq("id", editInst.id);
      if (error) throw error;
      toast({ title: "Parcela atualizada!" });
      setEditInst(null);
      invAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setEditInstSaving(false);
    }
  };


  const patchInstallment = (instId: string, patch: any) => {
    const key = ["client-installments", id];
    const prev = qc.getQueryData<any[]>(key);
    qc.setQueryData<any[]>(key, (old) =>
      (old || []).map((i: any) => (i.id === instId ? { ...i, ...patch, _optimistic: true } : i))
    );
    return prev;
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
    if (error) {
      toast({ title: "Erro ao enviar comprovante", description: error.message, variant: "destructive" });
      return null;
    }
    return await getSignedUploadUrl(path);
  };

  const payFull = async (instId: string, amount: number, method: string = "pix", receiptUrl: string | null = null) => {
    if (!user) return;
    const patch: any = { status: "paid", paid_at: new Date().toISOString(), paid_amount: amount, payment_method: method };
    if (receiptUrl) patch.receipt_url = receiptUrl;
    const snapshot = patchInstallment(instId, patch);
    toast({ title: "Parcela quitada!" });
    const { error } = await supabase.from("contract_installments").update(patch).eq("id", instId);
    if (error) {
      qc.setQueryData(["client-installments", id], snapshot);
      toast({ title: "Erro ao quitar", description: error.message, variant: "destructive" });
      return;
    }

    const inst = installments.find((i: any) => i.id === instId);
    if (inst) {
      const contract = contracts.find((c: any) => c.id === inst.contract_id);
      if (contract) {
        const rate = Number(contract.interest_rate || 0) / 100;
        const interest = amount * (rate / (1 + rate));
        if (interest > 0) await supabase.from("profits").insert({ user_id: user.id, amount: interest, description: `Juros parcela #${inst.installment_number} - ${client?.name}`, client_id: id });
      }
      await supabase.from("transactions").insert({ user_id: user.id, amount, type: "payment", description: `Pagamento parcela #${inst.installment_number} - ${client?.name} (${method})`, client_id: id, contract_id: inst.contract_id });
      const otherUnpaid = installments.filter((i: any) => i.contract_id === inst.contract_id && i.id !== instId && i.status !== "paid");
      if (otherUnpaid.length === 0) await supabase.from("contracts").update({ status: "completed" }).eq("id", inst.contract_id);
    }
    invAll();
  };

  const handlePartialPay = async () => {
    if (!partialPayModal || !user) return;
    const val = parseFloat(partialAmount);
    if (!val || val <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    setPayUploading(true);
    let receiptUrl: string | null = null;
    if (payReceiptFile) {
      receiptUrl = await uploadReceipt(payReceiptFile);
      if (!receiptUrl) { setPayUploading(false); return; }
    }
    const instAmount = Number(partialPayModal.amount);
    const alreadyPaid = Number(partialPayModal.paid_amount || 0);
    if (val + alreadyPaid >= instAmount) {
      await payFull(partialPayModal.id, instAmount, payMethod, receiptUrl);
    } else {
      const patch: any = { paid_amount: alreadyPaid + val, payment_method: payMethod };
      if (receiptUrl) patch.receipt_url = receiptUrl;
      const snapshot = patchInstallment(partialPayModal.id, patch);
      toast({ title: `R$ ${fmt(val)} registrado!` });
      const { error } = await supabase.from("contract_installments").update(patch).eq("id", partialPayModal.id);
      if (error) {
        qc.setQueryData(["client-installments", id], snapshot);
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        await supabase.from("transactions").insert({ user_id: user.id, amount: val, type: "partial_payment", description: `Pagamento parcial #${partialPayModal.installment_number} - ${client?.name} (${payMethod})`, client_id: id, contract_id: partialPayModal.contract_id });
        invAll();
      }
    }
    setPayUploading(false);
    setPartialPayModal(null);
    setPayReceiptFile(null);
    setPayMethod("pix");
  };

  const reversePayment = async (instId: string) => {
    if (!(await confirm("Estornar pagamento?"))) return;
    const snapshot = patchInstallment(instId, { status: "pending", paid_at: null, paid_amount: null });
    toast({ title: "Estornado!" });
    const { error } = await supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", instId);
    if (error) {
      qc.setQueryData(["client-installments", id], snapshot);
      toast({ title: "Erro ao estornar", description: error.message, variant: "destructive" });
      return;
    }
    invAll();
  };

  const getPhone = () => (client?.whatsapp || client?.phone || "").replace(/\D/g, "");

  const sendBilling = (inst: any) => {
    const phone = getPhone();
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const msg = encodeURIComponent(`Olá ${client?.name}, sua parcela #${inst.installment_number} de R$ ${fmt(Number(inst.amount))} venceu em ${formatBR(inst.due_date)}. Regularize o pagamento.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const sendPortalLink = () => {
    const phone = getPhone();
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const portalUrl = `${window.location.origin}/portal-cliente`;
    const msg = encodeURIComponent(`Olá ${client?.name}, aqui está o link para o seu portal do cliente: ${portalUrl}\n\nLá você pode conferir suas parcelas, gerar PIX para pagamento e ver seu saldo devedor.\n\nBasta logar com seu CPF e data de nascimento.`);
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
    if (!(await confirm(`Quitar ${unpaid.length} parcela(s)?`))) return;
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
        body: installments.map((i: any) => [String(i.installment_number), `R$ ${fmt(Number(i.amount))}`, formatBR(i.due_date), i.status === "paid" ? "Pago" : i.status === "overdue" ? "Atrasada" : "Pendente"]),
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
    const key = ["client-detail", id];
    const prev = qc.getQueryData<any>(key);
    qc.setQueryData(key, (old: any) => (old ? { ...old, status: s } : old));
    toast({ title: `Status: ${s}` });
    const { error } = await supabase.from("clients").update({ status: s }).eq("id", id!);
    if (error) {
      qc.setQueryData(key, prev);
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const updateScore = async (delta: number) => {
    const ns = Math.max(0, Math.min(1000, (client?.credit_score || 100) + delta));
    const key = ["client-detail", id];
    const prev = qc.getQueryData<any>(key);
    qc.setQueryData(key, (old: any) => (old ? { ...old, credit_score: ns } : old));
    toast({ title: `Score: ${ns}` });
    const { error } = await supabase.from("clients").update({ credit_score: ns }).eq("id", id!);
    if (error) {
      qc.setQueryData(key, prev);
      toast({ title: "Erro ao atualizar score", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!(await confirm("Excluir este cliente e todos os dados?"))) return;
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
    { icon: Send, label: "Enviar Portal", action: sendPortalLink },
    { icon: Download, label: "Exportar Resumo", action: exportSummary },
    { icon: Printer, label: "Gerar PDF", action: generatePDF },
    { icon: Star, label: "Score +50", action: () => updateScore(50) },
    { icon: TrendingUp, label: "Score -50", action: () => updateScore(-50) },
    { icon: Ban, label: client.status === "Ativo" ? "Inativar" : "Reativar", action: toggleStatus },
    { icon: Trash2, label: "Excluir", action: handleDelete, destructive: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">
      {/* Premium hero header */}
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex items-center gap-3">
        <button onClick={() => navigate("/clientes")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-lg font-bold text-primary overflow-hidden ring-1 ring-primary/20">
                {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
              </div>
              <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform opacity-0 group-hover:opacity-100" style={{ background: "var(--gradient-button)" }}>
                <Camera size={10} className="text-white" />
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !id) return;
                  const ext = file.name.split(".").pop();
                  const path = `${user!.id}/client-avatars/${id}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
                  if (!upErr) {
                    const signedUrl = await getSignedUploadUrl(path);
                    if (signedUrl) await supabase.from("clients").update({ avatar_url: signedUrl }).eq("id", id);
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
                <AICreditScore clientId={id!} currentScore={client.credit_score || 0} onApplyScore={() => inv("client-detail")} />
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
              <button onClick={saveEdit} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
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
              <button onClick={saveAddress} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Empréstimo</label>
              <div className="grid grid-cols-2 gap-2">
                {LOAN_MODES.map(m => (
                  <button key={m.v} type="button" onClick={() => setLoanMode(m.v)}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border-2 transition-colors text-left ${loanMode === m.v ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                    <m.Icon size={16} className={`mt-0.5 shrink-0 ${loanMode === m.v ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <p className={`text-[11px] font-semibold leading-tight ${loanMode === m.v ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {loanMode === "grace" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Períodos de carência (sem pagar)</label>
                <input type="number" value={loanGracePeriods} onChange={e => setLoanGracePeriods(e.target.value)} placeholder="2" className={INPUT} min={1} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital (R$)</label>
                <input type="number" value={loanCapital} onChange={e => setLoanCapital(e.target.value)} placeholder="1000" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {loanMode === "bullet" ? "Nº Períodos até vencer" : "Nº Parcelas"}
                </label>
                <input type="number" value={loanInstallments} onChange={e => setLoanInstallments(e.target.value)} placeholder={loanMode === "bullet" ? "3" : "12"} className={INPUT} />
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
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                <textarea value={loanNotes} onChange={e => setLoanNotes(e.target.value)} className={INPUT + " min-h-[60px]"} placeholder="Opcional" />
              </div>
            </div>
            {loanCalc && (
              <div className="space-y-2">
                <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-[10px] text-muted-foreground">Juros</p><p className="font-semibold text-foreground">R$ {fmt(loanCalc.totalInterest)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Total</p><p className="font-semibold text-foreground">R$ {fmt(loanCalc.total)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">{loanMode === "bullet" ? "Pagamento" : "Parcela"}</p><p className="font-semibold text-primary">R$ {fmt(loanCalc.installmentAmount)}</p></div>
                </div>
                {loanCalc.schedule.length > 1 && loanCalc.schedule.some(v => v !== loanCalc.schedule[0]) && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 text-[11px] space-y-0.5">
                    {loanCalc.schedule.map((v, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">#{i + 1}</span>
                        <span className="font-medium text-foreground">R$ {fmt(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setNewLoanMode(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={handleCreateLoan} disabled={loanLoading || !loanCalc}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
                {loanLoading ? "Criando..." : "Criar Empréstimo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditContract(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar Empréstimo</h2>
              <button onClick={() => setEditContract(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital (R$)</label>
                <input type="number" step="0.01" value={editContractForm.capital} onChange={e => setEditContractForm({ ...editContractForm, capital: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Taxa (%)</label>
                <input type="number" step="0.1" value={editContractForm.interest_rate} onChange={e => setEditContractForm({ ...editContractForm, interest_rate: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº Parcelas</label>
                <input type="number" value={editContractForm.num_installments} onChange={e => setEditContractForm({ ...editContractForm, num_installments: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor parcela (R$)</label>
                <input type="number" step="0.01" value={editContractForm.installment_amount} onChange={e => setEditContractForm({ ...editContractForm, installment_amount: e.target.value })} className={INPUT} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequência</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(FREQ).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setEditContractForm({ ...editContractForm, frequency: v })}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${editContractForm.frequency === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">1º Vencimento</label>
                <input type="date" value={editContractForm.start_date} onChange={e => setEditContractForm({ ...editContractForm, start_date: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Diária (%)</label>
                <input type="number" step="0.01" value={editContractForm.daily_interest_percent} onChange={e => setEditContractForm({ ...editContractForm, daily_interest_percent: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Mensal (%)</label>
                <input type="number" step="0.1" value={editContractForm.late_fee_percent} onChange={e => setEditContractForm({ ...editContractForm, late_fee_percent: e.target.value })} className={INPUT} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                <textarea value={editContractForm.notes} onChange={e => setEditContractForm({ ...editContractForm, notes: e.target.value })} className={INPUT + " min-h-[60px]"} />
              </div>
            </div>
            <label className="flex items-start gap-2 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer">
              <input type="checkbox" checked={editContractRegen} onChange={e => setEditContractRegen(e.target.checked)} className="mt-0.5" />
              <span className="text-xs text-foreground">
                <strong>Regenerar parcelas pendentes</strong>
                <span className="block text-muted-foreground mt-0.5">Mantém as parcelas já pagas e recria as restantes com os novos valores e datas.</span>
              </span>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditContract(null)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={handleSaveContract} disabled={editContractSaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
                {editContractSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditInst(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar Parcela #{editInst.installment_number}</h2>
              <button onClick={() => setEditInst(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label>
              <input type="number" step="0.01" value={editInstForm.amount} onChange={e => setEditInstForm({ ...editInstForm, amount: e.target.value })} className={INPUT} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Vencimento</label>
              <input type="date" value={editInstForm.due_date} onChange={e => setEditInstForm({ ...editInstForm, due_date: e.target.value })} className={INPUT} />
            </div>
            {editInst.status === "paid" && (
              <p className="text-[11px] text-amber-500">Atenção: esta parcela já está paga. A alteração não estorna o pagamento.</p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditInst(null)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={handleSaveInst} disabled={editInstSaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
                {editInstSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}


      {partialPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { if (!payUploading) { setPartialPayModal(null); setPayReceiptFile(null); setPayMethod("pix"); } }}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Pagamento</h2>
              <button onClick={() => { setPartialPayModal(null); setPayReceiptFile(null); setPayMethod("pix"); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Forma de pagamento</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { v: "pix", l: "PIX" },
                  { v: "dinheiro", l: "Dinheiro" },
                  { v: "transferencia", l: "Transf." },
                  { v: "outro", l: "Outro" },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setPayMethod(opt.v)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${payMethod === opt.v ? "bg-primary/15 border-primary text-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Comprovante (opcional)</label>
              <input type="file" accept="image/*,application/pdf" onChange={e => setPayReceiptFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-muted-foreground file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-card file:text-xs file:font-medium file:text-foreground file:cursor-pointer" />
              {payReceiptFile && <p className="text-[10px] text-muted-foreground mt-1 truncate">📎 {payReceiptFile.name}</p>}
            </div>
            <button onClick={handlePartialPay} disabled={!partialAmount || parseFloat(partialAmount) <= 0 || payUploading}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
              {payUploading ? "Enviando..." : "Confirmar"}
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
          <button onClick={sendPortalLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"><Send size={13} /> Enviar Portal</button>
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
        <button onClick={() => navigate(`/clientes/novo?clientId=${id}`)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
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
          <button onClick={() => navigate(`/clientes/novo?clientId=${id}`)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
            <Plus size={16} /> Novo Empréstimo
          </button>
          {contracts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum contrato</p>
          ) : contracts.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/contratos/${c.id}`)}>
                  <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.capital))}</p>
                  <p className="text-xs text-muted-foreground">{c.num_installments}x R$ {fmt(Number(c.installment_amount))} · {FREQ[c.frequency] || c.frequency}</p>
                </div>
                <div className="text-right cursor-pointer" onClick={() => navigate(`/contratos/${c.id}`)}>
                  <p className="text-xs text-muted-foreground">{formatBR(c.start_date)}</p>
                  <p className="text-xs font-medium text-primary">Lucro: R$ {fmt(Number(c.total_interest))}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditContract(c); }}
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Editar empréstimo"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteContract(c.id); }}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors shrink-0"
                    title="Excluir empréstimo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Parcelas */}
      {activeTab === "parcelas" && (
        <div className="space-y-6">
          {installments.length === 0 ? (
            <EmptyState icon={Receipt} title="Nenhuma parcela" description="As parcelas aparecerão aqui quando o contrato for criado." compact />
          ) : Object.entries(groupedInstallments).map(([cid, insts]) => {
            const contract = contracts.find((c: any) => c.id === cid);
            return (
              <div key={cid} className="space-y-2">
                {contract && (
                  <div className="flex items-center justify-between px-1 mb-1">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <FileText size={12} className="text-primary" />
                      Empréstimo R$ {fmt(Number(contract.capital))} ({formatBR(contract.start_date)})
                    </h3>
                    <Badge variant="outline" className="text-[10px] py-0 h-5">
                      {insts.filter((i: any) => i.status === "paid").length}/{insts.length} pagas
                    </Badge>
                  </div>
                )}
                <div className="space-y-2">
                  {insts.map((inst: any) => {
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
                            {formatBR(inst.due_date)}
                            {inst.paid_at && ` · Pago: ${formatBR(inst.paid_at)}`}
                            {partial && ` · Parcial: R$ ${fmt(Number(inst.paid_amount))}`}
                            {inst.payment_method && ` · ${String(inst.payment_method).toUpperCase()}`}
                          </p>
                          {inst.receipt_url && (
                            <a href={inst.receipt_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                              <Receipt size={10} /> Ver comprovante
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEditInst(inst)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Editar valor/vencimento"><Edit size={14} /></button>
                          {isPaid ? (
                            <button onClick={() => reversePayment(inst.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Estornar"><RotateCcw size={14} /></button>
                          ) : (
                            <>
                              <button onClick={() => sendBilling(inst)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Cobrar"><Send size={14} /></button>
                              <button onClick={() => { setPartialPayModal(inst); setPartialAmount(""); setPayMethod("pix"); setPayReceiptFile(null); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Parcial"><Percent size={14} /></button>
                              <button onClick={() => { setPartialPayModal(inst); setPartialAmount(String(inst.amount)); setPayMethod("pix"); setPayReceiptFile(null); }} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-success/10 text-success hover:bg-success/20 transition-colors">Pagar</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Histórico (timeline unificada) */}
      {activeTab === "historico" && (() => {
        const events: any[] = [];
        // Contratos criados
        contracts.forEach((c: any) => events.push({
          id: `c-${c.id}`, date: c.created_at, type: "contract",
          title: `Contrato criado · R$ ${fmt(Number(c.capital))}`,
          subtitle: `${c.num_installments}x · ${FREQ[c.frequency] || c.frequency}`,
          icon: FileText, color: "text-primary", bg: "bg-primary/10",
        }));
        // Pagamentos (parcelas pagas)
        installments.filter((i: any) => i.status === "paid" && i.paid_at).forEach((i: any) => events.push({
          id: `i-${i.id}`, date: i.paid_at, type: "payment",
          title: `Parcela #${i.installment_number} paga`,
          subtitle: `R$ ${fmt(Number(i.paid_amount || i.amount))}`,
          icon: CheckCircle, color: "text-success", bg: "bg-success/10",
        }));
        // Lucros
        profits.forEach((p: any) => events.push({
          id: `p-${p.id}`, date: p.date, type: "profit",
          title: p.description, subtitle: `+ R$ ${fmt(Number(p.amount))}`,
          icon: TrendingUp, color: "text-success", bg: "bg-success/10",
        }));
        // Transações genéricas restantes
        transactions.filter((t: any) => t.type !== "payment").forEach((t: any) => events.push({
          id: `t-${t.id}`, date: t.date, type: t.type,
          title: t.description, subtitle: `R$ ${fmt(Number(t.amount))}`,
          icon: DollarSign, color: "text-muted-foreground", bg: "bg-muted",
        }));
        const sorted = events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Nenhum evento no histórico</p>
        ) : (
          <div className="relative pl-6 space-y-3">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            {sorted.map(ev => (
              <div key={ev.id} className="relative">
                <div className={`absolute -left-[18px] top-3 w-3 h-3 rounded-full ${ev.bg} border-2 border-background`} />
                <div className="bg-card border border-border rounded-2xl p-3 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${ev.bg} flex items-center justify-center shrink-0`}>
                    <ev.icon size={14} className={ev.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBR(ev.date)} · {new Date(ev.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${ev.color} shrink-0`}>{ev.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default ClienteDetalhe;
