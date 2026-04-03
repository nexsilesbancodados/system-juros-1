import { useState } from "react";
import { Calculator, DollarSign, TrendingUp, Percent, Hash } from "lucide-react";

const Simulador = () => {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("");
  const [parcelas, setParcelas] = useState("");

  const valorNum = parseFloat(valor) || 0;
  const taxaNum = parseFloat(taxa) || 0;
  const parcelasNum = parseInt(parcelas) || 1;

  const jurosTotal = valorNum * (taxaNum / 100) * parcelasNum;
  const totalReceber = valorNum + jurosTotal;
  const valorParcela = parcelasNum > 0 ? totalReceber / parcelasNum : 0;
  const lucroPercent = valorNum > 0 ? (jurosTotal / valorNum) * 100 : 0;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Simulador de Empréstimo</h1>
        <p className="text-muted-foreground text-sm mt-1">Calcule juros e parcelas antes de criar um contrato.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Valor do Empréstimo (R$)</label>
          <div className="relative">
            <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="10.000" className={`${inputCls} pl-10`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Taxa de Juros (%)</label>
            <div className="relative">
              <Percent size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="number" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="10" className={`${inputCls} pl-10`} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Nº de Parcelas</label>
            <div className="relative">
              <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="12" className={`${inputCls} pl-10`} />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><Calculator size={18} className="text-primary" /> Resultado da Simulação</h2>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border">
          {[
            { label: "Juros Total", value: `R$ ${fmt(jurosTotal)}`, icon: <TrendingUp size={16} />, accent: "text-primary" },
            { label: "Total a Receber", value: `R$ ${fmt(totalReceber)}`, icon: <DollarSign size={16} />, accent: "text-success" },
            { label: "Valor da Parcela", value: `R$ ${fmt(valorParcela)}`, icon: <Calculator size={16} />, accent: "text-foreground" },
            { label: "Lucro (%)", value: `${lucroPercent.toFixed(1)}%`, icon: <Percent size={16} />, accent: "text-primary" },
          ].map(r => (
            <div key={r.label} className="bg-card p-5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{r.icon}</span>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{r.label}</p>
              </div>
              <p className={`text-2xl font-bold ${r.accent}`}>{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Installment breakdown */}
      {valorNum > 0 && parcelasNum > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Detalhamento das Parcelas</h2>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {Array.from({ length: Math.min(parcelasNum, 60) }, (_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</span>
                  <span className="text-sm text-muted-foreground">Parcela {i + 1}</span>
                </div>
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
