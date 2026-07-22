import { useEffect, useMemo, useState } from "react";
import { formatBR } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CalendarDays, Clock, CreditCard, FileText, Lock, Shield, User, Phone, Mail, TrendingUp, Wallet, AlertTriangle, CheckCircle2, Sparkles, ChevronRight, LogOut, BadgeCheck, HelpCircle, X, MessageCircle, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/ClientPortal/PaymentModal";
import { NegotiationTab } from "@/components/ClientPortal/NegotiationTab";
import { NotificationsBell } from "@/components/ClientPortal/NotificationsBell";
import { computeLateFee } from "@/lib/lateFee";
import { isPortalLoginBlocked, recordPortalLoginAttempt, performFullPortalLogout } from "@/lib/portalSession";
import { isValidCPF, onlyDigits } from "@/lib/cpfCnpj";

type PortalInstallment = {
  id: string;
  installment_number: number;
  amount: number | string;
  due_date: string;
  paid_at?: string | null;
  paid_amount?: number | string | null;
  late_fee?: number | string | null;
  status: string;
  payment_method?: string | null;
  receipt_url?: string | null;
  late_fee_percent?: number | string | null;
  daily_interest_percent?: number | string | null;
};

type PortalContract = {
  id: string;
  capital: number | string;
  interest_rate: number | string;
  num_installments: number;
  installment_amount: number | string;
  frequency: string;
  start_date: string;
  status: string;
  total_amount: number | string;
  total_interest: number | string;
  payment_method?: string | null;
  late_fee_percent?: number | string | null;
  daily_interest_percent?: number | string | null;
  installments: PortalInstallment[];
};

type PortalData = {
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    cpf_cnpj?: string | null;
    status?: string | null;
    birth_date?: string | null;
  };
  contracts: PortalContract[];
  owner?: {
    name?: string | null;
    pix_key?: string | null;
    pix_key_type?: string | null;
  };
  branding?: {
    portal_title?: string | null;
    portal_subtitle?: string | null;
    portal_welcome_message?: string | null;
    portal_primary_color?: string | null;
    portal_contact_phone?: string | null;
    portal_contact_email?: string | null;
    portal_logo_url?: string | null;
    company_name?: string | null;
    company_logo_url?: string | null;
  };
};

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const date = (value: string | null | undefined) => {
  if (!value) return "—";
  return formatBR(value);
};

const statusLabel = (status: string) => {
  if (status === "paid") return "Pago";
  if (status === "active") return "Ativo";
  if (status === "overdue") return "Vencido";
  if (status === "completed") return "Concluído";
  if (status === "cancelled") return "Cancelado";
  return "Pendente";
};

type Tab = "open" | "overdue" | "paid";

