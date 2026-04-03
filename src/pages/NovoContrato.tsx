import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Search, UserPlus, X, Hash, Percent, Calendar, Clock, Repeat, AlertCircle, Loader2, DollarSign } from "lucide-react";

type LoanMode = "percentage" | "installments";
type Frequency = "monthly" | "weekly" | "daily";
type DailyMode = "mon-fri" | "mon-sat" | "mon-sun";

const formatPhone = (v: string) => {
  const nums = v.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
};

const formatCpfCnpj = (v: string) => {
  const nums = v.replace(/\D/g, "").slice(0, 14);
  if (nums.length <= 11) {
    return nums.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
      [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
    );
  }
  return nums.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) =>
    a + (b ? `.${b}` : "") + (c ? `.${c}` : "") + (d ? `/${d}` : "") + (e ? `-${e}` : "")
  );
};

const formatCurrency = (v: string) => {
  const nums = v.replace(/\D/g, "");
  if (!nums) return "";
  const value = parseInt(nums) / 100;
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrency = (v: string) => {
  const nums = v.replace(/\D/g, "");
  if (!nums) return "";
  return (parseInt(nums) / 100).toString();
};

const NovoContrato = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const simState = (location.state as any) || {};

  // Step 1 – Client
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  // New client inline form
  const [newNome, setNewNome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTelefone, setNewTelefone] = useState("");
  const [newCpfCnpj, setNewCpfCnpj] = useState("");
  const [newCep, setNewCep] = useState("");
  const [newRua, setNewRua] = useState("");
  const [newNumero, setNewNumero] = useState("");
  const [newBairro, setNewBairro] = useState("");
  const [newCidade, setNewCidade] = useState("");
  const [newEstado, setNewEstado] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Step 2 – Loan config
  const [capital, setCapital] = useState(simState.valor || "");
  const [capitalDisplay, setCapitalDisplay] = useState(simState.valor ? formatCurrency((parseFloat(simState.valor) * 100).toFixed(0)) : "");
  const [loanMode, setLoanMode] = useState<LoanMode>(simState.loanMode || "installments");
  const [frequency, setFrequency] = useState<Frequency>(simState.frequency || "monthly");
  const [dailyMode, setDailyMode] = useState<DailyMode>(simState.dailyMode || "mon-fri");
  const [taxaJuros, setTaxaJuros] = useState(simState.taxa || "10");
  const [numInstallments, setNumInstallments] = useState(simState.parcelas?.toString() || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [lateFeePercent, setLateFeePercent] = useState("2");
  const [dailyInterestPercent, setDailyInterestPercent] = useState("0.33");
  const [notes, setNotes] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-contract", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, cpf_cnpj, phone")
        .eq("user_id", user!.id)
        .order("name");
      return data || [];
    },
    enabled: !!user,
  });

  const filteredClients = clients.filter(
    (c: any) =>
      !clientSearch ||
      c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.cpf_cnpj?.includes(clientSearch)
  );

  const selectedClient = clients.find((c: any) => c.id === selectedClientId);

  // Calculations
  const calc = useMemo(() => {
    const cap = parseFloat(capital) || 0;
    const taxa = parseFloat(taxaJuros) || 0;
    const n = parseInt(numInstallments) || 0;
    if (!cap || !taxa) return null;

    if (loanMode === "percentage") {
      if (frequency === "monthly") {
        const juros = cap * (taxa / 100);
        const total = cap + juros;
        return { totalInterest: juros, totalAmount: total, installmentAmount: total, numParcelas: 1 };
      }
      if (n > 0) {
        const juros = cap * (taxa / 100) * n;
        const total = cap + juros;
        return { totalInterest: juros, totalAmount: total, installmentAmount: total / n, numParcelas: n };
      }
      const periods = Math.ceil(100 / taxa);
      const payPer = cap * (taxa / 100);
      const total = payPer * periods;
      return { totalInterest: total - cap, totalAmount: total, installmentAmount: payPer, numParcelas: periods };
    } else {
      if (!n) return null;
      const juros = cap * (taxa / 100) * n;
      const total = cap + juros;
      return { totalInterest: juros, totalAmount: total, installmentAmount: total / n, numParcelas: n };
    }
  }, [capital, taxaJuros, numInstallments, loanMode, frequency]);

  const generateDueDates = (start: string, freq: Frequency, count: number, dMode: DailyMode) => {
    const dates: string[] = [];
    const startD = new Date(start + "T12:00:00");

    for (let i = 0; i < count; i++) {
      if (freq === "daily") {
        let daysAdded = 0;
        const currentDay = new Date(startD);
        while (daysAdded < i + 1) {
          currentDay.setDate(currentDay.getDate() + 1);
          const dow = currentDay.getDay();
          if (dMode === "mon-fri" && (dow === 0 || dow === 6)) continue;
          if (dMode === "mon-sat" && dow === 0) continue;
          daysAdded++;
        }
        dates.push(currentDay.toISOString());
      } else if (freq === "weekly") {
        const nd = new Date(startD);
        nd.setDate(startD.getDate() + (i + 1) * 7);
        dates.push(nd.toISOString());
      } else {
        const nd = new Date(startD);
        nd.setMonth(startD.getMonth() + (i + 1));
        dates.push(nd.toISOString());
      }
    }
    return dates;
  };

  const buscarCep = async () => {
    const raw = newCep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setNewRua(data.logradouro || "");
        setNewBairro(data.bairro || "");
        setNewCidade(data.localidade || "");
        setNewEstado(data.uf || "");
        toast({ title: "CEP encontrado!" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {} finally { setCepLoading(false); }
  };

  const handleCepChange = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 8);
    const formatted = nums.length > 5 ? `${nums.slice(0,5)}-${nums.slice(5)}` : nums;
    setNewCep(formatted);
    if (nums.length === 8) {
      setCepLoading(true);
      fetch(`https://viacep.com.br/ws/${nums}/json/`)
        .then(r => r.json())
        .then(data => {
          if (!data.erro) {
            setNewRua(data.logradouro || "");
            setNewBairro(data.bairro || "");
            setNewCidade(data.localidade || "");
            setNewEstado(data.uf || "");
          }
        })
        .catch(() => {})
        .finally(() => setCepLoading(false));
    }
  };

  const handleCreateClient = async () => {
    if (!user || !newNome.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }
    setSavingClient(true);
    const clientId = crypto.randomUUID();
    const { error } = await supabase.from("clients").insert({
      id: clientId,
      user_id: user.id,
      name: newNome.trim(),
      email: newEmail.trim() || null,
      phone: newTelefone.trim() || null,
      cpf_cnpj: newCpfCnpj.trim() || null,
      client_type: "loan",
      status: "Ativo",
      address: newRua ? { cep: newCep, street: newRua, number: newNumero, neighborhood: newBairro, city: newCidade, state: newEstado } : null,
    });
    setSavingClient(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✓ Cliente cadastrado!" });
    await queryClient.invalidateQueries({ queryKey: ["clients-for-contract", user.id] });
    setSelectedClientId(clientId);
    setShowNewClientForm(false);
    setNewNome(""); setNewEmail(""); setNewTelefone(""); setNewCpfCnpj("");
    setNewCep(""); setNewRua(""); setNewNumero(""); setNewBairro(""); setNewCidade(""); setNewEstado("");
  };

  const handleCapitalChange = (v: string) => {
    const display = formatCurrency(v);
    setCapitalDisplay(display);
    setCapital(parseCurrency(v));
  };

  const handleSubmit = async () => {
    if (!user || !selectedClientId || !calc) return;
    setLoading(true);

    try {
      const n = calc.numParcelas;
      const freqValue = frequency === "daily" ? `daily_${dailyMode}` : frequency;

      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          user_id: user.id,
          client_id: selectedClientId,
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
        })
        .select()
        .single();

      if (cErr) throw cErr;

      const dueDates = generateDueDates(startDate, frequency, n, dailyMode);
      const installments = dueDates.map((dd, i) => ({
        user_id: user.id,
        contract_id: contract.id,
        client_id: selectedClientId,
        installment_number: i + 1,
        amount: calc.installmentAmount,
        due_date: dd,
        status: "pending",
      }));

      const { error: iErr } = await supabase
        .from("contract_installments")
        .insert(installments);

      if (iErr) throw iErr;

      toast({ title: "✓ Contrato criado!", description: `${n} pagamentos gerados com sucesso.` });
      navigate("/contratos");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canAdvance1 = !!selectedClientId;
  const canAdvance2 = !!capital && !!taxaJuros && calc;

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all duration-150";

  const freqLabel = frequency === "daily" ? "Diário" : frequency === "weekly" ? "Semanal" : "Mensal";
  const periodLabel = frequency === "daily" ? "dia" : frequency === "weekly" ? "semana" : "mês";

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stepLabels = ["Cliente", "Configuração", "Revisão"];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors focus-ring">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Novo Contrato</h1>
          <p className="text-sm text-muted-foreground">Etapa {step} de 3 — {stepLabels[step - 1]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => { if (s < step) setStep(s); }}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              s < step ? "bg-success cursor-pointer" : s === step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select or Create Client */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Dados do Cliente</h2>
          <p className="text-sm text-muted-foreground">Selecione um cliente existente ou cadastre um novo.</p>

          {!showNewClientForm ? (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Buscar por nome ou CPF..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className={`${inputCls} pl-9`} autoFocus />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredClients.map((c: any) => (
                  <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150 ${
                      selectedClientId === c.id ? "bg-primary/10 border border-primary/30" : "hover:bg-accent/50 border border-transparent"
                    }`}>
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-foreground">{c.name?.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.cpf_cnpj || c.phone || "Sem dados"}</p>
                    </div>
                    {selectedClientId === c.id && <Check size={16} className="text-primary" />}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-2">Nenhum cliente encontrado</p>
                    <button onClick={() => setShowNewClientForm(true)} className="text-sm text-primary font-medium hover:underline">
                      Cadastrar novo cliente
                    </button>
                  </div>
                )}
              </div>

              {filteredClients.length > 0 && (
                <button onClick={() => setShowNewClientForm(true)} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  <UserPlus size={14} /> Cadastrar novo cliente
                </button>
              )}
            </>
          ) : (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserPlus size={14} className="text-primary" /> Novo Cliente
                </h3>
                <button onClick={() => setShowNewClientForm(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Nome Completo *</label>
                <input type="text" placeholder="Nome do cliente" value={newNome} onChange={(e) => setNewNome(e.target.value)} className={inputCls} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Telefone</label>
                  <input type="tel" placeholder="(00) 00000-0000" value={newTelefone} onChange={(e) => setNewTelefone(formatPhone(e.target.value))} className={inputCls} inputMode="tel" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">CPF/CNPJ</label>
                  <input type="text" placeholder="000.000.000-00" value={newCpfCnpj} onChange={(e) => setNewCpfCnpj(formatCpfCnpj(e.target.value))} className={inputCls} inputMode="numeric" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">E-mail</label>
                <input type="email" placeholder="email@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">CEP</label>
                  <input type="text" placeholder="00000-000" value={newCep} onChange={(e) => handleCepChange(e.target.value)} className={inputCls} inputMode="numeric" />
                </div>
                <button onClick={buscarCep} disabled={cepLoading} className="self-end px-3 py-2.5 rounded-xl bg-accent border border-border text-foreground hover:bg-accent/70 transition-colors disabled:opacity-50">
                  {cepLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>
              {newRua && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/15 text-xs text-success">
                  <Check size={14} />
                  <span>{newRua}, {newBairro} - {newCidade}/{newEstado}</span>
                </div>
              )}
              <button onClick={handleCreateClient} disabled={savingClient || !newNome.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all"
                style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
                {savingClient ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {savingClient ? "Salvando..." : "Cadastrar e Selecionar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Loan Config */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Loan Mode */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Modo do Empréstimo</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLoanMode("installments")}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-150 ${loanMode === "installments" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                <Hash size={20} className={loanMode === "installments" ? "text-primary" : "text-muted-foreground"} />
                <div className="text-left">
                  <p className={`text-sm font-semibold ${loanMode === "installments" ? "text-primary" : "text-foreground"}`}>Por Parcelas</p>
                  <p className="text-[10px] text-muted-foreground">Nº fixo de parcelas</p>
                </div>
              </button>
              <button onClick={() => setLoanMode("percentage")}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-150 ${loanMode === "percentage" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                <Percent size={20} className={loanMode === "percentage" ? "text-primary" : "text-muted-foreground"} />
                <div className="text-left">
                  <p className={`text-sm font-semibold ${loanMode === "percentage" ? "text-primary" : "text-foreground"}`}>Por Porcentagem</p>
                  <p className="text-[10px] text-muted-foreground">Paga % até quitar</p>
                </div>
              </button>
            </div>
          </div>

          {/* Frequency */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Frequência</h2>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: "monthly" as Frequency, label: "Mensal", icon: Calendar },
                { value: "weekly" as Frequency, label: "Semanal", icon: Repeat },
                { value: "daily" as Frequency, label: "Diário", icon: Clock },
              ]).map(f => (
                <button key={f.value} onClick={() => setFrequency(f.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all duration-150 ${frequency === f.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                  <f.icon size={18} className={frequency === f.value ? "text-primary" : "text-muted-foreground"} />
                  <p className={`text-xs font-semibold ${frequency === f.value ? "text-primary" : "text-foreground"}`}>{f.label}</p>
                </button>
              ))}
            </div>

            {frequency === "daily" && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                {([
                  { value: "mon-fri" as DailyMode, label: "Seg→Sex" },
                  { value: "mon-sat" as DailyMode, label: "Seg→Sáb" },
                  { value: "mon-sun" as DailyMode, label: "Seg→Dom" },
                ]).map(d => (
                  <button key={d.value} onClick={() => setDailyMode(d.value)}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all duration-150 ${dailyMode === d.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
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
                  <input
                    type="text"
                    value={capitalDisplay}
                    onChange={(e) => handleCapitalChange(e.target.value)}
                    placeholder="0,00"
                    className={`${inputCls} pl-8`}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Taxa de Juros (% por {periodLabel}) *</label>
                <div className="relative">
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="number" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} placeholder="10" className={`${inputCls} pl-8`} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  {loanMode === "percentage" ? "Nº de Períodos (opcional)" : "Nº de Parcelas *"}
                </label>
                <input type="number" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)}
                  placeholder={loanMode === "percentage" ? "Auto" : "10"} className={inputCls} inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Data Início</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Multa Diária (%)</label>
                <input type="number" step="0.01" value={dailyInterestPercent} onChange={(e) => setDailyInterestPercent(e.target.value)} placeholder="0.33" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Multa Mensal (%)</label>
                <input type="number" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} placeholder="2" className={inputCls} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre o contrato (opcional)"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            {calc && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <DollarSign size={14} className="text-primary" /> Resumo do Contrato
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Juros</p>
                    <p className="font-bold text-foreground">R$ {fmt(calc.totalInterest)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Total</p>
                    <p className="font-bold text-foreground">R$ {fmt(calc.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Valor/{periodLabel}</p>
                    <p className="font-bold text-primary">R$ {fmt(calc.installmentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Pagamentos</p>
                    <p className="font-bold text-foreground">{calc.numParcelas}x</p>
                  </div>
                </div>
              </div>
            )}

            {!calc && capital && taxaJuros && loanMode === "installments" && !numInstallments && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/5 border border-warning/15 text-xs text-warning">
                <AlertCircle size={14} />
                <span>Informe o número de parcelas para ver o resumo</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && calc && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Revisão do Contrato</h2>

          <div className="space-y-4">
            <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {selectedClient?.name?.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground">{selectedClient?.name}</p>
                <p className="text-xs text-muted-foreground">{selectedClient?.cpf_cnpj || "—"}</p>
              </div>
            </div>

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
              ].map((item) => (
                <div key={item.label} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="font-semibold text-sm text-foreground mt-0.5">{item.value}</p>
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

      {/* Navigation Buttons */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between p-4 rounded-2xl glass-strong border border-border/50">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all focus-ring">
          <ArrowLeft size={16} /> {step > 1 ? "Voltar" : "Cancelar"}
        </button>

        {step < 3 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={(step === 1 && !canAdvance1) || (step === 2 && !canAdvance2)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all focus-ring"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            Próximo <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all focus-ring"
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
