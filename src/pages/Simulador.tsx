import { useState, useMemo } from "react";
import { Calculator, DollarSign, TrendingUp, Percent, Hash, FileSignature, ArrowRight, Zap, Calendar, Clock, Repeat } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AISimulatorInsights from "@/components/simulator/AISimulatorInsights";
import { calculateLoan } from "@/lib/loanMath";


type LoanMode = "percentage" | "installments";
type Frequency = "monthly" | "weekly" | "daily";
type DailyMode = "mon-fri" | "mon-sat" | "mon-sun";

const Simulador = () => {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [loanMode, setLoanMode] = useState<LoanMode>("installments");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [dailyMode, setDailyMode] = useState<DailyMode>("mon-fri");
  const [valueMode, setValueMode] = useState<"rate" | "installment">("rate");
  const [installmentValue, setInstallmentValue] = useState("");
  const navigate = useNavigate();

  const valorNum = parseFloat(valor) || 0;
  const taxaNum = parseFloat(taxa) || 0;
  const parcelasNum = parseInt(parcelas) || 0;
  const installmentNum = parseFloat(installmentValue) || 0;

  const daysPerWeek = dailyMode === "mon-fri" ? 5 : dailyMode === "mon-sat" ? 6 : 7;

  const calc = useMemo(() => {
    const r = calculateLoan({
      capital: valorNum,
      rate: taxaNum,
      periods: parcelasNum,
      frequency,
      loanMode,
      valueMode,
      installmentValue: installmentNum,
    });
    if (!r) return null;
    // Mantém shape antigo (jurosTotal/totalReceber/valorParcela) usado no JSX existente.
    return {
      jurosTotal: r.totalInterest,
      totalReceber: r.totalAmount,
      valorParcela: r.installmentAmount,
      numParcelas: r.numInstallments,
      perPeriodLabel: r.perPeriodLabel,
      ...(r.derivedRate !== undefined ? { derivedRate: r.derivedRate } : {}),
    };
  }, [valorNum, taxaNum, parcelasNum, installmentNum, valueMode, loanMode, frequency, dailyMode]);


  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const presets = [
    { label: "Mensal Simples", valor: "1000", taxa: "10", parcelas: "", mode: "percentage" as LoanMode, freq: "monthly" as Frequency },
    { label: "Mensal Parcelado", valor: "1000", taxa: "10", parcelas: "10", mode: "installments" as LoanMode, freq: "monthly" as Frequency },
    { label: "Diário 10 dias", valor: "1000", taxa: "10", parcelas: "10", mode: "installments" as LoanMode, freq: "daily" as Frequency },
    { label: "Semanal 4x", valor: "1000", taxa: "10", parcelas: "4", mode: "installments" as LoanMode, freq: "weekly" as Frequency },
  ];

  const applyPreset = (p: typeof presets[0]) => {
    setValor(p.valor); setTaxa(p.taxa); setParcelas(p.parcelas);
    setLoanMode(p.mode); setFrequency(p.freq);
  };

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced";

  const hasValue = calc !== null;

  const circumference = 2 * Math.PI * 40;
  const maxProfit = 200;
  const lucroPercent = calc && valorNum > 0 ? (calc.jurosTotal / valorNum) * 100 : 0;
  const profitClamped = Math.min(lucroPercent, maxProfit);

  // Generate installment breakdown with proper dates
  const generateBreakdown = () => {
    if (!calc) return [];
    const items: { num: number; date: string; value: number }[] = [];
    const start = new Date();
    
    for (let i = 0; i < Math.min(calc.numParcelas, 60); i++) {
      const d = new Date(start);
      
      if (frequency === "daily") {
        // Skip weekends based on dailyMode
        let daysAdded = 0;
        let currentDay = new Date(start);
        while (daysAdded < i + 1) {
          currentDay.setDate(currentDay.getDate() + 1);
          const dow = currentDay.getDay(); // 0=Sun, 6=Sat
          if (dailyMode === "mon-fri" && (dow === 0 || dow === 6)) continue;
          if (dailyMode === "mon-sat" && dow === 0) continue;
          daysAdded++;
        }
        items.push({ num: i + 1, date: currentDay.toLocaleDateString("pt-BR"), value: calc.valorParcela });
      } else if (frequency === "weekly") {
        d.setDate(start.getDate() + (i + 1) * 7);
        items.push({ num: i + 1, date: d.toLocaleDateString("pt-BR"), value: calc.valorParcela });
      } else {
        d.setMonth(start.getMonth() + (i + 1));
        items.push({ num: i + 1, date: d.toLocaleDateString("pt-BR"), value: calc.valorParcela });
      }
    }
    return items;
  };

  const breakdown = generateBreakdown();

  return (
    <div className="space-y-5 max-w-2xl mx-auto animate-fade-in">
      <div className="page-hero">
        <div className="page-hero-content flex items-center gap-3">
          <div className="page-hero-icon">
            <Calculator size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-shimmer">Simulador</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Simule empréstimos por parcela ou porcentagem</p>
          </div>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all micro-bounce">
            <Zap size={10} className="inline mr-1" />{p.label}
          </button>
        ))}
      </div>

      {/* Loan Mode Selection */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4 card-shine">
        <label className="text-label mb-1 block">Modo do Empréstimo</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setLoanMode("installments")}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
              loanMode === "installments"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <Hash size={20} className={loanMode === "installments" ? "text-primary" : "text-muted-foreground"} />
            <div className="text-left">
              <p className={`text-sm font-semibold ${loanMode === "installments" ? "text-primary" : "text-foreground"}`}>Por Parcelas</p>
              <p className="text-[10px] text-muted-foreground">Nº fixo de parcelas</p>
            </div>
          </button>
          <button
            onClick={() => setLoanMode("percentage")}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
              loanMode === "percentage"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <Percent size={20} className={loanMode === "percentage" ? "text-primary" : "text-muted-foreground"} />
            <div className="text-left">
              <p className={`text-sm font-semibold ${loanMode === "percentage" ? "text-primary" : "text-foreground"}`}>Por Porcentagem</p>
              <p className="text-[10px] text-muted-foreground">Paga % até quitar</p>
            </div>
          </button>
        </div>
      </div>

      {/* Frequency Selection */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4 card-shine">
        <label className="text-label mb-1 block">Frequência de Pagamento</label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "monthly" as Frequency, label: "Mensal", icon: Calendar, desc: "1x por mês" },
            { value: "weekly" as Frequency, label: "Semanal", icon: Repeat, desc: "A cada 7 dias" },
            { value: "daily" as Frequency, label: "Diário", icon: Clock, desc: "Todo dia" },
          ]).map(f => (
            <button
              key={f.value}
              onClick={() => setFrequency(f.value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                frequency === f.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <f.icon size={18} className={frequency === f.value ? "text-primary" : "text-muted-foreground"} />
              <p className={`text-xs font-semibold ${frequency === f.value ? "text-primary" : "text-foreground"}`}>{f.label}</p>
              <p className="text-[9px] text-muted-foreground">{f.desc}</p>
            </button>
          ))}
        </div>

        {/* Daily mode sub-options */}
        {frequency === "daily" && (
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-label block">Dias da Semana</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "mon-fri" as DailyMode, label: "Seg → Sex", desc: "5 dias" },
                { value: "mon-sat" as DailyMode, label: "Seg → Sáb", desc: "6 dias" },
                { value: "mon-sun" as DailyMode, label: "Seg → Dom", desc: "7 dias" },
              ]).map(d => (
                <button
                  key={d.value}
                  onClick={() => setDailyMode(d.value)}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    dailyMode === d.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p className="text-xs font-semibold">{d.label}</p>
                  <p className="text-[9px]">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input form */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-shine">
        <div className="flex items-center justify-between">
          <label className="text-label block">Modo de Entrada</label>
          <div className="inline-flex bg-muted/40 rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setValueMode("rate")}
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-colors ${valueMode === "rate" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Por Taxa
            </button>
            <button
              type="button"
              onClick={() => { setValueMode("installment"); setLoanMode("installments"); }}
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-colors ${valueMode === "installment" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Por Valor da Parcela
            </button>
          </div>
        </div>

        <div>
          <label className="text-label mb-1.5 block">Valor do Empréstimo (R$)</label>
          <div className="relative">
            <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1.000" className={`${inputCls} pl-10`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {valueMode === "rate" ? (
            <div>
              <label className="text-label mb-1.5 block">
                Taxa de Juros (%)
                <span className="text-[9px] text-muted-foreground ml-1">
                  {frequency === "daily" ? "ao dia" : frequency === "weekly" ? "por semana" : "ao mês"}
                </span>
              </label>
              <div className="relative">
                <Percent size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="number" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="10" className={`${inputCls} pl-10`} />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-label mb-1.5 block">Valor da Parcela (R$)</label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="number" value={installmentValue} onChange={(e) => setInstallmentValue(e.target.value)} placeholder="120" className={`${inputCls} pl-10`} />
              </div>
              {calc && (calc as any).derivedRate !== undefined && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Taxa equivalente: {(calc as any).derivedRate.toFixed(2)}% por {calc.perPeriodLabel}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-label mb-1.5 block">
              {loanMode === "percentage" && valueMode === "rate" ? "Nº de Períodos (opcional)" : "Nº de Parcelas"}
            </label>
            <div className="relative">
              <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                placeholder={loanMode === "percentage" && valueMode === "rate" ? "Auto" : "10"}
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>
        </div>

        {/* Quick example text */}
        {valueMode === "rate" && valorNum > 0 && taxaNum > 0 && (
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              {loanMode === "percentage" && frequency === "monthly" && (
                <>💡 R$ {fmt(valorNum)} a {taxaNum}% ao mês = paga R$ {fmt(valorNum + valorNum * taxaNum / 100)} em 1 mês</>
              )}
              {loanMode === "percentage" && frequency === "daily" && !parcelasNum && (
                <>💡 R$ {fmt(valorNum)} a {taxaNum}% ao dia = paga R$ {fmt(valorNum * taxaNum / 100)}/dia até quitar (~{Math.ceil(100 / taxaNum)} dias)</>
              )}
              {loanMode === "percentage" && frequency === "daily" && parcelasNum > 0 && (
                <>💡 R$ {fmt(valorNum)} a {taxaNum}% por {parcelasNum} dias = R$ {fmt((valorNum + valorNum * taxaNum / 100 * parcelasNum) / parcelasNum)}/dia</>
              )}
              {loanMode === "percentage" && frequency === "weekly" && (
                <>💡 R$ {fmt(valorNum)} a {taxaNum}% por semana</>
              )}
              {loanMode === "installments" && parcelasNum > 0 && (
                <>💡 R$ {fmt(valorNum)} + {taxaNum}% × {parcelasNum} parcelas = {parcelasNum}x de R$ {fmt((valorNum + valorNum * taxaNum / 100 * parcelasNum) / parcelasNum)}</>
              )}
            </p>
          </div>
        )}
        {valueMode === "installment" && calc && (calc as any).derivedRate !== undefined && (
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              💡 R$ {fmt(valorNum)} em {parcelasNum}x de R$ {fmt(installmentNum)} ={" "}
              <strong className="text-foreground">{(calc as any).derivedRate.toFixed(2)}%</strong> por {calc.perPeriodLabel}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      {hasValue && calc && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Calculator size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Resultado da Simulação</h2>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Progress ring */}
              <div className="relative w-28 h-28 shrink-0">
                <svg className="progress-ring w-28 h-28" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" strokeWidth="6" stroke="hsl(var(--muted))" />
                  <circle
                    cx="48" cy="48" r="40" fill="none" strokeWidth="6"
                    stroke={lucroPercent > 50 ? "hsl(var(--success))" : "hsl(var(--primary))"}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={`${circumference * (1 - profitClamped / maxProfit)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{lucroPercent.toFixed(0)}%</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Lucro</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                {[
                  { label: "Juros Total", value: `R$ ${fmt(calc.jurosTotal)}`, color: "text-primary", icon: TrendingUp },
                  { label: "Total a Receber", value: `R$ ${fmt(calc.totalReceber)}`, color: "text-success", icon: DollarSign },
                  { label: `Valor/${calc.perPeriodLabel}`, value: `R$ ${fmt(calc.valorParcela)}`, color: "text-foreground", icon: Calculator },
                  { label: "Períodos", value: `${calc.numParcelas}x`, color: "text-primary", icon: Hash },
                ].map(r => (
                  <div key={r.label} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <r.icon size={12} className="text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{r.label}</p>
                    </div>
                    <p className={`text-lg font-bold ${r.color}`}>{r.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily mode info */}
            {frequency === "daily" && (
              <div className="mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
                <Calendar size={14} />
                Pagamentos: {dailyMode === "mon-fri" ? "Segunda a Sexta (5 dias/semana)" : dailyMode === "mon-sat" ? "Segunda a Sábado (6 dias/semana)" : "Segunda a Domingo (7 dias/semana)"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {hasValue && calc && (
        <AISimulatorInsights
          payload={{
            valor: valorNum, taxa: taxaNum, parcelas: parcelasNum,
            loanMode, frequency, dailyMode,
            totalReceber: calc.totalReceber, jurosTotal: calc.jurosTotal,
            valorParcela: calc.valorParcela, numParcelas: calc.numParcelas,
          }}
          onApplyScenario={(s) => {
            setTaxa(String(s.taxa));
            setParcelas(String(s.parcelas));
            setLoanMode("installments");
          }}
        />
      )}

      {/* CTA to create contract */}
      {hasValue && (
        <button
          onClick={() => navigate("/clientes/novo", { state: { valor, taxa, parcelas: calc?.numParcelas, loanMode, frequency, dailyMode } })}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground micro-press focus-ring animate-fade-in"
          style={{ background: "var(--gradient-button)" }}
        >
          <FileSignature size={16} /> Criar Contrato com Esses Valores <ArrowRight size={14} />
        </button>
      )}

      {/* Installment breakdown */}
      {hasValue && breakdown.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">Detalhamento dos Pagamentos</h2>
            <span className="text-xs text-muted-foreground">{breakdown.length} pagamentos</span>
          </div>
          <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
            {breakdown.map((item) => (
              <div key={item.num} className="data-row">
                <div className="num-badge bg-primary/8 text-primary">{item.num}</div>
                <span className="text-sm text-muted-foreground flex-1">{item.date}</span>
                <span className="text-sm font-semibold text-foreground">R$ {fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Simulador;