const SESSION_KEY = "portal-cliente-session";

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfTouched, setCpfTouched] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("open");
  const [selectedInstallment, setSelectedInstallment] = useState<PortalInstallment | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [helpContact, setHelpContact] = useState<{ company_name?: string | null; portal_contact_phone?: string | null; portal_contact_email?: string | null } | null>(null);
  const [helpContactLoading, setHelpContactLoading] = useState(false);

  // Load creditor contact info when help modal opens (pre-login)
  useEffect(() => {
    if (!helpOpen || portalData) return;
    const clean = onlyDigits(cpf);
    if (clean.length !== 11 || !isValidCPF(clean)) {
      setHelpContact(null);
      return;
    }
    let cancelled = false;
    setHelpContactLoading(true);
    (async () => {
      try {
        const { data } = await (supabase as any).rpc("portal_lookup_creditor_contact", { _cpf: clean });
        if (!cancelled) setHelpContact(data || null);
      } catch {
        if (!cancelled) setHelpContact(null);
      } finally {
        if (!cancelled) setHelpContactLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [helpOpen, cpf, portalData]);

  // Auto re-login from saved CPF on mount + isolamento absoluto do app do credor
  useEffect(() => {
    // Se houver uma sessão do credor no mesmo navegador, deslogar imediatamente.
    // Portal do cliente e app do credor NÃO podem coexistir na mesma sessão.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void supabase.auth.signOut();
    });

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const { cpf: c } = JSON.parse(saved);
      if (c) {
        setCpf(c);
        void doLogin(c, true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Realtime: when any installment of this client changes, refetch
  useEffect(() => {
    if (!portalData?.client?.id) return;
    const clientId = portalData.client.id;
    const ch = supabase
      .channel(`portal-client-${clientId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "contract_installments", filter: `client_id=eq.${clientId}` },
        () => {
          const cleanCpf = (portalData.client.cpf_cnpj || "").replace(/\D/g, "");
          if (cleanCpf) {
            void doLogin(cleanCpf, true);

          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [portalData?.client?.id]);

  // Apply dynamic primary color from branding
  useEffect(() => {
    const color = portalData?.branding?.portal_primary_color;
    if (color) {
      document.documentElement.style.setProperty("--portal-primary", color);
    }
  }, [portalData?.branding?.portal_primary_color]);

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    return nums.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
      [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
    );
  };

  const summary = useMemo(() => {
    const contracts = portalData?.contracts || [];
    const now = new Date();
    const rows = contracts.flatMap((contract) =>
      (contract.installments || []).map((i) => ({ contract, i }))
    );
    const paid = rows.filter(({ i }) => i.status === "paid");
    const open = rows.filter(({ i }) => i.status !== "paid");
    const overdue = open.filter(({ i }) => new Date(i.due_date) < now);

    return {
      activeContracts: contracts.filter((contract) => contract.status === "active").length,
      openAmount: open.reduce((sum, { contract, i }) => {
        const fee = computeLateFee({
          amount: i.amount,
          due_date: i.due_date,
          status: i.status,
          late_fee: i.late_fee,
          late_fee_percent: contract.late_fee_percent,
          daily_interest_percent: contract.daily_interest_percent,
        }, now);
        return sum + Number(i.amount || 0) + fee;
      }, 0),
      paidAmount: paid.reduce((sum, { i }) => sum + Number(i.paid_amount || i.amount || 0), 0),
      overdueCount: overdue.length,
      openCount: open.length,
      paidCount: paid.length,
    };
  }, [portalData]);

  const doLogin = async (cleanCpf: string, silent = false) => {
    if (!silent) {
      const block = isPortalLoginBlocked();
      if (block.blocked) {
        toast({
          title: "Muitas tentativas",
          description: `Aguarde ${Math.ceil(block.waitSec / 60)} min antes de tentar novamente.`,
          variant: "destructive",
        });
        return;
      }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("portal_client_login_cpf" as never, {
        _cpf: cleanCpf,
      } as never);

      if (error) {
        if (!silent) {
          recordPortalLoginAttempt(false);
          toast({ title: "Erro ao acessar o portal", description: "Tente novamente em instantes.", variant: "destructive" });
        }
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      if (!data) {
        if (!silent) {
          recordPortalLoginAttempt(false);
          toast({ title: "Acesso negado", description: "CPF não encontrado.", variant: "destructive" });
        }
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      setPortalData(data as unknown as PortalData);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ cpf: cleanCpf }));
      if (!silent) {
        recordPortalLoginAttempt(true);
        toast({ title: "Acesso autorizado!" });
      }
    } catch (err) {
      if (!silent) {
        recordPortalLoginAttempt(false);
        toast({ title: "Erro no acesso", description: "Não foi possível carregar seus dados.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpfTouched(true);
    const cleanCpf = onlyDigits(cpf);
    if (!cleanCpf) {
      setCpfError("Informe seu CPF para continuar.");
      toast({ title: "CPF obrigatório", description: "Digite seu CPF para acessar o portal.", variant: "destructive" });
      return;
    }
    if (cleanCpf.length !== 11) {
      setCpfError("O CPF deve conter 11 dígitos.");
      toast({ title: "CPF incompleto", description: "Digite os 11 dígitos do CPF.", variant: "destructive" });
      return;
    }
    if (!isValidCPF(cleanCpf)) {
      setCpfError("CPF inválido — verifique os dígitos.");
      toast({ title: "CPF inválido", description: "Os dígitos verificadores não conferem.", variant: "destructive" });
      return;
    }
    setCpfError(null);
    await doLogin(cleanCpf);
  };

  const handleLogout = async () => {
    // Limpa estado local do React primeiro para UI responsiva
    setPortalData(null);
    setCpf("");
    setSelectedInstallment(null);
    setPaymentOpen(false);
    // Limpeza completa: supabase signOut + storage + cookies + caches
    await performFullPortalLogout();
    // Hard reload garante que nenhum estado in-memory (queries, contexts) sobreviva
    window.location.replace("/portal-cliente?logout=1");
  };

  // Flag pós-logout: mostra tela de confirmação em vez do formulário de login
  const [justLoggedOut, setJustLoggedOut] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("logout") === "1";
  });

  const dismissLogoutScreen = () => {
    setJustLoggedOut(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("logout");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } catch {}
  };



  const openPayment = (inst: PortalInstallment) => {
    setSelectedInstallment(inst);
    setPaymentOpen(true);
  };

  const firstName = portalData?.client?.name?.split(" ")?.[0] || "Cliente";
  const branding = portalData?.branding || {};
  const portalTitle = branding.portal_title || "Portal VIP";
  const portalSubtitle = branding.portal_subtitle || "Acesse seus dados financeiros com segurança";
  const logoUrl = branding.portal_logo_url || branding.company_logo_url;

  // Build filtered list of (contract + installment) tuples
  const filtered = useMemo(() => {
    const rows: Array<{ contract: PortalContract; installment: PortalInstallment; isOverdue: boolean }> = [];
    for (const c of portalData?.contracts || []) {
      for (const i of c.installments || []) {
        const isOverdue = i.status !== "paid" && new Date(i.due_date) < new Date();
        if (tab === "paid" && i.status !== "paid") continue;
        if (tab === "open" && i.status === "paid") continue;
        if (tab === "overdue" && !isOverdue) continue;
        rows.push({ contract: c, installment: i, isOverdue });
      }
    }
    return rows.sort((a, b) => +new Date(a.installment.due_date) - +new Date(b.installment.due_date));
  }, [portalData, tab]);

  // Próxima parcela em aberto para destaque no hero
  const nextInstallment = useMemo(() => {
    const now = new Date();
    const pending: Array<{ contract: PortalContract; installment: PortalInstallment; isOverdue: boolean; daysDiff: number }> = [];
    for (const c of portalData?.contracts || []) {
      for (const i of c.installments || []) {
        if (i.status === "paid") continue;
        const due = new Date(i.due_date);
        const daysDiff = Math.floor((+due - +now) / 86400000);
        pending.push({ contract: c, installment: i, isOverdue: due < now, daysDiff });
      }
    }
    pending.sort((a, b) => +new Date(a.installment.due_date) - +new Date(b.installment.due_date));
    return pending[0] || null;
  }, [portalData]);

  const progressPct = useMemo(() => {
    const rows = (portalData?.contracts || []).flatMap((c) => c.installments || []);
    if (!rows.length) return 0;
    return Math.round((rows.filter((i) => i.status === "paid").length / rows.length) * 100);
  }, [portalData]);

  return (
    <main className="portal-shell text-foreground">
      <div className="portal-content mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4 py-10 md:p-8">
        {!portalData ? (
          justLoggedOut ? (
            /* ═══════════ TELA PÓS-LOGOUT ═══════════ */
            <section className="portal-card relative w-full max-w-md p-8 md:p-10">
              <div className="space-y-6 text-center">
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-success/25 to-primary/15 shield-pulse">
                  <BadgeCheck size={44} className="text-success" strokeWidth={2.4} />
                </div>
                <div>
                  <h1 className="font-heading text-3xl font-bold tracking-tight text-white">Sessão encerrada</h1>
                  <p className="mt-3 text-sm text-white/60">
                    Sua sessão foi finalizada com segurança. Todos os dados de acesso deste navegador foram apagados.
                  </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left text-xs text-white/70">
                  <p className="flex items-start gap-2">
                    <Lock className="mt-0.5 shrink-0 text-primary" size={14} />
                    <span>Cookies e credenciais locais foram removidos.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Shield className="mt-0.5 shrink-0 text-primary" size={14} />
                    <span>Para consultar seus contratos novamente, entre com seu CPF.</span>
                  </p>
                </div>
                <button onClick={dismissLogoutScreen} className="portal-btn-primary flex w-full items-center justify-center gap-2 py-4 text-base">
                  <ArrowRight size={18} /> Entrar novamente
                </button>
              </div>
            </section>
          ) : (
            /* ═══════════ TELA DE LOGIN ═══════════ */
            <section className="portal-card w-full max-w-md p-8 md:p-10">
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logotipo" className="h-16 w-16 rounded-2xl object-contain shadow-lg" />
                  ) : (
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/40 to-info/20 shield-pulse">
                      <Shield size={38} className="text-white" strokeWidth={2.2} />
                    </div>
                  )}
                  <span className="portal-chip mt-5">
                    <Sparkles size={11} /> Área exclusiva do cliente
                  </span>
                  <h1 className="font-heading mt-4 text-4xl font-bold tracking-tight text-white">
                    {portalTitle}
                  </h1>
                  <p className="mt-2 text-sm text-white/60">{portalSubtitle}</p>
                </div>

                <form onSubmit={handleAccess} className="space-y-5">
                  <div className="space-y-2">
                    <label className="ml-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                      <User size={11} /> Seu CPF
                    </label>
                    <input
                      value={cpf}
                      onChange={(e) => {
                        const masked = formatCpf(e.target.value);
                        setCpf(masked);
                        const digits = onlyDigits(masked);
                        if (!cpfTouched) return;
                        if (digits.length === 0) setCpfError("Informe seu CPF para continuar.");
                        else if (digits.length < 11) setCpfError("O CPF deve conter 11 dígitos.");
                        else if (!isValidCPF(digits)) setCpfError("CPF inválido — verifique os dígitos.");
                        else setCpfError(null);
                      }}
                      onBlur={() => {
                        setCpfTouched(true);
                        const digits = onlyDigits(cpf);
                        if (digits.length === 0) setCpfError("Informe seu CPF para continuar.");
                        else if (digits.length < 11) setCpfError("O CPF deve conter 11 dígitos.");
                        else if (!isValidCPF(digits)) setCpfError("CPF inválido — verifique os dígitos.");
                        else setCpfError(null);
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text");
                        setCpf(formatCpf(text));
                        setCpfTouched(true);
                      }}
                      placeholder="000.000.000-00"
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={14}
                      aria-invalid={!!cpfError}
                      aria-describedby={cpfError ? "cpf-error" : undefined}
                      className={`portal-input w-full rounded-2xl px-5 py-5 text-center font-mono text-2xl tracking-wider ${cpfError ? "border-red-500/60 focus:border-red-500" : ""}`}
                    />
                    {cpfError && (
                      <p id="cpf-error" className="ml-1 flex items-center gap-1.5 text-xs text-red-400">
                        <AlertTriangle size={12} /> {cpfError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || onlyDigits(cpf).length !== 11 || !isValidCPF(onlyDigits(cpf))}
                    className="portal-btn-primary flex w-full items-center justify-center gap-2 py-5 text-base disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Clock className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                    {loading ? "Verificando..." : "Acessar o portal"}
                  </button>

                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      <HelpCircle size={13} /> Preciso de ajuda para entrar
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { icon: Lock, label: "Criptografado" },
                    { icon: Shield, label: "Acesso seguro" },
                    { icon: BadgeCheck, label: "Sem senha" },
                  ].map(({ icon: I, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-2 py-3 text-center">
                      <I size={14} className="text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{label}</span>
                    </div>
                  ))}
                </div>

                {(branding.portal_contact_phone || branding.portal_contact_email) && (
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-white/50">
                    {branding.portal_contact_phone && (
                      <a href={`tel:${branding.portal_contact_phone}`} className="flex items-center gap-1.5 transition-colors hover:text-primary">
                        <Phone size={12} /> {branding.portal_contact_phone}
                      </a>
                    )}
                    {branding.portal_contact_email && (
                      <a href={`mailto:${branding.portal_contact_email}`} className="flex items-center gap-1.5 transition-colors hover:text-primary">
                        <Mail size={12} /> {branding.portal_contact_email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </section>
          )
        ) : (
          /* ═══════════ ÁREA LOGADA — BENTO GRID ═══════════ */
          <section className="w-full space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logotipo" className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-info/10 border border-white/10">
                    <User className="text-white" size={26} />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Bem-vindo(a)</p>
                  <h2 className="font-heading text-3xl font-bold tracking-tight text-white md:text-4xl">{firstName}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationsBell cpf={onlyDigits(portalData.client.cpf_cnpj || cpf)} />
                <button onClick={handleLogout} className="portal-chip warn hover:brightness-125">
                  <LogOut size={12} /> Sair com segurança
                </button>
              </div>
            </header>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[minmax(120px,auto)]">
              {/* Hero — próxima parcela */}
              <div className="bento-tile bento-hero md:col-span-4 md:row-span-2 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      {nextInstallment?.isOverdue ? "Parcela em atraso" : nextInstallment ? "Próxima parcela" : "Tudo em dia"}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      {nextInstallment
                        ? nextInstallment.isOverdue
                          ? `Vencida há ${Math.abs(nextInstallment.daysDiff)} dia(s)`
                          : nextInstallment.daysDiff === 0
                            ? "Vence hoje"
                            : `Vence em ${nextInstallment.daysDiff} dia(s) — ${date(nextInstallment.installment.due_date)}`
                        : "Você não possui parcelas em aberto."}
                    </p>
                  </div>
                  <span className={`portal-chip ${nextInstallment?.isOverdue ? "warn" : "ok"}`}>
                    {nextInstallment?.isOverdue ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                    {nextInstallment ? `#${nextInstallment.installment.installment_number}` : "OK"}
                  </span>
                </div>

                {nextInstallment ? (() => {
                  const fee = computeLateFee({
                    amount: nextInstallment.installment.amount,
                    due_date: nextInstallment.installment.due_date,
                    status: nextInstallment.installment.status,
                    late_fee: nextInstallment.installment.late_fee,
                    late_fee_percent: nextInstallment.contract.late_fee_percent,
                    daily_interest_percent: nextInstallment.contract.daily_interest_percent,
                  });
                  const total = Number(nextInstallment.installment.amount) + fee;
                  return (
                    <div className="mt-6 space-y-4">
                      <div>
                        <p className="kpi-value text-5xl font-black tracking-tight text-white md:text-6xl">{money(total)}</p>
                        {fee > 0 && (
                          <p className="mt-1 text-xs text-warning-foreground/90">
                            <AlertTriangle className="inline" size={11} /> Inclui {money(fee)} de multa/juros
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => openPayment({
                          ...nextInstallment.installment,
                          late_fee_percent: nextInstallment.contract.late_fee_percent,
                          daily_interest_percent: nextInstallment.contract.daily_interest_percent,
                        } as PortalInstallment)}
                        className="portal-btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
                      >
                        <CreditCard size={16} /> Pagar agora <ChevronRight size={16} />
                      </button>
                    </div>
                  );
                })() : (
                  <div className="mt-6 flex items-center gap-3">
                    <CheckCircle2 size={40} className="text-success" />
                    <p className="text-lg text-white/80">Nenhum pagamento pendente 🎉</p>
                  </div>
                )}
              </div>

              {/* Tile: contratos ativos */}
              <div className="bento-tile md:col-span-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="portal-chip"><FileText size={11} /> Contratos</span>
                  <TrendingUp size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50">Ativos</p>
                  <p className="kpi-value mt-1 text-4xl font-black text-white">{summary.activeContracts}</p>
                </div>
              </div>

              {/* Tile: saldo em aberto */}
              <div className="bento-tile md:col-span-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="portal-chip"><Wallet size={11} /> Saldo</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50">Em aberto</p>
                  <p className="kpi-value mt-1 text-3xl font-black text-white">{money(summary.openAmount)}</p>
                </div>
              </div>

              {/* Tile: progresso */}
              <div className="bento-tile md:col-span-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="portal-chip ok"><CheckCircle2 size={11} /> Quitação</span>
                  <p className="text-2xl font-bold text-white">{progressPct}%</p>
                </div>
                <div className="mt-3">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-info to-success transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                    <span>{summary.paidCount} pagas</span>
                    <span>{summary.openCount} restantes</span>
                  </div>
                </div>
              </div>

              {/* Tile: total pago */}
              <div className="bento-tile md:col-span-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="portal-chip ok"><CheckCircle2 size={11} /> Pago</span>
                  {summary.overdueCount > 0 && (
                    <span className="portal-chip warn">
                      <AlertTriangle size={11} /> {summary.overdueCount} vencida(s)
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/50">Total quitado</p>
                  <p className="kpi-value mt-1 text-3xl font-black text-success">{money(summary.paidAmount)}</p>
                </div>
              </div>
            </div>

            {/* Filtro de parcelas */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "open" as Tab, label: "Em aberto", count: summary.openCount, icon: Clock },
                { key: "overdue" as Tab, label: "Atrasadas", count: summary.overdueCount, icon: AlertTriangle },
                { key: "paid" as Tab, label: "Pagas", count: summary.paidCount, icon: CheckCircle2 },
              ].map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      active
                        ? "bg-gradient-to-r from-primary to-info text-white shadow-lg shadow-primary/30"
                        : "border border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <t.icon size={14} />
                    {t.label}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/20" : "bg-white/10"}`}>{t.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Lista de parcelas */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="bento-tile flex flex-col items-center gap-3 p-10 text-center text-white/60">
                  <CheckCircle2 size={40} className="text-success" />
                  {tab === "paid" ? "Nenhum pagamento registrado ainda." : tab === "overdue" ? "Nenhuma parcela atrasada 🎉" : "Nenhuma parcela em aberto 🎉"}
                </div>
              ) : (
                filtered.map(({ contract, installment, isOverdue }) => {
                  const fee = computeLateFee({
                    amount: installment.amount,
                    due_date: installment.due_date,
                    status: installment.status,
                    late_fee: installment.late_fee,
                    late_fee_percent: contract.late_fee_percent,
                    daily_interest_percent: contract.daily_interest_percent,
                  });
                  const total = installment.status === "paid"
                    ? Number(installment.paid_amount || installment.amount) + Number(installment.late_fee || 0)
                    : Number(installment.amount) + fee;
                  return (
                    <button
                      key={installment.id}
                      onClick={() => openPayment({
                        ...installment,
                        late_fee_percent: contract.late_fee_percent,
                        daily_interest_percent: contract.daily_interest_percent,
                      } as PortalInstallment)}
                      className="bento-tile group flex w-full items-center gap-4 text-left"
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                        installment.status === "paid"
                          ? "bg-success/15 text-success"
                          : isOverdue
                            ? "bg-warning/15 text-warning"
                            : "bg-primary/15 text-primary"
                      }`}>
                        #{installment.installment_number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            Contrato {contract.id.slice(0, 8).toUpperCase()}
                          </p>
                          <span className="portal-chip">
                            {contract.frequency === "monthly" ? "Mensal" : contract.frequency === "weekly" ? "Semanal" : contract.frequency === "daily" ? "Diário" : contract.frequency}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                          <CalendarDays size={12} />
                          {installment.status === "paid" ? `Pago em ${date(installment.paid_at)}` : `Vence em ${date(installment.due_date)}`}
                          {isOverdue && (
                            <span className="ml-1 font-semibold text-warning">
                              · {Math.floor((Date.now() - +new Date(installment.due_date)) / 86400000)} dia(s)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-white">{money(total)}</p>
                        {fee > 0 && installment.status !== "paid" && (
                          <p className="text-[10px] text-warning">+ {money(fee)} multa/juros</p>
                        )}
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                          installment.status === "paid" ? "text-success" : isOverdue ? "text-warning" : "text-primary"
                        }`}>
                          {installment.status === "paid" ? "Pago" : isOverdue ? "Vencido" : "Em aberto"}
                        </span>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </button>
                  );
                })
              )}
            </div>

            {/* Contratos overview */}
            <div className="space-y-3 pt-4">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                <FileText size={12} /> Seus contratos
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {portalData.contracts.map((contract) => (
                  <article key={contract.id} className="bento-tile">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-sm font-bold text-white">{contract.id.slice(0, 8).toUpperCase()}</p>
                      <span className={`portal-chip ${contract.status === "completed" ? "ok" : contract.status === "cancelled" ? "warn" : ""}`}>
                        {statusLabel(contract.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-white/40">Capital</p>
                        <p className="mt-0.5 font-bold text-white">{money(contract.capital)}</p>
                      </div>
                      <div>
                        <p className="text-white/40">Parcela</p>
                        <p className="mt-0.5 font-bold text-white">{money(contract.installment_amount)}</p>
                      </div>
                      <div>
                        <p className="text-white/40">Juros</p>
                        <p className="mt-0.5 font-bold text-white">{Number(contract.interest_rate || 0)}%</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-white/40">
                      Início {date(contract.start_date)} • {contract.num_installments} parcelas
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {portalData.client.cpf_cnpj && (
              <div className="space-y-3 pt-4">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                  <Sparkles size={12} /> Assistente de negociação
                </h2>
                <div className="bento-tile p-0 overflow-hidden">
                  <NegotiationTab clientId={portalData.client.id} cpf={portalData.client.cpf_cnpj} />
                </div>
              </div>
            )}

            {(branding.portal_contact_phone || branding.portal_contact_email) && (
              <div className="bento-tile flex flex-wrap items-center justify-center gap-4 text-sm">
                <span className="text-white/60">Precisa de ajuda?</span>
                {branding.portal_contact_phone && (
                  <a href={`tel:${branding.portal_contact_phone}`} className="flex items-center gap-1.5 font-semibold text-primary hover:underline">
                    <Phone size={14} /> {branding.portal_contact_phone}
                  </a>
                )}
                {branding.portal_contact_email && (
                  <a href={`mailto:${branding.portal_contact_email}`} className="flex items-center gap-1.5 font-semibold text-primary hover:underline">
                    <Mail size={14} /> {branding.portal_contact_email}
                  </a>
                )}
              </div>
            )}
          </section>
        )}
      </div>


      <PaymentModal
        isOpen={paymentOpen}
        onOpenChange={setPaymentOpen}
        installment={selectedInstallment}
        ownerProfile={portalData?.owner || {}}
        clientData={portalData?.client || {}}
        contactPhone={portalData?.branding?.portal_contact_phone || portalData?.client?.whatsapp || portalData?.client?.phone || null}
      />

      {/* ═══════════ MODAL DE AJUDA ═══════════ */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
          <div
            className="portal-card relative w-full max-w-md overflow-hidden rounded-3xl p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-info/10 border border-white/10">
                <HelpCircle className="text-primary" size={22} />
              </div>
              <div>
                <h3 id="help-title" className="font-heading text-xl font-bold text-white">Precisa de ajuda?</h3>
                <p className="text-xs text-white/60">Vamos te ajudar a acessar seu portal</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  <RefreshCw size={11} /> Como entrar novamente
                </p>
                <ol className="ml-4 list-decimal space-y-1.5 text-sm text-white/75">
                  <li>Digite seu <strong className="text-white">CPF completo</strong> (11 dígitos).</li>
                  <li>Use o mesmo CPF cadastrado com o credor.</li>
                  <li>Se receber "CPF não encontrado", confirme os dados com o credor.</li>
                  <li>Após muitas tentativas, aguarde alguns minutos e tente de novo.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  <MessageCircle size={11} /> Fale com o credor
                </p>
                {(() => {
                  const contact = {
                    phone: branding?.portal_contact_phone || helpContact?.portal_contact_phone || null,
                    email: branding?.portal_contact_email || helpContact?.portal_contact_email || null,
                    name: branding?.company_name || helpContact?.company_name || null,
                  };
                  if (helpContactLoading && !contact.phone && !contact.email) {
                    return (
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <RefreshCw size={14} className="animate-spin" /> Buscando dados de contato…
                      </div>
                    );
                  }
                  if (contact.phone || contact.email) {
                    return (
                      <div className="space-y-2">
                        {contact.name && (
                          <p className="mb-1 text-xs text-white/60">
                            Credor: <strong className="text-white">{contact.name}</strong>
                          </p>
                        )}
                        {contact.phone && (
                          <>
                            <a
                              href={`https://wa.me/${onlyDigits(contact.phone)}?text=${encodeURIComponent("Olá! Preciso de ajuda para acessar o portal do cliente.")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-white transition-colors hover:bg-emerald-500/10"
                            >
                              <span className="flex items-center gap-2">
                                <MessageCircle size={15} className="text-emerald-400" /> WhatsApp
                              </span>
                              <span className="font-mono text-xs text-white/70">{contact.phone}</span>
                            </a>
                            <a
                              href={`tel:${contact.phone}`}
                              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-white transition-colors hover:bg-white/5"
                            >
                              <span className="flex items-center gap-2">
                                <Phone size={15} className="text-primary" /> Telefone
                              </span>
                              <span className="font-mono text-xs text-white/70">{contact.phone}</span>
                            </a>
                          </>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}?subject=${encodeURIComponent("Ajuda com acesso ao portal")}`}
                            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-white transition-colors hover:bg-white/5"
                          >
                            <span className="flex items-center gap-2">
                              <Mail size={15} className="text-primary" /> E-mail
                            </span>
                            <span className="text-xs text-white/70">{contact.email}</span>
                          </a>
                        )}
                      </div>
                    );
                  }
                  const cpfClean = onlyDigits(cpf);
                  const cpfReady = cpfClean.length === 11 && isValidCPF(cpfClean);
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                        <p className="text-sm text-white/80">
                          {portalData
                            ? "O credor ainda não cadastrou canais de contato públicos."
                            : cpfReady
                              ? "Não localizamos os canais de contato do credor deste CPF."
                              : "Digite um CPF válido no campo de acesso para buscarmos automaticamente o contato do credor."}
                        </p>
                      </div>
                      <p className="text-xs text-white/60">
                        Enquanto isso, entre em contato diretamente com <strong className="text-white">quem forneceu seu crédito</strong> pelo WhatsApp, telefone ou e-mail já conhecidos. Peça a confirmação do CPF cadastrado no sistema.
                      </p>
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="portal-btn-primary flex w-full items-center justify-center gap-2 py-4 text-sm"
              >
                <ArrowRight size={16} /> Entendi, tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default PortalCliente;
