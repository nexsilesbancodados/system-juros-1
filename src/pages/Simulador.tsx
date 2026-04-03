import { useState, useMemo } from "react";
import { Calculator, DollarSign, TrendingUp, Percent, Hash, FileSignature, ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Simulador = () => {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("");
  const [parcelas, setParcelas] = useState("");
  const navigate = useNavigate();

  const valorNum = parseFloat(valor) || 0;
  const taxaNum = parseFloat(taxa) || 0;
  const parcelasNum = parseInt(parcelas) || 1;

  const jurosTotal = valorNum * (taxaNum / 100) * parcelasNum;
  const totalReceber = valorNum + jurosTotal;
  const valorParcela = parcelasNum > 0 ? totalReceber / parcelasNum : 0;
  const lucroPercent = valorNum > 0 ? (jurosTotal / valorNum) * 100 : 0;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Quick presets
  const presets = [
    { label: "R$ 500", valor: "500", taxa: "10", parcelas: "5" },
    { label: "R$ 1.000", valor: "1000", taxa: "10", parcelas: "10" },
    { label: "R$ 5.000", valor: "5000", taxa: "8", parcelas: "12" },
    { label: "R$ 10.000", valor: "10000", taxa: "5", parcelas: "24" },
  ];

  const applyPreset = (p: typeof presets[0]) => {
    setValor(p.valor); setTaxa(p.taxa); setParcelas(p.parcelas);
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced";

  const hasValue = valorNum > 0 && parcelasNum > 0;

  // Progress ring for profit visualization
  const maxProfit = 200;
  const profitClamped = Math.min(lucroPercent, maxProfit);
  const circumference = 2 * Math.PI * 40;

  return (
    <div className="space-y-5 max-w-2xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator size={24} className="text-primary" /> Simulador
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Calcule juros e parcelas antes de criar um contrato.</p>
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

      {/* Input form */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-shine">
        <div>
          <label className="text-label mb-1.5 block">Valor do Empréstimo (R$)</label>
          <div className="relative">
            <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="10.000" className={`${inputCls} pl-10`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-label mb-1.5 block">Taxa de Juros (%)</label>
            <div className="relative">
              <Percent size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="number" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="10" className={`${inputCls} pl-10`} />
            </div>
          </div>
          <div>
            <label className="text-label mb-1.5 block">Nº de Parcelas</label>
            <div className="relative">
              <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="12" className={`${inputCls} pl-10`} />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
                { label: "Juros Total", value: `R$ ${fmt(jurosTotal)}`, color: "text-primary", icon: TrendingUp },
                { label: "Total a Receber", value: `R$ ${fmt(totalReceber)}`, color: "text-success", icon: DollarSign },
                { label: "Valor Parcela", value: `R$ ${fmt(valorParcela)}`, color: "text-foreground", icon: Calculator },
                { label: "Lucro (%)", value: `${lucroPercent.toFixed(1)}%`, color: "text-primary", icon: Percent },
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
        </div>
      </div>

      {/* CTA to create contract */}
      {hasValue && (
        <button
          onClick={() => navigate("/novo-contrato")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground micro-press focus-ring animate-fade-in"
          style={{ background: "var(--gradient-button)" }}
        >
          <FileSignature size={16} /> Criar Contrato com Esses Valores <ArrowRight size={14} />
        </button>
      )}

      {/* Installment breakdown */}
      {hasValue && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">Detalhamento das Parcelas</h2>
            <span className="text-xs text-muted-foreground">{Math.min(parcelasNum, 60)} parcelas</span>
          </div>
          <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
            {Array.from({ length: Math.min(parcelasNum, 60) }, (_, i) => (
              <div key={i} className="data-row">
                <div className="num-badge bg-primary/8 text-primary">{i + 1}</div>
                <span className="text-sm text-muted-foreground flex-1">Parcela {i + 1}</span>
                <span className="text-sm font-semibold text-foreground">R$ {fmt(valorParcela)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Simulador;
