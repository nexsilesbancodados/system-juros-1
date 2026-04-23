import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Search, UserPlus, X, Hash, Percent, Calendar, Clock, Repeat, AlertCircle, Loader2, DollarSign, Shield, Info, Sparkles, FileText } from "lucide-react";

type LoanMode = "percentage" | "installments";
type Frequency = "monthly" | "weekly" | "daily";
type DailyMode = "mon-fri" | "mon-sat" | "mon-sun";

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

const INPUT = "w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200";

const NovoContrato = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const sim = (location.state as any) || {};

  // Step 1
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [newClient, setNewClient] = useState({ nome: "", email: "", telefone: "", whatsapp: "", cpfCnpj: "", cep: "", rua: "", numero: "", bairro: "", cidade: "", estado: "" });
  const [cepLoading, setCepLoading] = useState(false);

  // Step 2
  const [capital, setCapital] = useState(sim.valor || "");
  const [capitalDisplay, setCapitalDisplay] = useState(sim.valor ? formatCurrency((parseFloat(sim.valor) * 100).toFixed(0)) : "");
  const [loanMode, setLoanMode] = useState<LoanMode>(sim.loanMode || "installments");
  const [frequency, setFrequency] = useState<Frequency>(sim.frequency || "monthly");
  const [dailyMode, setDailyMode] = useState<DailyMode>(sim.dailyMode || "mon-fri");
  const [taxaJuros, setTaxaJuros] = useState(sim.taxa || "");
  const [numInstallments, setNumInstallments] = useState(sim.parcelas?.toString() || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [lateFeePercent, setLateFeePercent] = useState("");
  const [dailyInterestPercent, setDailyInterestPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Load defaults from settings
  const { data: settings } = useQuery({
    queryKey: ["user-settings-defaults", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("default_interest_rate, default_late_fee, default_daily_interest, default_frequency").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (settings && !defaultsLoaded) {
      if (!taxaJuros) setTaxaJuros(String(settings.default_interest_rate ?? 10));
      if (!lateFeePercent) setLateFeePercent(String(settings.default_late_fee ?? 2));
      if (!dailyInterestPercent) setDailyInterestPercent(String(settings.default_daily_interest ?? 0.33));
      if (!sim.frequency && settings.default_frequency) {
        const f = settings.default_frequency as Frequency;
        if (["monthly", "weekly", "daily"].includes(f)) setFrequency(f);
      }
      setDefaultsLoaded(true);
    }
  }, [settings, defaultsLoaded, taxaJuros, lateFeePercent, dailyInterestPercent, sim.frequency]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-contract", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, cpf_cnpj, phone, whatsapp, credit_score, status").eq("user_id", user!.id).order("name");
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c: any) => c.name?.toLowerCase().includes(q) || c.cpf_cnpj?.includes(clientSearch) || c.phone?.includes(clientSearch));
  }, [clients, clientSearch]);

  const selectedClient = clients.find((c: any) => c.id === selectedClientId);

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

  const roi = useMemo(() => {
    if (!calc || !capital) return null;
    const cap = parseFloat(capital);
    return cap > 0 ? ((calc.totalInterest / cap) * 100) : 0;
  }, [calc, capital]);

  const generateDueDates = (start: string, freq: Frequency, count: number, dMode: DailyMode) => {
    const dates: string[] = [];
    const s = new Date(start + "T12:00:00");
    for (let i = 0; i < count; i++) {
      if (freq === "daily") {
        let added = 0;
        const cur = new Date(s);
        while (added < i + 1) {
          cur.setDate(cur.getDate() + 1);
          const dow = cur.getDay();
          if (dMode === "mon-fri" && (dow === 0 || dow === 6)) continue;
          if (dMode === "mon-sat" && dow === 0) continue;
          added++;
        }
        dates.push(cur.toISOString());
      } else if (freq === "weekly") {
        const d = new Date(s); d.setDate(s.getDate() + (i + 1) * 7); dates.push(d.toISOString());
      } else {
        const d = new Date(s); d.setMonth(s.getMonth() + (i + 1)); dates.push(d.toISOString());
      }
    }
    return dates;
  };

  const updateNewClient = (field: string, value: string) => setNewClient(prev => ({ ...prev, [field]: value }));

  const handleCepChange = useCallback((v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 8);
    updateNewClient("cep", nums.length > 5 ? `${nums.slice(0,5)}-${nums.slice(5)}` : nums);
    if (nums.length === 8) {
      setCepLoading(true);
      fetch(`https://viacep.com.br/ws/${nums}/json/`)
        .then(r => r.json())
        .then(data => {
          if (!data.erro) {
            setNewClient(prev => ({ ...prev, rua: data.logradouro || "", bairro: data.bairro || "", cidade: data.localidade || "", estado: data.uf || "" }));
          }
        })
        .catch(() => {})
        .finally(() => setCepLoading(false));
    }
  }, []);

  const handleCreateClient = useCallback(async () => {
    if (!user || !newClient.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSavingClient(true);
    const clientId = crypto.randomUUID();
    const { error } = await supabase.from("clients").insert({
      id: clientId, user_id: user.id, name: newClient.nome.trim(),
      email: newClient.email.trim() || null, phone: newClient.telefone.trim() || null,
      whatsapp: newClient.whatsapp.trim() || null,
      cpf_cnpj: newClient.cpfCnpj.trim() || null, client_type: "loan", status: "Ativo",
      address: newClient.rua ? { cep: newClient.cep, street: newClient.rua, number: newClient.numero, neighborhood: newClient.bairro, city: newClient.cidade, state: newClient.estado } : null,
    });
    setSavingClient(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✓ Cliente cadastrado!" });
    await qc.invalidateQueries({ queryKey: ["clients-for-contract", user.id] });
    setSelectedClientId(clientId);
    setShowNewClient(false);
    setNewClient({ nome: "", email: "", telefone: "", whatsapp: "", cpfCnpj: "", cep: "", rua: "", numero: "", bairro: "", cidade: "", estado: "" });
  }, [user, newClient, toast, qc]);

  const handleCapitalChange = (v: string) => {
    setCapitalDisplay(formatCurrency(v));
    setCapital(parseCurrency(v));
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !selectedClientId || !calc) return;
    setLoading(true);
    try {
      const n = calc.numParcelas;
      const freqValue = frequency === "daily" ? `daily_${dailyMode}` : frequency;
      const { data: contract, error: cErr } = await supabase.from("contracts").insert({
        user_id: user.id, client_id: selectedClientId, capital: parseFloat(capital),
        interest_rate: parseFloat(taxaJuros), num_installments: n, installment_amount: calc.installmentAmount,
        frequency: freqValue, start_date: new Date(startDate + "T12:00:00").toISOString(),
        late_fee_percent: parseFloat(lateFeePercent || "2"), daily_interest_percent: parseFloat(dailyInterestPercent || "0.33"),
        total_amount: calc.totalAmount, total_interest: calc.totalInterest, status: "active",
        notes: notes || (loanMode === "percentage" ? "Modo: Porcentagem" : "Modo: Parcelas"),
      }).select().single();
      if (cErr) throw cErr;

      const dueDates = generateDueDates(startDate, frequency, n, dailyMode);
      const installments = dueDates.map((dd, i) => ({
        user_id: user.id, contract_id: contract.id, client_id: selectedClientId,
        installment_number: i + 1, amount: calc.installmentAmount, due_date: dd, status: "pending",
      }));
      const { error: iErr } = await supabase.from("contract_installments").insert(installments);
      if (iErr) throw iErr;

      // Register transaction
      await supabase.from("transactions").insert({
        user_id: user.id, amount: parseFloat(capital), type: "loan",
        description: `Empréstimo - ${selectedClient?.name} · ${n}x R$ ${fmt(calc.installmentAmount)}`,
        client_id: selectedClientId, contract_id: contract.id,
      });

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: user.id, action: "create_contract", entity_type: "contract",
        entity_id: contract.id, details: { capital: parseFloat(capital), installments: n, client_name: selectedClient?.name },
      });

      toast({ title: "✓ Contrato criado!", description: `${n} pagamentos gerados com sucesso.` });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      navigate(`/clientes/${selectedClientId}`);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [user, selectedClientId, calc, capital, taxaJuros, frequency, dailyMode, startDate, lateFeePercent, dailyInterestPercent, notes, loanMode, toast, navigate, selectedClient, qc]);

  const periodLabel = frequency === "daily" ? "dia" : frequency === "weekly" ? "semana" : "mês";
  const freqLabel = frequency === "daily" ? "Diário" : frequency === "weekly" ? "Semanal" : "Mensal";

  // Validation checks
  const step1Valid = !!selectedClientId;
  const step2Valid = !!calc;
  const clientWarning = selectedClient && (selectedClient as any).credit_score < 300;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-xl hover:bg-card/60 text-muted-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="page-hero-icon">
            <FileText size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-shimmer">Novo Contrato</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Etapa {step} de 3 — {["Cliente", "Configuração", "Revisão"][step - 1]}</p>
          </div>
          {step === 2 && settings && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold border border-primary/20">
              <Shield size={10} /> Padrões carregados
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
            <button onClick={() => { if (s < step) setStep(s); }}
              className={`h-2.5 w-full rounded-full transition-all duration-500 ${s < step ? "bg-success cursor-pointer" : s === step ? "bg-primary" : "bg-border"}`} />
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${s <= step ? "text-foreground" : "text-muted-foreground/50"}`}>
              {["Cliente", "Config", "Revisão"][s - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Client */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Dados do Cliente</h2>
          <p className="text-sm text-muted-foreground">Selecione um cliente existente ou cadastre novo.</p>

          {!showNewClient ? (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Buscar por nome, CPF ou telefone..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className={`${INPUT} pl-9`} autoFocus />
                {clientSearch && <button onClick={() => setClientSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-hide">
                {filteredClients.map((c: any) => {
                  const scoreColor = (c.credit_score || 100) >= 700 ? "text-success" : (c.credit_score || 100) >= 400 ? "text-warning" : "text-destructive";
                  return (
                    <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${selectedClientId === c.id ? "bg-primary/10 border-2 border-primary/30 shadow-sm" : "hover:bg-accent/50 border-2 border-transparent"}`}>
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-foreground">{c.name?.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm truncate">{c.name}</p>
                          {c.status !== "Ativo" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c.status}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{c.cpf_cnpj || c.phone || "Sem dados"}</span>
                          <span className={`font-semibold ${scoreColor}`}>Score: {c.credit_score || 100}</span>
                        </div>
                      </div>
                      {selectedClientId === c.id && <Check size={16} className="text-primary" />}
                    </button>
                  );
                })}
                {filteredClients.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                      <Search size={20} className="text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Nenhum cliente encontrado</p>
                    <button onClick={() => setShowNewClient(true)} className="text-sm text-primary font-semibold hover:underline">Cadastrar novo</button>
                  </div>
                )}
              </div>

              {/* Client warning */}
              {clientWarning && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-warning/5 border border-warning/20 text-warning text-xs">
                  <AlertCircle size={14} />
                  <div>
                    <p className="font-semibold">Score baixo ({(selectedClient as any)?.credit_score})</p>
                    <p className="text-warning/70">Este cliente tem histórico de risco. Considere garantias.</p>
                  </div>
                </div>
              )}

              {filteredClients.length > 0 && (
                <button onClick={() => setShowNewClient(true)} className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
                  <UserPlus size={14} /> Cadastrar novo cliente
                </button>
              )}
            </>
          ) : (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><UserPlus size={14} className="text-primary" /> Novo Cliente</h3>
                <button onClick={() => setShowNewClient(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Nome Completo *</label>
                <input type="text" placeholder="Nome do cliente" value={newClient.nome} onChange={(e) => updateNewClient("nome", e.target.value)} className={INPUT} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Telefone</label>
                  <input type="tel" placeholder="(00) 00000-0000" value={newClient.telefone} onChange={(e) => updateNewClient("telefone", formatPhone(e.target.value))} className={INPUT} inputMode="tel" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">WhatsApp</label>
                  <input type="tel" placeholder="(00) 00000-0000" value={newClient.whatsapp} onChange={(e) => updateNewClient("whatsapp", formatPhone(e.target.value))} className={INPUT} inputMode="tel" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">CPF/CNPJ</label>
                <input type="text" placeholder="000.000.000-00" value={newClient.cpfCnpj} onChange={(e) => updateNewClient("cpfCnpj", formatCpfCnpj(e.target.value))} className={INPUT} inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">E-mail</label>
                <input type="email" placeholder="email@exemplo.com" value={newClient.email} onChange={(e) => updateNewClient("email", e.target.value)} className={INPUT} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">CEP</label>
                  <input type="text" placeholder="00000-000" value={newClient.cep} onChange={(e) => handleCepChange(e.target.value)} className={INPUT} inputMode="numeric" />
                </div>
                <div className="self-end">
                  {cepLoading && <Loader2 size={16} className="animate-spin text-muted-foreground mb-3" />}
                </div>
              </div>
              {newClient.rua && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/15 text-xs text-success">
                  <Check size={14} />
                  <span>{newClient.rua}, {newClient.bairro} - {newClient.cidade}/{newClient.estado}</span>
                </div>
              )}
              <button onClick={handleCreateClient} disabled={savingClient || !newClient.nome.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-opacity"
                style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
                {savingClient ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {savingClient ? "Salvando..." : "Cadastrar e Selecionar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Config */}
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
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 ${loanMode === m.v ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${loanMode === m.v ? "bg-primary/10" : "bg-muted/30"}`}>
                    <m.Icon size={18} className={loanMode === m.v ? "text-primary" : "text-muted-foreground"} />
                  </div>
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
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all duration-200 ${frequency === f.v ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}>
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
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all duration-200 ${dailyMode === d.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
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
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas (opcional)" rows={2} className={`${INPUT} resize-none`} />
            </div>

            {calc && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" /> Simulação
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[
                    { label: "Juros Total", value: `R$ ${fmt(calc.totalInterest)}`, color: "text-primary" },
                    { label: "Total a Receber", value: `R$ ${fmt(calc.totalAmount)}`, color: "text-foreground" },
                    { label: `Valor/${periodLabel}`, value: `R$ ${fmt(calc.installmentAmount)}`, color: "text-foreground" },
                    { label: "Pagamentos", value: `${calc.numParcelas}x`, color: "text-foreground" },
                  ].map(i => (
                    <div key={i.label}>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{i.label}</p>
                      <p className={`font-bold ${i.color}`}>{i.value}</p>
                    </div>
                  ))}
                </div>
                {roi !== null && (
                  <div className="flex items-center gap-2 pt-3 border-t border-primary/10">
                    <Info size={12} className="text-primary" />
                    <span className="text-xs text-muted-foreground">ROI: <span className="font-bold text-primary">{roi.toFixed(1)}%</span></span>
                    {calc.numParcelas > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">Último vencimento: <span className="font-medium text-foreground">{
                        (() => {
                          const dates = generateDueDates(startDate, frequency, calc.numParcelas, dailyMode);
                          return dates.length ? new Date(dates[dates.length - 1]).toLocaleDateString("pt-BR") : "—";
                        })()
                      }</span></span>
                    )}
                  </div>
                )}
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

      {/* Step 3: Review */}
      {step === 3 && calc && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield size={18} className="text-primary" /> Revisão do Contrato
          </h2>

          {/* Client info */}
          <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {selectedClient?.name?.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedClient?.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedClient as any)?.cpf_cnpj || "—"}</p>
            </div>
            {(selectedClient as any)?.credit_score && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-muted-foreground">Score</p>
                <p className={`text-sm font-bold ${(selectedClient as any).credit_score >= 700 ? "text-success" : (selectedClient as any).credit_score >= 400 ? "text-warning" : "text-destructive"}`}>
                  {(selectedClient as any).credit_score}
                </p>
              </div>
            )}
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
              { label: "Multa Diária", value: `${dailyInterestPercent || "0.33"}%` },
            ].map(i => (
              <div key={i.label} className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{i.label}</p>
                <p className="font-semibold text-sm text-foreground mt-0.5">{i.value}</p>
              </div>
            ))}
          </div>

          {/* Profit highlight */}
          <div className="bg-success/5 border border-success/20 rounded-xl p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Lucro Estimado</p>
            <p className="text-2xl font-bold text-success">R$ {fmt(calc.totalInterest)}</p>
            {roi !== null && <p className="text-xs text-muted-foreground mt-1">ROI: {roi.toFixed(1)}%</p>}
          </div>

          {/* Timeline preview */}
          {calc.numParcelas <= 12 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cronograma</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                {generateDueDates(startDate, frequency, calc.numParcelas, dailyMode).map((dd, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20 text-xs">
                    <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">{i + 1}</span>
                    <span className="text-muted-foreground">{new Date(dd).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span>
                    <span className="ml-auto font-semibold text-foreground">R$ {fmt(calc.installmentAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between p-4 rounded-2xl bg-card/95 backdrop-blur border border-border shadow-lg">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft size={16} /> {step > 1 ? "Voltar" : "Cancelar"}
        </button>
        {step < 3 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all duration-200"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            Próximo <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all duration-200"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {loading ? "Criando..." : "Confirmar Contrato"}
          </button>
        )}
      </div>
    </div>
  );
};

export default NovoContrato;
