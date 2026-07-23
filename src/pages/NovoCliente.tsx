import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera, Search, ArrowLeft, ArrowRight, User, Phone, Mail, MapPin, Check, Loader2,
  Copy, AlertCircle, Hash, Percent, Calendar, Clock, Repeat, DollarSign, FileText, Printer, Shield,
  Coins, TrendingDown, Target, PauseCircle, Send, MessageCircle, Sparkles, History, Save, RotateCcw, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import ContractTemplate from "@/components/ContractTemplate";
import AISimulatorInsights from "@/components/simulator/AISimulatorInsights";
import LoanPreviewPanel from "@/components/loan/LoanPreviewPanel";
import { calculateLoan, generateInstallmentSchedule, type LoanMode } from "@/lib/loanMath";
import { getSignedUploadUrl } from "@/lib/storage";
import { todayLocalISO, toDateInputValue, formatBR, localNoonISO, parseLocalDate } from "@/lib/dateUtils";
import InvestorAllocationSelect from "@/components/InvestorAllocationSelect";



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

type Frequency = "monthly" | "weekly" | "daily" | "biweekly" | "custom";
type DailyMode = "mon-fri" | "mon-sat" | "mon-sun";


const INPUT = "w-full px-3.5 py-2.5 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-ring transition-all duration-150";

