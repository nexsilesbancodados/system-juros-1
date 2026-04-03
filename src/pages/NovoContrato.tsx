import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Search, UserPlus } from "lucide-react";

const frequencyOptions = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
];

const NovoContrato = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 – Client
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Step 2 – Loan config
  const [capital, setCapital] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [numInstallments, setNumInstallments] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [lateFeePercent, setLateFeePercent] = useState("2");
  const [dailyInterestPercent, setDailyInterestPercent] = useState("0.33");

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
    const rate = parseFloat(interestRate) || 0;
    const n = parseInt(numInstallments) || 0;
    if (!cap || !n) return null;

    const totalInterest = cap * (rate / 100);
    const totalAmount = cap + totalInterest;
    const installmentAmount = totalAmount / n;

    return { totalInterest, totalAmount, installmentAmount };
  }, [capital, interestRate, numInstallments]);

  // Generate due dates
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

  const handleSubmit = async () => {
    if (!user || !selectedClientId || !calc) return;
    setLoading(true);

    try {
      const n = parseInt(numInstallments);
      const { data: contract, error: cErr } = await supabase
        .from("contracts")
        .insert({
          user_id: user.id,
          client_id: selectedClientId,
          capital: parseFloat(capital),
          interest_rate: parseFloat(interestRate),
          num_installments: n,
          installment_amount: calc.installmentAmount,
          frequency,
          start_date: new Date(startDate + "T12:00:00").toISOString(),
          late_fee_percent: parseFloat(lateFeePercent),
          daily_interest_percent: parseFloat(dailyInterestPercent),
          total_amount: calc.totalAmount,
          total_interest: calc.totalInterest,
          status: "active",
        })
        .select()
        .single();

      if (cErr) throw cErr;

      // Generate installments
      const dueDates = generateDueDates(startDate, frequency, n);
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

      toast({ title: "Contrato criado!", description: `${n} parcelas geradas com sucesso.` });
      navigate("/contratos");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canAdvance1 = !!selectedClientId;
  const canAdvance2 = !!capital && !!interestRate && !!numInstallments && !!startDate && calc;

  const inputCls =
    "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/contratos")} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Contrato</h1>
          <p className="text-sm text-muted-foreground">Etapa {step} de 3</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select Client */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Dados do Cliente</h2>
          <p className="text-sm text-muted-foreground">Selecione um cliente existente ou cadastre um novo.</p>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredClients.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  selectedClientId === c.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-accent/50 border border-transparent"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-foreground">
                  {c.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.cpf_cnpj || "Sem CPF"}</p>
                </div>
                {selectedClientId === c.id && <Check size={16} className="text-primary" />}
              </button>
            ))}
            {filteredClients.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum cliente encontrado</p>
            )}
          </div>

          <button
            onClick={() => navigate("/clientes/novo")}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <UserPlus size={14} />
            Cadastrar novo cliente
          </button>
        </div>
      )}

      {/* Step 2: Loan Config */}
      {step === 2 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Configuração do Empréstimo</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital (R$)</label>
              <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="1000.00" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Taxa de Juros (%)</label>
              <input type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="10" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº de Parcelas</label>
              <input type="number" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} placeholder="12" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Frequência</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
                {frequencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data 1º Vencimento</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa por Atraso (%)</label>
              <input type="number" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Juros por Dia de Atraso (%)</label>
              <input type="number" value={dailyInterestPercent} onChange={(e) => setDailyInterestPercent(e.target.value)} className={inputCls} step="0.01" />
            </div>
          </div>

          {calc && (
            <div className="bg-muted/30 rounded-lg p-4 mt-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Resumo do cálculo</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total Juros</p>
                  <p className="font-semibold text-foreground">
                    R$ {calc.totalInterest.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total a Pagar</p>
                  <p className="font-semibold text-foreground">
                    R$ {calc.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Valor Parcela</p>
                  <p className="font-semibold text-primary">
                    R$ {calc.installmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && calc && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Revisão do Contrato</h2>

          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Cliente</p>
              <p className="font-semibold text-foreground">{selectedClient?.name}</p>
              <p className="text-xs text-muted-foreground">{selectedClient?.cpf_cnpj || "—"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Capital", value: `R$ ${parseFloat(capital).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                { label: "Taxa de Juros", value: `${interestRate}%` },
                { label: "Parcelas", value: `${numInstallments}x R$ ${calc.installmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                { label: "Frequência", value: frequencyOptions.find((f) => f.value === frequency)?.label },
                { label: "1º Vencimento", value: new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR") },
                { label: "Total a Receber", value: `R$ ${calc.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                { label: "Multa Atraso", value: `${lateFeePercent}%` },
                { label: "Juros/Dia Atraso", value: `${dailyInterestPercent}%` },
              ].map((item) => (
                <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold text-sm text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-semibold text-primary">
                Lucro estimado: R$ {calc.totalInterest.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : navigate("/contratos")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft size={16} />
          {step > 1 ? "Voltar" : "Cancelar"}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={(step === 1 && !canAdvance1) || (step === 2 && !canAdvance2)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-colors"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
          >
            Próximo
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-colors"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
          >
            {loading ? "Criando..." : "Confirmar Contrato"}
            <Check size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default NovoContrato;
