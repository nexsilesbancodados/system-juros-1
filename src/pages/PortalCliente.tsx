import { useEffect, useMemo, useState } from "react";
import { formatBR } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CalendarDays, Clock, CreditCard, FileText, Lock, Shield, User, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/ClientPortal/PaymentModal";
import { NegotiationTab } from "@/components/ClientPortal/NegotiationTab";
import { computeLateFee } from "@/lib/lateFee";

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
  const [loading, setLoading] = useState(false);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("open");
  const [selectedInstallment, setSelectedInstallment] = useState<PortalInstallment | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Auto re-login from saved CPF on mount
  useEffect(() => {
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
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("portal_client_login_cpf" as never, {
        _cpf: cleanCpf,
      } as never);

      if (error) {
        if (!silent) toast({ title: "Erro ao acessar o portal", description: "Tente novamente em instantes.", variant: "destructive" });
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      if (!data) {
        if (!silent) toast({ title: "Acesso negado", description: "CPF não encontrado.", variant: "destructive" });
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      setPortalData(data as unknown as PortalData);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ cpf: cleanCpf }));
      if (!silent) toast({ title: "Acesso autorizado!" });
    } catch (err) {
      if (!silent) toast({ title: "Erro no acesso", description: "Não foi possível carregar seus dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast({ title: "Informe um CPF válido", variant: "destructive" });
      return;
    }
    await doLogin(cleanCpf);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setPortalData(null);
    setCpf("");
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

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center md:min-h-[calc(100vh-4rem)]">
        {!portalData ? (
          <section className="glass-card relative w-full max-w-md overflow-hidden p-8 shadow-elevated">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

            <div className="space-y-4 text-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logotipo da empresa" className="mx-auto h-20 w-20 rounded-2xl object-contain" />
              ) : (
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Shield size={40} className="text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-4xl font-bold tracking-normal">{portalTitle}</h1>
                <p className="mt-3 text-sm text-muted-foreground">{portalSubtitle}</p>
              </div>
            </div>

            <form onSubmit={handleAccess} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CPF</label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full rounded-xl border border-border bg-input px-4 py-4 text-center font-mono text-xl text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <p className="ml-1 text-center text-[11px] text-muted-foreground">
                Acesse informando apenas seu CPF.
              </p>


              <Button type="submit" disabled={loading} className="w-full rounded-xl py-7 text-lg font-bold shadow-premium">
                {loading ? <Clock className="mr-2 animate-spin" /> : <ArrowRight className="mr-2" />}
                {loading ? "Verificando..." : "Entrar no Portal"}
              </Button>

            </form>

            {(branding.portal_contact_phone || branding.portal_contact_email) && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                {branding.portal_contact_phone && (
                  <a href={`tel:${branding.portal_contact_phone}`} className="flex items-center gap-1 hover:text-primary">
                    <Phone size={12} /> {branding.portal_contact_phone}
                  </a>
                )}
                {branding.portal_contact_email && (
                  <a href={`mailto:${branding.portal_contact_email}`} className="flex items-center gap-1 hover:text-primary">
                    <Mail size={12} /> {branding.portal_contact_email}
                  </a>
                )}
              </div>
            )}

            <div className="pt-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Criptografia de Ponta a Ponta</p>
            </div>
          </section>
        ) : (
          <section className="w-full space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logotipo da empresa" className="h-14 w-14 shrink-0 rounded-2xl object-contain border border-border" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-success/20 bg-success/10">
                    <User className="text-success" size={28} />
                  </div>
                )}
                <div>
                  <h2 className="text-3xl font-bold tracking-normal md:text-4xl">Olá, {firstName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {branding.portal_welcome_message || "Contratos e parcelas vinculados ao seu CPF."}
                  </p>
                </div>
              </div>
              <Button onClick={handleLogout} variant="outline" className="border-border">
                <Lock className="mr-2" size={16} />
                Sair
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contratos ativos</p>
                <p className="mt-2 text-2xl font-bold">{summary.activeContracts}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saldo em aberto</p>
                <p className="mt-2 text-2xl font-bold">{money(summary.openAmount)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total pago</p>
                <p className="mt-2 text-2xl font-bold text-success">{money(summary.paidAmount)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Parcelas vencidas</p>
                <p className="mt-2 text-2xl font-bold text-warning">{summary.overdueCount}</p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-1">
              {[
                { key: "open" as Tab, label: "Em aberto", count: summary.openCount },
                { key: "overdue" as Tab, label: "Atrasadas", count: summary.overdueCount },
                { key: "paid" as Tab, label: "Pagas", count: summary.paidCount },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? "border border-b-0 border-border bg-card text-foreground -mb-[1px]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className="text-xs font-bold">{t.count}</span>
                </button>
              ))}
            </div>

            {/* Installment list */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground">
                  {tab === "paid" ? "Nenhum pagamento registrado ainda." : tab === "overdue" ? "Nenhuma parcela atrasada 🎉" : "Nenhuma parcela em aberto 🎉"}
                </div>
              ) : (
                filtered.map(({ contract, installment, isOverdue }) => (
                  <button
                    key={installment.id}
                    onClick={() => openPayment(installment)}
                    className="glass-card flex w-full items-center gap-4 p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      installment.status === "paid" ? "bg-success/10 text-success" : isOverdue ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                    }`}>
                      #{installment.installment_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-muted-foreground" />
                        <p className="text-sm font-semibold truncate">Contrato {contract.id.slice(0, 8).toUpperCase()}</p>
                        <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {contract.frequency === "monthly" ? "Mensal" : contract.frequency === "weekly" ? "Semanal" : contract.frequency === "daily" ? "Diário" : contract.frequency}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays size={12} />
                        {installment.status === "paid" ? `Pago em ${date(installment.paid_at)}` : `Vence em ${date(installment.due_date)}`}
                        {isOverdue && <span className="text-warning font-medium ml-1">· {Math.floor((Date.now() - +new Date(installment.due_date)) / 86400000)} dia(s)</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {(() => {
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
                          <>
                            <p className="text-base font-bold">{money(total)}</p>
                            {fee > 0 && installment.status !== "paid" && (
                              <p className="text-[10px] text-warning">+ {money(fee)} multa/juros</p>
                            )}
                          </>
                        );
                      })()}
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${installment.status === "paid" ? "text-success" : isOverdue ? "text-warning" : "text-primary"}`}>
                        {installment.status === "paid" ? "Pago" : isOverdue ? "Vencido" : "Em aberto"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Contracts overview (compact) */}
            <div className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Seus contratos</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {portalData.contracts.map((contract) => (
                  <article key={contract.id} className="glass-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{contract.id.slice(0, 8).toUpperCase()}</p>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {statusLabel(contract.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Capital</p>
                        <p className="font-bold">{money(contract.capital)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Parcela</p>
                        <p className="font-bold">{money(contract.installment_amount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Juros</p>
                        <p className="font-bold">{Number(contract.interest_rate || 0)}%</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Início {date(contract.start_date)} • {contract.num_installments} parcelas
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {portalData.client.cpf_cnpj && (
              <div className="space-y-3 pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Assistente</h2>
                <NegotiationTab clientId={portalData.client.id} cpf={portalData.client.cpf_cnpj} />
              </div>
            )}

            {(branding.portal_contact_phone || branding.portal_contact_email) && (
              <div className="glass-card flex flex-wrap items-center justify-center gap-4 p-4 text-sm">
                <span className="text-muted-foreground">Precisa de ajuda?</span>
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

    </main>
  );
};

export default PortalCliente;
