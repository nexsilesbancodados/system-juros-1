import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera, Search, ArrowLeft, ArrowRight, User, Phone, Mail, MapPin, Check, Loader2,
  Copy, AlertCircle, Hash, Percent, Calendar, Clock, Repeat, DollarSign, FileText, Printer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import ContractTemplate from "@/components/ContractTemplate";

// ── Validation ──
const validateCPF = (cpf: string): boolean => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(nums[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(nums[10]);
};

const validateCNPJ = (cnpj: string): boolean => {
  const nums = cnpj.replace(/\D/g, "");
  if (nums.length !== 14 || /^(\d)\1+$/.test(nums)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += parseInt(nums[i]) * w1[i];
  let r = s % 11; r = r < 2 ? 0 : 11 - r;
  if (r !== parseInt(nums[12])) return false;
  s = 0;
  for (let i = 0; i < 13; i++) s += parseInt(nums[i]) * w2[i];
  r = s % 11; r = r < 2 ? 0 : 11 - r;
  return r === parseInt(nums[13]);
};

const validateEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ── Format helpers ──
const formatPhone = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
};

const formatCpfCnpj = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 14);
  if (n.length <= 11) return n.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) => [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : ""));
  return n.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) => a + (b ? `.${b}` : "") + (c ? `.${c}` : "") + (d ? `/${d}` : "") + (e ? `-${e}` : ""));
};

const formatCep = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n.length > 5 ? `${n.slice(0,5)}-${n.slice(5)}` : n;
};