const NovoCliente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const existingClientId = searchParams.get("clientId");
  const isNewContractOnly = !!existingClientId;
  const [step, setStep] = useState(isNewContractOnly ? 2 : 1);
  const [loanSubStep, setLoanSubStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [expressMode, setExpressMode] = useState<boolean>(() => {
    try { return localStorage.getItem("novo_cliente_express") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("novo_cliente_express", expressMode ? "1" : "0"); } catch {}
  }, [expressMode]);
  const [showMoreModes, setShowMoreModes] = useState(false);

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
  const [valueMode, setValueMode] = useState<"rate" | "installment">("installment");
  const [installmentValue, setInstallmentValue] = useState("");
  const [installmentValueDisplay, setInstallmentValueDisplay] = useState("");
  const [startDate, setStartDate] = useState(todayLocalISO());
  const [firstDueDate, setFirstDueDate] = useState("");
  const [autoFirstDue, setAutoFirstDue] = useState(true);
  const [lateFeePercent, setLateFeePercent] = useState("2");
  const [dailyInterestPercent, setDailyInterestPercent] = useState("0.33");
  const [notes, setNotes] = useState("");
  const [gracePeriods, setGracePeriods] = useState("2");

  const [customDates, setCustomDates] = useState<string[]>([]);

  // ── Step 2: Advanced contract fields ──
  const [graceDays, setGraceDays] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cash" | "boleto" | "transfer">("pix");
  const [autoRenew, setAutoRenew] = useState(false);
  const [earlyDiscount, setEarlyDiscount] = useState("0");
  const [maxInterestCap, setMaxInterestCap] = useState("");
  const [guaranteeType, setGuaranteeType] = useState<"none" | "aval" | "vehicle" | "property" | "other">("none");
  const [guaranteeDescription, setGuaranteeDescription] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorCpf, setGuarantorCpf] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const [investorLoanId, setInvestorLoanId] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [requireSignature, setRequireSignature] = useState(false);

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

  // Load existing client when adding a new contract to an existing client (?clientId=…)
  const { data: existingClient } = useQuery({
    queryKey: ["existing-client-for-new-contract", existingClientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("id", existingClientId!).maybeSingle();
      return data;
    },
    enabled: !!existingClientId && !!user,
    staleTime: 60_000,
  });

  // Prefill client fields from existing client (read-only display in step 1, but step is skipped)
  useEffect(() => {
    if (!existingClient) return;
    setNome(existingClient.name || "");
    setEmail(existingClient.email || "");
    setTelefone(existingClient.phone || "");
    setWhatsapp(existingClient.whatsapp || "");
    setCpfCnpj(existingClient.cpf_cnpj || "");
    const a: any = existingClient.address || {};
    if (a) {
      setCep(a.cep || ""); setRua(a.street || ""); setNumero(a.number || "");
      setComplemento(a.complement || ""); setBairro(a.neighborhood || "");
      setCidade(a.city || ""); setEstado(a.state || "");
    }
  }, [existingClient]);

  // Apply defaults from settings when they load (only once, before user touches the form)
  const defaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (!settings || defaultsAppliedRef.current) return;
    if (settings.default_interest_rate) setTaxaJuros(settings.default_interest_rate.toString());
    if (settings.default_late_fee) setLateFeePercent(settings.default_late_fee.toString());
    if (settings.default_daily_interest) setDailyInterestPercent(settings.default_daily_interest.toString());
    if (settings.default_frequency) setFrequency(settings.default_frequency as Frequency);
    defaultsAppliedRef.current = true;
  }, [settings]);

  // ── Draft autosave (localStorage) ──
  const DRAFT_KEY = `novo_cliente_draft_${user?.id || "anon"}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    if (!user || draftLoadedRef.current) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setHasDraft(true);
    } catch {}
    draftLoadedRef.current = true;
  }, [user, DRAFT_KEY]);

  // Autosave draft (debounced)
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      try {
        if (!nome && !capital && !cpfCnpj) return;
        const draft = {
          nome, email, telefone, whatsapp, cpfCnpj, cep, rua, numero, complemento, bairro, cidade, estado,
          capital, capitalDisplay, loanMode, frequency, dailyMode, taxaJuros, numInstallments,
          valueMode, installmentValue, installmentValueDisplay, startDate, firstDueDate, autoFirstDue,
          lateFeePercent, dailyInterestPercent, notes, gracePeriods, graceDays, paymentMethod, step,
          ts: Date.now(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setDraftSavedAt(Date.now());
      } catch {}
    }, 900);
    return () => clearTimeout(t);
  }, [user, DRAFT_KEY, nome, email, telefone, whatsapp, cpfCnpj, cep, rua, numero, complemento,
      bairro, cidade, estado, capital, capitalDisplay, loanMode, frequency, dailyMode, taxaJuros,
      numInstallments, valueMode, installmentValue, installmentValueDisplay, startDate, firstDueDate,
      autoFirstDue, lateFeePercent, dailyInterestPercent, notes, gracePeriods, graceDays, paymentMethod, step]);


  const markTouched = (f: string) => setTouched(prev => ({ ...prev, [f]: true }));

  // ── Past contracts (for "Duplicar termos do anterior") ──
  const { data: pastContracts = [] } = useQuery({
    queryKey: ["novo-emprestimo-past", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, capital, interest_rate, num_installments, frequency, loan_mode, late_fee_percent, daily_interest_percent, created_at, clients(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const duplicateFrom = (c: any) => {
    setCapital(String(c.capital || ""));
    setCapitalDisplay(Number(c.capital || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setTaxaJuros(String(c.interest_rate || ""));
    setNumInstallments(String(c.num_installments || ""));
    if (c.frequency) setFrequency((c.frequency.startsWith("daily") ? "daily" : c.frequency) as Frequency);
    if (c.loan_mode) setLoanMode(c.loan_mode);
    setLateFeePercent(String(c.late_fee_percent ?? 2));
    setDailyInterestPercent(String(c.daily_interest_percent ?? 0.33));
    setValueMode("rate");
    toast({ title: "✓ Termos copiados", description: `Baseado em ${(c.clients as any)?.name || "contrato anterior"}` });
  };

  // ── Draft restore/discard ──
  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setNome(d.nome || ""); setEmail(d.email || ""); setTelefone(d.telefone || ""); setWhatsapp(d.whatsapp || "");
      setCpfCnpj(d.cpfCnpj || ""); setCep(d.cep || ""); setRua(d.rua || ""); setNumero(d.numero || "");
      setComplemento(d.complemento || ""); setBairro(d.bairro || ""); setCidade(d.cidade || ""); setEstado(d.estado || "");
      setCapital(d.capital || ""); setCapitalDisplay(d.capitalDisplay || "");
      if (d.loanMode) setLoanMode(d.loanMode);
      if (d.frequency) setFrequency(d.frequency);
      if (d.dailyMode) setDailyMode(d.dailyMode);
      setTaxaJuros(d.taxaJuros || "10"); setNumInstallments(d.numInstallments || "");
      if (d.valueMode) setValueMode(d.valueMode);
      setInstallmentValue(d.installmentValue || ""); setInstallmentValueDisplay(d.installmentValueDisplay || "");
      if (d.startDate) setStartDate(d.startDate);
      setFirstDueDate(d.firstDueDate || ""); setAutoFirstDue(d.autoFirstDue !== false);
      setLateFeePercent(d.lateFeePercent || "2"); setDailyInterestPercent(d.dailyInterestPercent || "0.33");
      setNotes(d.notes || ""); setGracePeriods(d.gracePeriods || "2"); setGraceDays(d.graceDays || "0");
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.step) setStep(d.step);
      setHasDraft(false);
      toast({ title: "✓ Rascunho restaurado" });
    } catch { toast({ title: "Erro ao restaurar rascunho", variant: "destructive" }); }
  };
  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasDraft(false);
    setDraftSavedAt(null);
  };





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
    const n = parseInt(numInstallments) || 0;
    const taxa = parseFloat(taxaJuros) || 0;
    const parcela = parseFloat(installmentValue) || 0;
    const grace = parseInt(gracePeriods) || 0;
    const r = calculateLoan({
      capital: cap,
      rate: taxa,
      periods: n,
      frequency,
      loanMode,
      valueMode,
      installmentValue: parcela,
      gracePeriods: grace,
    });
    if (!r) return null;
    return {
      totalInterest: r.totalInterest,
      totalAmount: r.totalAmount,
      installmentAmount: r.installmentAmount,
      numParcelas: r.numInstallments,
      schedule: r.schedule,
      ...(r.derivedRate !== undefined ? { derivedRate: r.derivedRate } : {}),
    };
  }, [capital, taxaJuros, numInstallments, loanMode, frequency, valueMode, installmentValue, gracePeriods]);



  const handleCapitalChange = (v: string) => {
    setCapitalDisplay(formatCurrency(v));
    setCapital(parseCurrency(v));
  };

  const generateDueDates = (start: string, freq: Frequency, count: number, dMode: DailyMode, firstDue?: string) => {
    return generateInstallmentSchedule({
      startDate: start,
      firstDueDate: firstDue,
      count,
      frequency: freq,
      dailyMode: dMode,
      customDates: freq === "custom" ? customDates : undefined,
    });
  };


  const periodLabel = frequency === "daily" ? "dia" : frequency === "weekly" ? "semana" : frequency === "biweekly" ? "quinzena" : frequency === "custom" ? "parcela" : "mês";
  const freqLabel = frequency === "daily" ? "Diário" : frequency === "weekly" ? "Semanal" : frequency === "biweekly" ? "Quinzenal" : frequency === "custom" ? "Programado" : "Mensal";

  // ── Loan field validations (modo Taxa e modo Valor da Parcela) ──
  const loanErrors = useMemo(() => {
    const errs: { capital?: string; taxa?: string; parcela?: string; n?: string; geral?: string } = {};
    const cap = parseFloat(capital);
    const n = parseInt(numInstallments);

    if (!capital || isNaN(cap) || cap <= 0) errs.capital = "Informe um capital maior que zero";
    else if (cap > 1_000_000_000) errs.capital = "Capital acima do limite permitido";

    const requiresN = !(loanMode === "percentage" && valueMode === "rate");
    if (requiresN) {
      if (!numInstallments || isNaN(n) || n <= 0) errs.n = "Informe o número de parcelas";
      else if (!Number.isInteger(n)) errs.n = "Use um número inteiro";
      else if (n > 360) errs.n = "Máximo de 360 parcelas";
    } else if (numInstallments && (isNaN(n) || n <= 0 || !Number.isInteger(n) || n > 360)) {
      errs.n = "Valor inválido (1 a 360)";
    }

    if (valueMode === "rate") {
      const taxa = parseFloat(taxaJuros);
      if (!taxaJuros || isNaN(taxa) || taxa <= 0) errs.taxa = "Informe uma taxa maior que zero";
      else if (taxa > 100) errs.taxa = `Taxa muito alta (máx. 100% por ${periodLabel})`;
    } else {
      const parcela = parseFloat(installmentValue);
      if (!installmentValue || isNaN(parcela) || parcela <= 0) {
        errs.parcela = "Informe o valor da parcela";
      } else if (!isNaN(cap) && !isNaN(n) && n > 0) {
        const total = parcela * n;
        if (total < cap) {
          errs.parcela = "Parcela × nº de parcelas é menor que o capital";
        } else if (total === cap) {
          errs.geral = "Sem juros: parcela × nº de parcelas é igual ao capital";
        } else {
          const taxaCalc = ((total - cap) / (cap * n)) * 100;
          if (taxaCalc > 100) errs.parcela = `Taxa derivada inviável (${taxaCalc.toFixed(1)}% por ${periodLabel})`;
        }
      }
    }
    return errs;
  }, [capital, taxaJuros, numInstallments, installmentValue, valueMode, loanMode, periodLabel]);

  const hasLoanErrors = Object.keys(loanErrors).length > 0;

  // ── Step validation ──
  const canGoStep2 = nome.trim().length > 0;
  const canGoStep3 = !!calc && !hasLoanErrors;

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
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canGoStep3) {
        const firstErr = loanErrors.capital || loanErrors.taxa || loanErrors.parcela || loanErrors.n || loanErrors.geral;
        toast({ title: firstErr || "Preencha capital, taxa e parcelas", variant: "destructive" });
        return;
      }
      setStep(3);
      return;
    }
    setStep(step + 1);
  };

  // ── Save all ──
  const handleSave = async () => {
    if (!user || !calc) return;
    if (hasLoanErrors) {
      const firstErr = loanErrors.capital || loanErrors.taxa || loanErrors.parcela || loanErrors.n || loanErrors.geral;
      toast({ title: firstErr || "Corrija os campos do empréstimo", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      const clientId = existingClientId || crypto.randomUUID();
      let avatar_url: string | null = null;

      if (avatarFile && !existingClientId) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user!.id}/client-avatars/${clientId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("uploads").upload(path, avatarFile, { upsert: true });
        if (!uploadError) {
          const signed = await getSignedUploadUrl(path);
          if (signed) avatar_url = signed;
        }
      }

      // 1. Create client (only when not adding to an existing one)
      if (!existingClientId) {
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
      }

      // 2. Create contract
      const n = calc.numParcelas;
      const freqValue = frequency === "daily" ? `daily_${dailyMode}` : frequency;
      const { data: contract, error: contractErr } = await supabase.from("contracts").insert({
        user_id: user.id,
        client_id: clientId,
        capital: parseFloat(capital),
        interest_rate: valueMode === "installment" ? Number((calc as any).derivedRate?.toFixed(4) ?? 0) : parseFloat(taxaJuros),
        num_installments: n,
        installment_amount: calc.installmentAmount,
        frequency: freqValue,
        start_date: localNoonISO(startDate),
        late_fee_percent: parseFloat(lateFeePercent),
        daily_interest_percent: parseFloat(dailyInterestPercent),
        total_amount: calc.totalAmount,
        total_interest: calc.totalInterest,
        status: "active",
        notes: notes || `Modo: ${loanMode}`,
        loan_mode: loanMode,
        grace_periods: loanMode === "grace" ? (parseInt(gracePeriods) || 0) : 0,
        grace_days: parseInt(graceDays) || 0,
        payment_method: paymentMethod,
        auto_renew: autoRenew,
        early_payment_discount_percent: parseFloat(earlyDiscount) || 0,
        max_interest_cap_percent: maxInterestCap ? parseFloat(maxInterestCap) : null,
        guarantee_type: guaranteeType === "none" ? null : guaranteeType,
        guarantee_description: guaranteeDescription || null,
        guarantor_name: guarantorName || null,
        guarantor_cpf: guarantorCpf.replace(/\D/g, "") || null,
        guarantor_phone: guarantorPhone.replace(/\D/g, "") || null,
        attachments: attachments,
        investor_loan_id: investorLoanId,
        signature_status: requireSignature ? "pending" : "not_required",
        signature_token: requireSignature ? crypto.randomUUID() : null,
      } as any).select().single();
      if (contractErr) throw contractErr;

      // 3. Create installments — usa o schedule real (parcelas podem ter valores diferentes)
      let dueDates: string[];
      if (loanMode === "bullet") {
        // Pagamento único N períodos no futuro
        const inputPeriods = parseInt(numInstallments) || 1;
        dueDates = generateInstallmentSchedule({
          startDate, count: 1, frequency: frequency === "custom" ? "monthly" : frequency,
          dailyMode, periodsAhead: inputPeriods,
        });
      } else {
        dueDates = generateDueDates(
          startDate, frequency, calc.numParcelas, dailyMode,
          autoFirstDue ? undefined : (firstDueDate || undefined),
        );
      }
      const installments = dueDates.map((dd, i) => ({
        user_id: user.id,
        contract_id: contract.id,
        client_id: clientId,
        installment_number: i + 1,
        amount: calc.schedule[i] ?? calc.installmentAmount,
        due_date: dd,
        status: "pending",
      }));
      const { error: instErr } = await supabase.from("contract_installments").insert(installments);

      if (instErr) throw instErr;

      setCreatedContractId(contract.id);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setHasDraft(false);
      toast({
        title: existingClientId ? "✓ Novo contrato criado!" : "✓ Cliente e contrato criados!",
        description: `${n} parcelas geradas com sucesso.`,
      });
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
    const effectiveRate = valueMode === "installment" && (calc as any).derivedRate !== undefined
      ? Number((calc as any).derivedRate)
      : parseFloat(taxaJuros);

    // Pré-gera o cronograma p/ exibir no contrato (seção 4)
    const previewInstallments = (() => {
      try {
        const dueDates = generateDueDates(startDate, frequency, calc.numParcelas, dailyMode, firstDueDate || undefined);
        return dueDates.map((dd, i) => ({
          installment_number: i + 1,
          amount: calc.schedule?.[i] ?? calc.installmentAmount,
          due_date: dd,
        }));
      } catch { return []; }
    })();

    const contractData = {
      clientName: nome,
      cpfCnpj,
      phone: telefone,
      whatsapp,
      email,
      address: (rua || cidade) ? `${rua}${numero ? `, ${numero}` : ""}${complemento ? `, ${complemento}` : ""}${bairro ? ` - ${bairro}` : ""}${cidade ? `, ${cidade}` : ""}${estado ? `/${estado}` : ""}${cep ? ` - CEP: ${cep}` : ""}` : "",
      capital: parseFloat(capital),
      interestRate: effectiveRate,
      totalAmount: calc.totalAmount,
      totalInterest: calc.totalInterest,
      installmentAmount: calc.installmentAmount,
      numInstallments: calc.numParcelas,
      frequency: freqLabel,
      startDate,
      lateFeePercent: parseFloat(lateFeePercent),
      dailyInterestPercent: parseFloat(dailyInterestPercent),
      companyName: settings?.company_name || "CREDMAIS APP",
      companyCnpj: settings?.company_cnpj || "",
      companyLogoUrl: settings?.company_logo_url || undefined,
      customTemplate: (settings as any)?.custom_contract_template || null,
      installments: previewInstallments,
    };

    const phoneDigits = (whatsapp || telefone).replace(/\D/g, "");
    const portalUrl = `${window.location.origin}/portal-cliente`;
    const shareMessage =
      `Olá ${nome}, seu contrato foi gerado! 📄\n\n` +
      `• Valor: R$ ${calc.totalAmount.toFixed(2)}\n` +
      `• ${calc.numParcelas}x de R$ ${calc.installmentAmount.toFixed(2)} (${freqLabel})\n` +
      `• Início: ${formatBR(startDate)}\n\n` +
      `Acesse seu portal para ver parcelas e pagar via PIX:\n${portalUrl}\n\n` +
      `Login: CPF + data de nascimento.`;

    const sendWhatsApp = () => {
      if (!phoneDigits) {
        toast({ title: "Sem WhatsApp/telefone", description: "Cadastre um número para enviar.", variant: "destructive" });
        return;
      }
      window.open(`https://wa.me/55${phoneDigits}?text=${encodeURIComponent(shareMessage)}`, "_blank");
    };

    const sendEmail = () => {
      if (!email.trim()) {
        toast({ title: "Sem e-mail", description: "Cadastre um e-mail para enviar.", variant: "destructive" });
        return;
      }
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Contrato — ${settings?.company_name || "CREDMAIS APP"}`)}&body=${encodeURIComponent(shareMessage)}`;
    };

    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Contrato Gerado</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={sendWhatsApp}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              title={phoneDigits ? `Enviar para ${phoneDigits}` : "Sem número cadastrado"}
            >
              <MessageCircle size={16} /> Enviar WhatsApp
            </button>
            <button
              onClick={sendEmail}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-accent transition-colors"
              title={email ? `Enviar para ${email}` : "Sem e-mail cadastrado"}
            >
              <Send size={16} /> E-mail
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-accent transition-colors"
            >
              <Printer size={16} /> Imprimir
            </button>
            <button
              onClick={() => navigate(existingClientId ? `/clientes/${existingClientId}` : "/clientes")}
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
          <button
            onClick={() => {
              if (isNewContractOnly) {
                if (step > 2) setStep(step - 1);
                else navigate(`/clientes/${existingClientId}`);
              } else {
                step > 1 ? setStep(step - 1) : navigate("/clientes");
              }
            }}
            className="p-2.5 rounded-xl hover:bg-card/60 text-muted-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="page-hero-icon">
            <User size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-shimmer">
              {isNewContractOnly ? `Novo Contrato${existingClient?.name ? ` — ${existingClient.name}` : ""}` : "Cadastrar Novo Cliente"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isNewContractOnly
                ? `Etapa ${step - 1} de 2 — ${stepLabels[step - 1]}`
                : `Etapa ${step} de 3 — ${stepLabels[step - 1]}`}
            </p>
          </div>
          {!isNewContractOnly && (
            <button
              type="button"
              onClick={() => setExpressMode(!expressMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${expressMode ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              title="Reduz o formulário aos campos essenciais"
            >
              ⚡ {expressMode ? "Express ON" : "Modo Express"}
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {(isNewContractOnly ? [2, 3] : [1, 2, 3]).map((s) => (
            <button key={s} onClick={() => { if (s < step && (!isNewContractOnly || s >= 2)) setStep(s); }}
              className={`h-2 flex-1 rounded-full transition-colors ${s < step ? "bg-success cursor-pointer" : s === step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
        {step === 2 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["Modo & Frequência", "Valores & Datas", "Extras (opcional)"] as const).map((lbl, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              const active = loanSubStep === n;
              const done = loanSubStep > n;
              return (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => {
                    if (n === loanSubStep) return;
                    if (n > loanSubStep && n >= 3 && !canGoStep3) return;
                    setLoanSubStep(n);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : done
                        ? "bg-success/10 border-success/30 text-success"
                        : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${active ? "bg-primary text-primary-foreground" : done ? "bg-success text-white" : "bg-white/10 text-muted-foreground"}`}>{done ? "✓" : n}</span>
                  {lbl}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Draft restore banner */}
      {hasDraft && !isNewContractOnly && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5 animate-fade-in">
          <div className="flex items-center gap-2 text-sm">
            <Save size={16} className="text-primary" />
            <span className="text-foreground"><strong>Rascunho encontrado</strong> da última vez que você esteve aqui.</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={discardDraft} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
              Descartar
            </button>
            <button onClick={restoreDraft} className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:opacity-90">
              <RotateCcw size={12} /> Restaurar
            </button>
          </div>
        </div>
      )}

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
        <div className="space-y-4 pb-24">
          {loanSubStep === 1 && (<>
          {/* Duplicate from previous */}
          {pastContracts.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/30 backdrop-blur-xl p-5">
              <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl bg-primary/10" />
              <div className="relative flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <History size={14} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-[11px] font-bold text-foreground uppercase tracking-[0.15em]">Duplicar contrato anterior</h2>
                  <p className="text-[10px] text-muted-foreground">Clique para replicar os termos</p>
                </div>
              </div>
              <div className="relative flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {pastContracts.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => duplicateFrom(c)}
                    className="group shrink-0 text-left px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-primary/50 hover:bg-primary/10 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <p className="text-[11px] font-bold text-foreground truncate max-w-[150px] group-hover:text-primary transition-colors">{(c.clients as any)?.name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">R$ {Number(c.capital).toLocaleString("pt-BR")} · {c.num_installments}x · {c.interest_rate}%</p>
                  </button>
                ))}
              </div>
            </div>
          )}



          {/* Loan Mode */}
          <div className="relative overflow-hidden bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <TrendingDown size={14} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Modo do Empréstimo</h2>
                  <p className="text-[10px] text-muted-foreground">Como o cliente irá pagar</p>
                </div>
              </div>
              {!isNewContractOnly && (
                <button
                  type="button"
                  onClick={() => setShowMoreModes(v => !v)}
                  className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors px-2.5 py-1 rounded-lg hover:bg-primary/10"
                >
                  {showMoreModes ? "− Menos" : "+ Mais modos"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(() => {
                const primary = [
                  { v: "installments" as LoanMode, label: "Por Parcelas", desc: "Valor fixo por parcela (ex: 10x de R$ 200)", Icon: Hash },
                  { v: "percentage" as LoanMode, label: "Por Porcentagem", desc: "Paga % até quitar", Icon: Percent },
                ];
                const extra = [
                  { v: "interest_only" as LoanMode, label: "Só Juros + Capital no Fim", desc: "Juros por período, capital no último", Icon: Coins },
                  { v: "price" as LoanMode, label: "Juros Compostos (Price)", desc: "PMT fixo com amortização", Icon: TrendingDown },
                  { v: "bullet" as LoanMode, label: "Pagamento Único", desc: "Tudo numa data futura", Icon: Target },
                  { v: "grace" as LoanMode, label: "Com Carência", desc: "X períodos sem pagar", Icon: PauseCircle },
                ];
                const all = (isNewContractOnly || showMoreModes || extra.some(m => m.v === loanMode)) ? [...primary, ...extra] : primary;
                return all.map(m => {
                  const active = loanMode === m.v;
                  return (
                    <button key={m.v} onClick={() => {
                      setLoanMode(m.v);
                      setValueMode(m.v === "installments" ? "installment" : "rate");
                    }}
                      className={`group relative overflow-hidden flex items-start gap-2.5 p-3.5 rounded-2xl border-2 transition-all duration-200 text-left ${active ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 -translate-y-0.5" : "border-white/10 bg-white/[0.02] hover:border-primary/40 hover:bg-primary/5"}`}>
                      {active && <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />}
                      <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${active ? "bg-primary/25 border border-primary/40" : "bg-muted/40 border border-white/5 group-hover:bg-primary/10"}`}>
                        <m.Icon size={16} className={active ? "text-primary" : "text-muted-foreground group-hover:text-primary"} />
                      </div>
                      <div className="relative min-w-0 pt-0.5">
                        <p className={`text-xs font-bold ${active ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
            {loanMode === "grace" && (
              <div className="pt-3 border-t border-white/10">
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Períodos de Carência</label>
                <input
                  type="number" min={1} max={24}
                  value={gracePeriods}
                  onChange={(e) => setGracePeriods(e.target.value)}
                  className={INPUT}
                  placeholder="2"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Durante a carência o cliente não paga; os juros simples acumulam sobre o capital.
                </p>
              </div>
            )}
            {loanMode === "bullet" && (
              <p className="text-[10px] text-muted-foreground pt-3 border-t border-white/10">
                💡 No modo "Pagamento Único", o campo <strong>Nº de Parcelas</strong> representa períodos até o vencimento.
              </p>
            )}
          </div>


          {/* Frequency */}
          <div className="relative overflow-hidden bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Repeat size={14} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Frequência</h2>
                <p className="text-[10px] text-muted-foreground">Periodicidade das parcelas</p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {([
                { v: "daily" as Frequency, label: "Diário", Icon: Clock },
                { v: "weekly" as Frequency, label: "Semanal", Icon: Repeat },
                { v: "biweekly" as Frequency, label: "Quinzenal", Icon: Repeat },
                { v: "monthly" as Frequency, label: "Mensal", Icon: Calendar },
                { v: "custom" as Frequency, label: "Programado", Icon: Calendar },
              ]).map(f => {
                const active = frequency === f.v;
                return (
                  <button key={f.v} onClick={() => setFrequency(f.v)}
                    className={`group relative overflow-hidden flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all duration-200 ${active ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 -translate-y-0.5" : "border-white/10 bg-white/[0.02] hover:border-primary/40 hover:bg-primary/5"}`}>
                    {active && <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />}
                    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${active ? "bg-primary/25 border border-primary/40" : "bg-muted/40 border border-white/5 group-hover:bg-primary/10"}`}>
                      <f.Icon size={16} className={active ? "text-primary" : "text-muted-foreground group-hover:text-primary"} />
                    </div>
                    <p className={`relative text-xs font-bold ${active ? "text-primary" : "text-foreground"}`}>{f.label}</p>
                  </button>
                );
              })}
            </div>
            {frequency === "daily" && (
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
                {([
                  { v: "mon-fri" as DailyMode, label: "Seg → Sex" },
                  { v: "mon-sat" as DailyMode, label: "Seg → Sáb" },
                  { v: "mon-sun" as DailyMode, label: "Seg → Dom" },
                ]).map(d => {
                  const active = dailyMode === d.v;
                  return (
                    <button key={d.v} onClick={() => setDailyMode(d.v)}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${active ? "border-primary bg-primary/15 text-primary shadow-md shadow-primary/10" : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </>)}

          {loanSubStep === 2 && (<>
          {/* Values — Metallic glow */}
          <div className="relative overflow-hidden bg-card/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl">
            {/* Metallic radial background */}
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] bg-primary/10" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-[100px] bg-blue-500/10" />

            {/* Header */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground tracking-tight font-display">Valores</h2>
                <span className="block text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em]">
                  {loanMode === "installments" && "Capital • Parcela • Prazo"}
                  {loanMode === "percentage" && "Capital • Taxa"}
                  {(loanMode === "interest_only" || loanMode === "price") && "Capital • Taxa • Nº Parcelas"}
                  {loanMode === "bullet" && "Capital • Taxa • Nº Períodos"}
                  {loanMode === "grace" && "Capital • Taxa • Carência • Nº"}
                </span>
              </div>
              {loanMode === "installments" && (
                <div className="inline-flex p-1 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setValueMode("rate")}
                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${valueMode === "rate" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Por Taxa
                  </button>
                  <button
                    type="button"
                    onClick={() => setValueMode("installment")}
                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${valueMode === "installment" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Por Valor da Parcela
                  </button>
                </div>
              )}
            </div>

            <div className="relative z-10 space-y-8">
              {/* Capital em destaque */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground/90 ml-1">
                  Capital Emprestado <span className="text-primary">*</span>
                </label>
                <div className="relative group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    value={capitalDisplay}
                    onChange={(e) => handleCapitalChange(e.target.value)}
                    onBlur={() => markTouched("capital")}
                    placeholder="0,00"
                    className={`w-full bg-white/5 border rounded-2xl py-5 pl-16 pr-6 text-3xl font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all font-display ${touched.capital && loanErrors.capital ? "border-destructive/60" : "border-white/10"}`}
                    inputMode="numeric"
                    aria-invalid={!!(touched.capital && loanErrors.capital)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[500, 1000, 2000, 5000, 10000, 20000].map(v => (
                    <button key={v} type="button" onClick={() => { handleCapitalChange(String(v * 100)); markTouched("capital"); }}
                      className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${capital === String(v) ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20 hover:text-foreground"}`}>
                      R$ {v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                </div>
                {touched.capital && loanErrors.capital && <p className="text-[10px] text-destructive ml-1">{loanErrors.capital}</p>}
              </div>

              {/* Parcela & Numero */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {valueMode === "rate" ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground/90 ml-1">
                      Taxa (% por {periodLabel}) <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <Percent size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="number" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} onBlur={() => markTouched("taxa")} placeholder="10"
                        className={`w-full bg-white/5 border rounded-xl py-4 pl-10 pr-4 text-xl font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${touched.taxa && loanErrors.taxa ? "border-destructive/60" : "border-white/10"}`}
                        aria-invalid={!!(touched.taxa && loanErrors.taxa)} min={0} max={100} step="0.01" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[5, 10, 15, 20, 30].map(v => (
                        <button key={v} type="button" onClick={() => { setTaxaJuros(String(v)); markTouched("taxa"); }}
                          className={`w-10 h-8 flex items-center justify-center rounded-md border text-[10px] font-bold transition-colors ${taxaJuros === String(v) ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-primary/15 hover:text-primary"}`}>
                          {v}%
                        </button>
                      ))}
                    </div>
                    {touched.taxa && loanErrors.taxa && <p className="text-[10px] text-destructive ml-1">{loanErrors.taxa}</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground/90 ml-1">
                      Valor da Parcela (R$) <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">$</span>
                      <input
                        type="text"
                        value={installmentValueDisplay}
                        onChange={(e) => {
                          setInstallmentValueDisplay(formatCurrency(e.target.value));
                          setInstallmentValue(parseCurrency(e.target.value));
                        }}
                        onBlur={() => markTouched("parcela")}
                        placeholder="0,00"
                        className={`w-full bg-white/5 border rounded-xl py-4 pl-10 pr-4 text-xl font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${touched.parcela && loanErrors.parcela ? "border-destructive/60" : "border-white/10"}`}
                        inputMode="numeric"
                        aria-invalid={!!(touched.parcela && loanErrors.parcela)}
                      />
                    </div>
                    {touched.parcela && loanErrors.parcela && <p className="text-[10px] text-destructive ml-1">{loanErrors.parcela}</p>}
                    {(!touched.parcela || !loanErrors.parcela) && calc && (calc as any).derivedRate !== undefined && (
                      <p className="text-[10px] text-muted-foreground ml-1">Taxa equivalente: {(calc as any).derivedRate.toFixed(2)}% por {periodLabel}</p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground/90 ml-1">
                    {loanMode === "bullet"
                      ? <>Nº de Períodos até Vencimento <span className="text-primary">*</span></>
                      : loanMode === "percentage" && valueMode === "rate"
                        ? "Nº Períodos (opcional)"
                        : <>Nº de Parcelas <span className="text-primary">*</span></>}
                  </label>
                  <input type="number" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} onBlur={() => markTouched("n")}
                    placeholder={loanMode === "bullet" ? `Ex: 3 ${periodLabel}s` : loanMode === "percentage" && valueMode === "rate" ? "Auto" : "10"}
                    className={`w-full bg-white/5 border rounded-xl py-4 px-4 text-xl font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${touched.n && loanErrors.n ? "border-destructive/60" : "border-white/10"}`}
                    inputMode="numeric" aria-invalid={!!(touched.n && loanErrors.n)} min={1} max={360} step={1} />
                  <div className="flex flex-wrap gap-1.5">
                    {(loanMode === "bullet" ? [1, 2, 3, 6, 12] : [4, 6, 8, 10, 12, 24]).map(v => (
                      <button key={v} type="button" onClick={() => { setNumInstallments(String(v)); markTouched("n"); }}
                        className={`min-w-10 h-8 px-2 flex items-center justify-center rounded-md border text-[10px] font-bold transition-colors ${numInstallments === String(v) ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-primary/15 hover:text-primary"}`}>
                        {loanMode === "bullet" ? `${v} ${periodLabel}` : `${v}x`}
                      </button>
                    ))}
                  </div>
                  {touched.n && loanErrors.n && <p className="text-[10px] text-destructive ml-1">{loanErrors.n}</p>}
                </div>
              </div>

              {/* Datas */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">Agendamento</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                {frequency === "custom" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-foreground/90 ml-1">Datas de cada parcela</label>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border bg-primary/15 text-primary border-primary/30">
                        📅 Programado — defina cada vencimento
                      </span>
                    </div>
                    {calc && calc.numParcelas > 0 ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-auto pr-1">
                          {Array.from({ length: calc.numParcelas }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-7">#{i + 1}</span>
                              <input
                                type="date"
                                value={customDates[i] || ""}
                                onChange={(e) => {
                                  const next = [...customDates];
                                  next[i] = e.target.value;
                                  setCustomDates(next);
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 [color-scheme:dark]"
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-1 italic">
                          Datas em branco serão preenchidas automaticamente (mensal). A 1ª data define o início do contrato.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground italic ml-1">Defina capital e nº de parcelas para liberar as datas.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground/90 ml-1">Data Início</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all [color-scheme:dark]" />
                    <div className="flex gap-2">
                      {[
                        { label: "Hoje", days: 0 },
                        { label: "+1d", days: 1 },
                        { label: "+7d", days: 7 },
                        { label: "+15d", days: 15 },
                      ].map(o => (
                        <button key={o.label} type="button" onClick={() => {
                          const d = new Date(); d.setDate(d.getDate() + o.days);
                          setStartDate(d.toISOString().split("T")[0]);
                        }} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-foreground/90 ml-1">1º Vencimento</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (autoFirstDue && startDate) {
                            const preview = generateDueDates(startDate, frequency, 1, dailyMode, undefined);
                            if (preview[0]) setFirstDueDate(toDateInputValue(preview[0]));
                          }
                          setAutoFirstDue(!autoFirstDue);
                        }}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 ${autoFirstDue ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20" : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"}`}
                        title="Clique para alternar entre data automática e manual"
                      >
                        {autoFirstDue ? "🔒 Automático — clique para editar" : "✏️ Manual — clique para automatizar"}
                      </button>
                    </div>
                    <input
                      type="date"
                      value={
                        autoFirstDue
                          ? (() => {
                              if (!startDate) return "";
                              const preview = generateDueDates(startDate, frequency, 1, dailyMode, undefined);
                              return preview[0] ? toDateInputValue(preview[0]) : "";
                          })()
                          : firstDueDate
                      }
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      disabled={autoFirstDue}
                      className={`w-full border rounded-xl py-4 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all [color-scheme:dark] ${autoFirstDue ? "bg-white/[0.02] border-white/5 text-muted-foreground cursor-not-allowed" : "bg-white/5 border-white/10"}`}
                    />
                    {!autoFirstDue && (
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: "+7d", days: 7 },
                          { label: "+15d", days: 15 },
                          { label: "+30d", days: 30 },
                          { label: "+45d", days: 45 },
                          { label: "+60d", days: 60 },
                        ].map(o => (
                          <button key={o.label} type="button" onClick={() => {
                            const base = startDate ? new Date(startDate + "T12:00:00") : new Date();
                            base.setDate(base.getDate() + o.days);
                            setFirstDueDate(base.toISOString().split("T")[0]);
                          }} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20">
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {autoFirstDue ? (
                      <p className="text-[10px] text-muted-foreground ml-1 italic">Calculado a partir da data de início ({freqLabel.toLowerCase()}). Clique no botão acima para editar manualmente.</p>
                    ) : (
                      <p className="text-[10px] text-amber-400/80 ml-1 italic">Data personalizada — as próximas parcelas serão calculadas a partir desta.</p>
                    )}
                  </div>

                  </div>
                )}
              </div>
            {/* Multas movidas para "Condições Avançadas" — defaults sensatos (0,33%/dia + 2%/mês) */}

            {/* Opções extras movidas para "Condições Avançadas" abaixo, evitando duplicação */}


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
                    ...(valueMode === "installment" && (calc as any).derivedRate !== undefined
                      ? [{ label: `Taxa equiv./${periodLabel}`, value: `${(calc as any).derivedRate.toFixed(2)}%` }]
                      : []),
                  ].map(i => (
                    <div key={i.label}>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{i.label}</p>
                      <p className="font-bold text-foreground">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Painel completo: amortização + avisos + datas editáveis */}
            {calc && calc.numParcelas > 0 && (
              <LoanPreviewPanel
                input={{
                  capital: parseFloat(capital) || 0,
                  rate: parseFloat(taxaJuros) || 0,
                  periods: parseInt(numInstallments) || 0,
                  frequency,
                  loanMode,
                  valueMode,
                  installmentValue: parseFloat(installmentValue) || 0,
                  gracePeriods: parseInt(gracePeriods) || 0,
                }}
                result={{
                  installmentAmount: calc.installmentAmount,
                  totalAmount: calc.totalAmount,
                  totalInterest: calc.totalInterest,
                  numInstallments: calc.numParcelas,
                  schedule: calc.schedule,
                  perPeriodLabel: periodLabel,
                  derivedRate: (calc as any).derivedRate,
                }}
                dueDates={(() => {
                  if (frequency === "custom") {
                    // Datas do usuário (vazias viram mensais auto)
                    return Array.from({ length: calc.numParcelas }).map((_, i) =>
                      customDates[i]
                        ? parseLocalDate(customDates[i])?.toISOString() ?? ""
                        : generateDueDates(startDate, "monthly", i + 1, dailyMode)[i] ?? ""
                    );
                  }
                  return generateDueDates(
                    startDate, frequency, calc.numParcelas, dailyMode,
                    autoFirstDue ? undefined : firstDueDate || undefined,
                  );
                })()}
                onDueDatesChange={(next) => {
                  // Edição inline marca freq como "custom" e atualiza datas
                  if (frequency !== "custom") setFrequency("custom");
                  setCustomDates(next.map(iso => iso ? toDateInputValue(iso) : ""));
                }}
              />
            )}

            {!calc && capital && taxaJuros && loanMode === "installments" && !numInstallments && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/5 border border-warning/15 text-xs text-warning">
                <AlertCircle size={14} /> Informe o número de parcelas
              </div>
            )}
            </div>
          </div>
          </>)}

          {loanSubStep === 3 && (<>
          {/* ── ADVANCED CONTRACT FIELDS ── */}
          {!expressMode && (
          <details className="bg-card border border-border rounded-2xl p-5 group">
            <summary className="cursor-pointer flex items-center justify-between list-none">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield size={14} className="text-primary" /> Condições Avançadas
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-open:hidden">Abrir</span>
              <span className="text-[10px] uppercase tracking-wider text-primary hidden group-open:inline">Fechar</span>
            </summary>

            <div className="mt-5 space-y-5">
              {/* Carência + Forma pagamento + desconto + teto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Carência (dias)</label>
                  <input type="number" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} placeholder="0" className={INPUT} />
                  <p className="text-[10px] text-muted-foreground mt-1">Dias sem multa após o vencimento</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Forma de Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className={INPUT}>
                    <option value="pix">PIX</option>
                    <option value="cash">Dinheiro</option>
                    <option value="boleto">Boleto</option>
                    <option value="transfer">Transferência</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Desconto Antecipação (%)</label>
                  <input type="number" step="0.1" value={earlyDiscount} onChange={(e) => setEarlyDiscount(e.target.value)} placeholder="0" className={INPUT} />
                  <p className="text-[10px] text-muted-foreground mt-1">% se pagar antes do vencimento</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Teto de Juros (%)</label>
                  <input type="number" step="1" value={maxInterestCap} onChange={(e) => setMaxInterestCap(e.target.value)} placeholder="Sem limite" className={INPUT} />
                  <p className="text-[10px] text-muted-foreground mt-1">Máx. % do capital em juros</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Multa Diária (%)</label>
                  <input type="number" step="0.01" value={dailyInterestPercent} onChange={(e) => setDailyInterestPercent(e.target.value)} placeholder="0.33" className={INPUT} />
                  <p className="text-[10px] text-muted-foreground mt-1">Padrão: 0,33%/dia em atraso</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Multa Mensal (%)</label>
                  <input type="number" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} placeholder="2" className={INPUT} />
                  <p className="text-[10px] text-muted-foreground mt-1">Padrão: 2%/mês de atraso</p>
                </div>
              </div>

              {/* Renovação automática + Assinatura */}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setAutoRenew(!autoRenew)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${autoRenew ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${autoRenew ? "bg-primary" : "bg-muted"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoRenew ? "left-4" : "left-0.5"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Renovação Automática</p>
                    <p className="text-[10px] text-muted-foreground">Cria novo contrato ao quitar</p>
                  </div>
                </button>
                <button type="button" onClick={() => setRequireSignature(!requireSignature)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${requireSignature ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${requireSignature ? "bg-primary" : "bg-muted"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${requireSignature ? "left-4" : "left-0.5"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Assinatura Digital</p>
                    <p className="text-[10px] text-muted-foreground">Gera link para o cliente assinar</p>
                  </div>
                </button>
              </div>

              {/* Alocação de capital (opcional) */}
              <InvestorAllocationSelect value={investorLoanId} onChange={setInvestorLoanId} />


              {/* Garantia / Aval */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Garantia / Aval</h3>
                <div className="grid grid-cols-5 gap-2">
                  {([
                    { v: "none", label: "Nenhuma" },
                    { v: "aval", label: "Avalista" },
                    { v: "vehicle", label: "Veículo" },
                    { v: "property", label: "Imóvel" },
                    { v: "other", label: "Outra" },
                  ] as const).map(g => (
                    <button key={g.v} type="button" onClick={() => setGuaranteeType(g.v)}
                      className={`p-2 rounded-lg border text-[10px] font-semibold transition-colors ${guaranteeType === g.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      {g.label}
                    </button>
                  ))}
                </div>

                {guaranteeType !== "none" && guaranteeType !== "aval" && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Descrição da Garantia</label>
                    <input type="text" value={guaranteeDescription} onChange={(e) => setGuaranteeDescription(e.target.value)}
                      placeholder="Ex: Honda Civic 2020 placa ABC-1234" className={INPUT} />
                  </div>
                )}

                {guaranteeType === "aval" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">Nome do Avalista</label>
                      <input type="text" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">CPF do Avalista</label>
                      <input type="text" value={guarantorCpf} onChange={(e) => setGuarantorCpf(e.target.value)} className={INPUT} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-foreground mb-1.5 block">Telefone do Avalista</label>
                      <input type="text" value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} className={INPUT} />
                    </div>
                  </div>
                )}
              </div>

              {/* Anexos */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Comprovantes Anexos</h3>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  disabled={uploadingAttachment}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length || !user) return;
                    setUploadingAttachment(true);
                    const uploaded: { name: string; url: string; type: string }[] = [];
                    for (const file of files) {
                      const path = `${user.id}/contracts/${Date.now()}-${file.name}`;
                      const { error } = await supabase.storage.from("uploads").upload(path, file);
                      if (!error) {
                        const signed = await getSignedUploadUrl(path);
                        if (signed) uploaded.push({ name: file.name, url: signed, type: file.type });
                      }
                    }
                    setAttachments([...attachments, ...uploaded]);
                    setUploadingAttachment(false);
                    e.target.value = "";
                    toast({ title: `${uploaded.length} arquivo(s) anexado(s)` });
                  }}
                  className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={12} className="text-primary shrink-0" />
                          <span className="text-xs text-foreground truncate">{att.name}</span>
                        </div>
                        <button type="button" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                          className="text-[10px] text-destructive hover:underline">Remover</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>
          )}

          {/* AI Insights */}
          {calc && calc.numParcelas > 0 && parseFloat(capital) > 0 && (
            <AISimulatorInsights
              payload={{
                valor: parseFloat(capital),
                taxa: parseFloat(taxaJuros) || (calc as any).derivedRate || 0,
                parcelas: calc.numParcelas,
                loanMode,
                frequency,
                dailyMode,
                totalReceber: calc.totalAmount,
                jurosTotal: calc.totalInterest,
                valorParcela: calc.installmentAmount,
                numParcelas: calc.numParcelas,
              }}
              onApplyScenario={(s) => {
                setTaxaJuros(String(s.taxa));
                setNumInstallments(String(s.parcelas));
                setValueMode("rate");
                toast({ title: "✓ Cenário aplicado", description: s.name });
              }}
            />
          )}
          </>)}
        </div>
      )}

      {/* Sticky live summary on step 2 */}
      {step === 2 && calc && parseFloat(capital) > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-20 hidden md:block">
          <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-card/95 backdrop-blur border border-border shadow-lg shadow-primary/10">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Parcela</p>
              <p className="text-sm font-bold text-foreground">R$ {fmt(calc.installmentAmount)}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-foreground">R$ {fmt(calc.totalAmount)}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Lucro</p>
              <p className="text-sm font-bold text-success">R$ {fmt(calc.totalInterest)}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Parcelas</p>
              <p className="text-sm font-bold text-primary">{calc.numParcelas}x</p>
            </div>
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

            {/* Contract details — adapt per loan mode */}
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const effectiveFirstDue = (() => {
                  if (!autoFirstDue && firstDueDate) return formatBR(firstDueDate);
                  const dd = generateDueDates(startDate, frequency, 1, dailyMode, undefined);
                  return dd[0] ? formatBR(dd[0]) : "—";
                })();
                const modeLabel: Record<LoanMode, string> = {
                  installments: "Por Parcelas",
                  percentage: "Por Porcentagem",
                  interest_only: "Só Juros + Capital no Fim",
                  price: "Juros Compostos (Price)",
                  bullet: "Pagamento Único",
                  grace: "Com Carência",
                };
                const items: { label: string; value: string }[] = [
                  { label: "Capital", value: `R$ ${fmt(parseFloat(capital))}` },
                  { label: "Modo", value: modeLabel[loanMode] },
                  { label: "Frequência", value: `${freqLabel}${frequency === "daily" ? ` (${dailyMode === "mon-fri" ? "Seg-Sex" : dailyMode === "mon-sat" ? "Seg-Sáb" : "Seg-Dom"})` : ""}` },
                  { label: "Taxa", value: valueMode === "installment" && (calc as any).derivedRate !== undefined ? `${(calc as any).derivedRate.toFixed(2)}% por ${periodLabel} (derivada)` : `${taxaJuros}% por ${periodLabel}` },
                ];
                if (loanMode === "bullet") {
                  items.push({ label: "Períodos até vencimento", value: `${numInstallments || 1} ${periodLabel}(s)` });
                  items.push({ label: "Pagamento Único", value: `R$ ${fmt(calc.totalAmount)}` });
                } else {
                  items.push({ label: "Pagamentos", value: `${calc.numParcelas}x R$ ${fmt(calc.installmentAmount)}` });
                }
                if (loanMode === "grace") {
                  items.push({ label: "Carência", value: `${gracePeriods} ${periodLabel}(s) sem pagar` });
                }
                items.push({ label: "Data de Início", value: formatBR(startDate) });
                items.push({ label: "1º Vencimento", value: effectiveFirstDue });
                items.push({ label: "Total a Receber", value: `R$ ${fmt(calc.totalAmount)}` });
                items.push({ label: "Multa Diária", value: `${dailyInterestPercent}%` });
                return items.map(i => (
                  <div key={i.label} className="bg-muted/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{i.label}</p>
                    <p className="font-semibold text-sm text-foreground mt-0.5">{i.value}</p>
                  </div>
                ));
              })()}
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
        <button
          onClick={() => {
            if (isNewContractOnly) {
              if (step > 2) setStep(step - 1);
              else navigate(`/clientes/${existingClientId}`);
            } else {
              step > 1 ? setStep(step - 1) : navigate("/clientes");
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft size={16} />{" "}
          {isNewContractOnly ? (step > 2 ? "Voltar" : "Cancelar") : step > 1 ? "Voltar" : "Cancelar"}
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
            {saving ? "Criando..." : isNewContractOnly ? "Criar Contrato" : "Criar Cliente e Contrato"}
          </button>
        )}
      </div>
    </div>
  );
};

export default NovoCliente;
