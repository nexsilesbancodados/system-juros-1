import { useState } from "react";
import { Calculator } from "lucide-react";

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

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Simulador de Empréstimo</h1>
        <p className="text-muted-foreground text-sm mt-1">Calcule juros e parcelas de empréstimos.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Valor do Empréstimo (R$)</label>
          <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Taxa de Juros (%)</label>
          <input type="number" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Nº de Parcelas</label>
          <input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="1" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Calculator size={18} /> Resultado</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Juros Total</p>
            <p className="text-xl font-bold text-foreground">R$ {jurosTotal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total a Receber</p>
            <p className="text-xl font-bold text-green-400">R$ {totalReceber.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor da Parcela</p>
            <p className="text-xl font-bold text-foreground">R$ {valorParcela.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lucro (%)</p>
            <p className="text-xl font-bold text-foreground">{valorNum > 0 ? ((jurosTotal / valorNum) * 100).toFixed(1) : "0"}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulador;