const formatCurrency = (v: string) => {
  const n = v.replace(/\D/g, "");
  if (!n) return "";
  return (parseInt(n) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrency = (v: string) => {
  const n = v.replace(/\D/g, "");
  return n ? (parseInt(n) / 100).toString() : "";
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type LoanMode = "percentage" | "installments";
type Frequency = "monthly" | "weekly" | "daily";
type DailyMode = "mon-fri" | "mon-sat" | "mon-sun";

const INPUT = "w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-ring transition-all duration-150";

const NovoCliente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);

  // ── Step 1: Client data ──
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ── Step 2: Loan ──
  const [capital, setCapital] = useState("");
  const [capitalDisplay, setCapitalDisplay] = useState("");
  const [loanMode, setLoanMode] = useState<LoanMode>("installments");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [dailyMode, setDailyMode] = useState<DailyMode>("mon-fri");
  const [taxaJuros, setTaxaJuros] = useState("10");
  const [numInstallments, setNumInstallments] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [autoFirstDue, setAutoFirstDue] = useState(true);
  const [lateFeePercent, setLateFeePercent] = useState("2");
  const [dailyInterestPercent, setDailyInterestPercent] = useState("0.33");
  const [notes, setNotes] = useState("");

  // ── Settings defaults ──
  const { data: settings } = useQuery({
    queryKey: ["settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Apply defaults from settings on first load
  useState(() => {
    if (settings) {
      if (settings.default_interest_rate) setTaxaJuros(settings.default_interest_rate.toString());
      if (settings.default_late_fee) setLateFeePercent(settings.default_late_fee.toString());
      if (settings.default_daily_interest) setDailyInterestPercent(settings.default_daily_interest.toString());
      if (settings.default_frequency) setFrequency(settings.default_frequency as Frequency);
    }
  });

  const markTouched = (f: string) => setTouched(prev => ({ ...prev, [f]: true }));

  const errors: Record<string, string | null> = {
    nome: touched.nome && !nome.trim() ? "Nome é obrigatório" : null,
    email: touched.email && email.trim() && !validateEmail(email) ? "E-mail inválido" : null,
    cpfCnpj: touched.cpfCnpj && cpfCnpj.trim() ? (() => {
      const nums = cpfCnpj.replace(/\D/g, "");
      if (nums.length === 11 && !validateCPF(cpfCnpj)) return "CPF inválido";
      if (nums.length === 14 && !validateCNPJ(cpfCnpj)) return "CNPJ inválido";
      if (nums.length > 0 && nums.length < 11) return "CPF/CNPJ incompleto";
      return null;
    })() : null,
    telefone: touched.telefone && telefone.trim() && telefone.replace(/\D/g, "").length < 10 ? "Telefone incompleto" : null,
  };

  // ── CEP ──
  const buscarCep = async (value?: string) => {
    const raw = (value || cep).replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
        toast({ title: "✓ CEP encontrado!" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {} finally { setCepLoading(false); }
  };

  const handleCepChange = (v: string) => {
    const formatted = formatCep(v);
    setCep(formatted);
    if (formatted.replace(/\D/g, "").length === 8) buscarCep(formatted);
  };

  const copyPhoneToWhatsapp = useCallback(() => {
    if (telefone.trim()) {
      setWhatsapp(telefone);
      toast({ title: "Telefone copiado para WhatsApp" });
    }
  }, [telefone, toast]);

  // ── Loan calc ──
  const calc = useMemo(() => {
    const cap = parseFloat(capital) || 0;
    const taxa = parseFloat(taxaJuros) || 0;
    const n = parseInt(numInstallments) || 0;
    if (!cap || !taxa) return null;
    if (loanMode === "percentage") {
      if (frequency === "monthly") {
        const juros = cap * (taxa / 100);
        return { totalInterest: juros, totalAmount: cap + juros, installmentAmount: cap + juros, numParcelas: 1 };
      }
      if (n > 0) {
        const juros = cap * (taxa / 100) * n;
        return { totalInterest: juros, totalAmount: cap + juros, installmentAmount: (cap + juros) / n, numParcelas: n };
      }
      const periods = Math.ceil(100 / taxa);
      const payPer = cap * (taxa / 100);
      const total = payPer * periods;
      return { totalInterest: total - cap, totalAmount: total, installmentAmount: payPer, numParcelas: periods };
    }
    if (!n) return null;
    const juros = cap * (taxa / 100) * n;
    return { totalInterest: juros, totalAmount: cap + juros, installmentAmount: (cap + juros) / n, numParcelas: n };
  }, [capital, taxaJuros, numInstallments, loanMode, frequency]);

  const handleCapitalChange = (v: string) => {
    setCapitalDisplay(formatCurrency(v));
    setCapital(parseCurrency(v));
  };

  const generateDueDates = (start: string, freq: Frequency, count: number, dMode: DailyMode, firstDue?: string) => {
    const dates: string[] = [];
    const s = new Date(start + "T12:00:00");
    // If a custom first due date is provided, anchor the first installment to it
    let firstDueDateObj: Date | null = null;
    if (firstDue) {
      firstDueDateObj = new Date(firstDue + "T12:00:00");
    }
    for (let i = 0; i < count; i++) {
      if (firstDueDateObj && i === 0) {
        dates.push(firstDueDateObj.toISOString());
        continue;
      }
      const baseDate = firstDueDateObj || s;
      if (freq === "daily") {
        let added = 0;
        const cur = new Date(firstDueDateObj || s);
        const target = firstDueDateObj ? i : i + 1;
        while (added < target) {
          cur.setDate(cur.getDate() + 1);
          const dow = cur.getDay();
          if (dMode === "mon-fri" && (dow === 0 || dow === 6)) continue;
          if (dMode === "mon-sat" && dow === 0) continue;
          added++;
        }
        dates.push(cur.toISOString());
      } else if (freq === "weekly") {
        const d = new Date(baseDate);
        const offset = firstDueDateObj ? i * 7 : (i + 1) * 7;
        d.setDate(baseDate.getDate() + offset);
        dates.push(d.toISOString());
      } else {
        const d = new Date(baseDate);
        const offset = firstDueDateObj ? i : i + 1;
        d.setMonth(baseDate.getMonth() + offset);
        dates.push(d.toISOString());
      }
    }
    return dates;
  };

  const periodLabel = frequency === "daily" ? "dia" : frequency === "weekly" ? "semana" : "mês";
  const freqLabel = frequency === "daily" ? "Diário" : frequency === "weekly" ? "Semanal" : "Mensal";

  // ── Step validation ──
  const canGoStep2 = nome.trim().length > 0;
  const canGoStep3 = !!calc;

  // ── Step navigation ──
  const goNext = () => {
    if (step === 1) {
      setTouched({ nome: true });
      if (!canGoStep2) {
        toast({ title: "Nome obrigatório", variant: "destructive" });
        return;
      }
      if (email.trim() && !validateEmail(email)) {
        toast({ title: "E-mail inválido", variant: "destructive" });
        return;
      }
    }
    if (step === 2 && !canGoStep3) {
      toast({ title: "Preencha os dados do empréstimo", variant: "destructive" });
      return;
    }
    setStep(step + 1);
  };

  // ── Save all ──
  const handleSave = async () => {
    if (!user || !calc) return;
    setSaving(true);

    try {
      const clientId = crypto.randomUUID();
      let avatar_url: string | null = null;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `client-avatars/${clientId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("uploads").upload(path, avatarFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
          avatar_url = urlData.publicUrl;
        }
      }

      // 1. Create client
      const { error: clientErr } = await supabase.from("clients").insert({
        id: clientId,
        user_id: user.id,
        name: nome.trim(),
        email: email.trim() || null,
        phone: telefone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        cpf_cnpj: cpfCnpj.trim() || null,
        client_type: "loan",
        status: "Ativo",
        avatar_url,
        address: rua ? { cep, street: rua, number: numero, complement: complemento, neighborhood: bairro, city: cidade, state: estado } : null,
      });
      if (clientErr) throw clientErr;

      // 2. Create contract
      const n = calc.numParcelas;
      const freqValue = frequency === "daily" ? `daily_${dailyMode}` : frequency;
      const { data: contract, error: contractErr } = await supabase.from("contracts").insert({
        user_id: user.id,
        client_id: clientId,
        capital: parseFloat(capital),
        interest_rate: parseFloat(taxaJuros),
        num_installments: n,
        installment_amount: calc.installmentAmount,
        frequency: freqValue,
        start_date: new Date(startDate + "T12:00:00").toISOString(),
        late_fee_percent: parseFloat(lateFeePercent),
        daily_interest_percent: parseFloat(dailyInterestPercent),
        total_amount: calc.totalAmount,
        total_interest: calc.totalInterest,
        status: "active",
        notes: notes || (loanMode === "percentage" ? "Modo: Porcentagem" : "Modo: Parcelas"),
      }).select().single();
      if (contractErr) throw contractErr;

      // 3. Create installments
      const dueDates = generateDueDates(startDate, frequency, n, dailyMode);
      const installments = dueDates.map((dd, i) => ({
        user_id: user.id,
        contract_id: contract.id,
        client_id: clientId,
        installment_number: i + 1,
        amount: calc.installmentAmount,
        due_date: dd,
        status: "pending",
      }));
      const { error: instErr } = await supabase.from("contract_installments").insert(installments);
      if (instErr) throw instErr;

      setCreatedContractId(contract.id);
      toast({ title: "✓ Cliente e contrato criados!", description: `${n} parcelas geradas com sucesso.` });
      setShowContract(true);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cpfCnpjLabel = cpfCnpj.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF / CNPJ";
  const stepLabels = ["Dados do Cliente", "Empréstimo", "Revisão"];

  // ── Contract template modal ──
  if (showContract && calc) {
    const contractData = {
      clientName: nome,
      cpfCnpj,
      phone: telefone,
      whatsapp,
      email,
      address: rua ? `${rua}, ${numero}${complemento ? `, ${complemento}` : ""} - ${bairro}, ${cidade}/${estado} - CEP: ${cep}` : "",
      capital: parseFloat(capital),
      interestRate: parseFloat(taxaJuros),
      totalAmount: calc.totalAmount,
      totalInterest: calc.totalInterest,
      installmentAmount: calc.installmentAmount,
      numInstallments: calc.numParcelas,
      frequency: freqLabel,
      startDate,
      lateFeePercent: parseFloat(lateFeePercent),
      dailyInterestPercent: parseFloat(dailyInterestPercent),
      companyName: settings?.company_name || "SYSTEM JUROS",
      companyCnpj: settings?.company_cnpj || "",
    };

    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Contrato Gerado</h1>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-accent transition-colors"
            >
              <Printer size={16} /> Imprimir
            </button>
            <button
              onClick={() => navigate("/clientes")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity"
              style={{ background: "var(--gradient-button)" }}
            >
              <Check size={16} /> Concluir
            </button>
          </div>
        </div>
        <ContractTemplate data={contractData} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate("/clientes")} className="p-2.5 rounded-xl hover:bg-card/60 text-muted-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="page-hero-icon">
            <User size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-shimmer">Cadastrar Novo Cliente</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Etapa {step} de 3 — {stepLabels[step - 1]}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <button key={s} onClick={() => { if (s < step) setStep(s); }}
            className={`h-2 flex-1 rounded-full transition-colors ${s < step ? "bg-success cursor-pointer" : s === step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      {/* ═══ STEP 1: CLIENT DATA ═══ */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Identificação */}
          <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
            </div>
            <div className="flex items-start gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/30 overflow-hidden">
                  {avatarPreview ? <img src={avatarPreview} alt="" className="w-16 h-16 object-cover" /> : <User size={24} />}
                </div>
                <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" style={{ background: "var(--gradient-button)" }}>
                  <Camera size={12} className="text-primary-foreground" />
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
                  }} className="hidden" />
                </label>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Nome Completo *</label>
                  <input type="text" placeholder="Nome do Cliente" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => markTouched("nome")} className={`${INPUT} ${errors.nome ? "border-destructive ring-1 ring-destructive/30" : ""}`} autoFocus />
                  {errors.nome && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.nome}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">{cpfCnpjLabel}</label>
                  <input type="text" placeholder={cpfCnpj.replace(/\D/g, "").length > 11 ? "00.000.000/0000-00" : "000.000.000-00"} value={cpfCnpj} onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))} onBlur={() => markTouched("cpfCnpj")} className={`${INPUT} ${errors.cpfCnpj ? "border-destructive ring-1 ring-destructive/30" : ""}`} inputMode="numeric" />
                  {errors.cpfCnpj && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.cpfCnpj}</p>}
                  {touched.cpfCnpj && cpfCnpj.trim() && !errors.cpfCnpj && cpfCnpj.replace(/\D/g, "").length >= 11 && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1"><Check size={12} /> {cpfCnpj.replace(/\D/g, "").length <= 11 ? "CPF" : "CNPJ"} válido</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Contato */}
          <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                <Phone size={16} className="text-info" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Contato</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">E-mail</label>
                <input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched("email")} className={`${INPUT} ${errors.email ? "border-destructive" : ""}`} />
                {errors.email && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Telefone</label>
                <input type="tel" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} onBlur={() => markTouched("telefone")} className={`${INPUT} ${errors.telefone ? "border-destructive" : ""}`} inputMode="tel" />
                {errors.telefone && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.telefone}</p>}
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">WhatsApp</label>
                  {telefone.trim() && !whatsapp.trim() && (
                    <button type="button" onClick={copyPhoneToWhatsapp} className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium">
                      <Copy size={10} /> Copiar do telefone
                    </button>
                  )}
                </div>
                <input type="tel" placeholder="(00) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} className={INPUT} inputMode="tel" />
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <MapPin size={16} className="text-warning" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Endereço</h2>
              <span className="text-[10px] text-muted-foreground ml-auto">(opcional)</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-foreground mb-1.5 block">CEP</label>
                <input type="text" placeholder="00000-000" value={cep} onChange={(e) => handleCepChange(e.target.value)} className={INPUT} inputMode="numeric" />
              </div>
              <button onClick={() => buscarCep()} disabled={cepLoading} className="self-end px-4 py-2.5 rounded-2xl bg-accent border border-border text-foreground hover:bg-accent/70 transition-all disabled:opacity-50">
                {cepLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
            {rua && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/15 text-xs text-success">
                <Check size={14} /> Endereço preenchido automaticamente
              </div>
            )}
            <div className="grid grid-cols-[1fr_100px] gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Rua</label>
                <input type="text" placeholder="Ex: Rua das Flores" value={rua} onChange={(e) => setRua(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Número</label>
                <input type="text" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} className={INPUT} inputMode="numeric" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Complemento</label>
                <input type="text" placeholder="Apto 45" value={complemento} onChange={(e) => setComplemento(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Bairro</label>
                <input type="text" placeholder="Centro" value={bairro} onChange={(e) => setBairro(e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Cidade</label>
                <input type="text" placeholder="São Paulo" value={cidade} onChange={(e) => setCidade(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${INPUT} appearance-none`}>
                  <option value="">Selecione</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ═══ STEP 2: LOAN CONFIG ═══ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Loan Mode */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Modo do Empréstimo</h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                { v: "installments" as LoanMode, label: "Por Parcelas", desc: "Nº fixo de parcelas", Icon: Hash },
                { v: "percentage" as LoanMode, label: "Por Porcentagem", desc: "Paga % até quitar", Icon: Percent },
              ]).map(m => (
                <button key={m.v} onClick={() => setLoanMode(m.v)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-colors ${loanMode === m.v ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                  <m.Icon size={20} className={loanMode === m.v ? "text-primary" : "text-muted-foreground"} />
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${loanMode === m.v ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Frequência</h2>
            <div className="grid grid-cols-3 gap-3">
              {([
                { v: "monthly" as Frequency, label: "Mensal", Icon: Calendar },
                { v: "weekly" as Frequency, label: "Semanal", Icon: Repeat },
                { v: "daily" as Frequency, label: "Diário", Icon: Clock },
              ]).map(f => (
                <button key={f.v} onClick={() => setFrequency(f.v)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-colors ${frequency === f.v ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                  <f.Icon size={18} className={frequency === f.v ? "text-primary" : "text-muted-foreground"} />
                  <p className={`text-xs font-semibold ${frequency === f.v ? "text-primary" : "text-foreground"}`}>{f.label}</p>
                </button>
              ))}
            </div>
            {frequency === "daily" && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                {([
                  { v: "mon-fri" as DailyMode, label: "Seg→Sex" },
                  { v: "mon-sat" as DailyMode, label: "Seg→Sáb" },
                  { v: "mon-sun" as DailyMode, label: "Seg→Dom" },
                ]).map(d => (
                  <button key={d.v} onClick={() => setDailyMode(d.v)}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-colors ${dailyMode === d.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Values */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Valores</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Capital (R$) *</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={capitalDisplay} onChange={(e) => handleCapitalChange(e.target.value)} placeholder="0,00" className={`${INPUT} pl-8`} inputMode="numeric" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Taxa (% por {periodLabel}) *</label>
                <div className="relative">
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="number" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} placeholder="10" className={`${INPUT} pl-8`} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  {loanMode === "percentage" ? "Nº Períodos (opcional)" : "Nº de Parcelas *"}
                </label>
                <input type="number" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} placeholder={loanMode === "percentage" ? "Auto" : "10"} className={INPUT} inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Data Início</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Multa Diária (%)</label>
                <input type="number" step="0.01" value={dailyInterestPercent} onChange={(e) => setDailyInterestPercent(e.target.value)} placeholder="0.33" className={INPUT} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Multa Mensal (%)</label>
                <input type="number" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} placeholder="2" className={INPUT} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Observações</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" rows={2} className={`${INPUT} resize-none`} />
            </div>

            {calc && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <DollarSign size={14} className="text-primary" /> Resumo
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[
                    { label: "Juros", value: `R$ ${fmt(calc.totalInterest)}` },
                    { label: "Total", value: `R$ ${fmt(calc.totalAmount)}` },
                    { label: `Valor/${periodLabel}`, value: `R$ ${fmt(calc.installmentAmount)}` },
                    { label: "Pagamentos", value: `${calc.numParcelas}x` },
                  ].map(i => (
                    <div key={i.label}>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{i.label}</p>
                      <p className="font-bold text-foreground">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!calc && capital && taxaJuros && loanMode === "installments" && !numInstallments && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/5 border border-warning/15 text-xs text-warning">
                <AlertCircle size={14} /> Informe o número de parcelas
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STEP 3: REVIEW ═══ */}
      {step === 3 && calc && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText size={18} className="text-primary" /> Revisão Final
            </h2>

            {/* Client info */}
            <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {avatarPreview ? <img src={avatarPreview} className="w-12 h-12 rounded-full object-cover" alt="" /> : nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-foreground">{nome}</p>
                <p className="text-xs text-muted-foreground">{cpfCnpj || telefone || "—"}</p>
                {rua && <p className="text-xs text-muted-foreground">{rua}, {numero} - {cidade}/{estado}</p>}
              </div>
            </div>

            {/* Contract details */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Capital", value: `R$ ${fmt(parseFloat(capital))}` },
                { label: "Modo", value: loanMode === "percentage" ? "Porcentagem" : "Parcelas" },
                { label: "Frequência", value: `${freqLabel}${frequency === "daily" ? ` (${dailyMode === "mon-fri" ? "Seg-Sex" : dailyMode === "mon-sat" ? "Seg-Sáb" : "Seg-Dom"})` : ""}` },
                { label: "Taxa", value: `${taxaJuros}% por ${periodLabel}` },
                { label: "Pagamentos", value: `${calc.numParcelas}x R$ ${fmt(calc.installmentAmount)}` },
                { label: "1º Vencimento", value: new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR") },
                { label: "Total a Receber", value: `R$ ${fmt(calc.totalAmount)}` },
                { label: "Multa Diária", value: `${dailyInterestPercent}%` },
              ].map(i => (
                <div key={i.label} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{i.label}</p>
                  <p className="font-semibold text-sm text-foreground mt-0.5">{i.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Lucro Estimado</p>
              <p className="text-xl font-bold text-success">R$ {fmt(calc.totalInterest)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NAV BAR ═══ */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between p-4 rounded-2xl bg-card/95 backdrop-blur border border-border">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate("/clientes")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft size={16} /> {step > 1 ? "Voltar" : "Cancelar"}
        </button>
        {step < 3 ? (
          <button onClick={goNext}
            disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-opacity"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            Próximo <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-opacity"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Criando..." : "Criar Cliente e Contrato"}
          </button>
        )}
      </div>
    </div>
  );
};

export default NovoCliente;
