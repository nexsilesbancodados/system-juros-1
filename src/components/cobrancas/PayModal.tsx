import { useState, useMemo } from "react";
import { CheckCircle, CalendarDays, AlertTriangle } from "lucide-react";
import { formatBR } from "@/lib/dateUtils";
import type { LateFeeBreakdown } from "@/lib/lateFee";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  inst: any;
  fee: LateFeeBreakdown;
  alreadyPaid: number;
  remaining: number;
  daysLate: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
}

const PayModal = ({ inst, fee, alreadyPaid, remaining, daysLate, onCancel, onConfirm }: Props) => {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [raw, setRaw] = useState<string>(remaining.toFixed(2).replace(".", ","));

  const value = useMemo(() => {
    const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [raw]);

  const finalValue = mode === "full" ? remaining : value;
  const isPartial = mode === "partial" && value > 0 && value + 0.005 < remaining;
  const restAfter = Math.max(0, Math.round((remaining - finalValue) * 100) / 100);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content max-w-md w-full p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-success" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Registrar Pagamento</h3>
          <p className="text-sm font-medium text-foreground mt-2">{inst.client_name}</p>
          <p className="text-xs text-muted-foreground">Parcela #{inst.installment_number}</p>
        </div>

        {/* Detalhes */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays size={14} /> Vencimento</span>
            <span className="text-foreground font-medium">{formatBR(inst.due_date)}</span>
          </div>
          {daysLate > 0 && (
            <div className="flex items-center justify-between text-destructive">
              <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> Atraso</span>
              <span className="font-semibold">{daysLate} dia{daysLate === 1 ? "" : "s"}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Valor sem multa</span>
            <span className="text-foreground font-medium">R$ {fmt(fee.base)}</span>
          </div>
          {fee.multa > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Multa{fee.multaPct ? ` (${fee.multaPct}%)` : ""}</span>
              <span className="text-destructive font-medium">+ R$ {fmt(fee.multa)}</span>
            </div>
          )}
          {fee.juros > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Juros{fee.jurosPct ? ` (${fee.jurosPct}%/dia × ${fee.daysLate}d)` : ""}</span>
              <span className="text-destructive font-medium">+ R$ {fmt(fee.juros)}</span>
            </div>
          )}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-foreground font-semibold">Total com multa</span>
            <span className="text-foreground font-bold">R$ {fmt(fee.withFees)}</span>
          </div>
          {alreadyPaid > 0 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Já pago</span>
                <span className="text-success font-medium">− R$ {fmt(alreadyPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-primary font-semibold">Restante</span>
                <span className="text-primary font-bold">R$ {fmt(remaining)}</span>
              </div>
            </>
          )}
        </div>

        {/* Modo */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setMode("full"); setRaw(remaining.toFixed(2).replace(".", ",")); }}
            className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === "full" ? "bg-success text-success-foreground" : "border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            Quitar total
          </button>
          <button
            onClick={() => setMode("partial")}
            className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === "partial" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            Pagamento parcial
          </button>
        </div>

        {mode === "partial" && (
          <div>
            <label className="text-xs text-muted-foreground font-medium">Valor recebido</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
              <span className="text-muted-foreground text-sm">R$</span>
              <input
                autoFocus
                inputMode="decimal"
                value={raw}
                onChange={(e) => setRaw(e.target.value.replace(/[^\d,.]/g, ""))}
                className="flex-1 bg-transparent outline-none text-foreground text-base font-semibold"
                placeholder="0,00"
              />
            </div>
            {isPartial && (
              <p className="mt-1.5 text-xs text-warning">
                Ficarão pendentes R$ {fmt(restAfter)} — a parcela permanece em aberto.
              </p>
            )}
            {value > remaining && (
              <p className="mt-1.5 text-xs text-destructive">Valor maior que o restante — será quitada.</p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
          <button
            onClick={() => onConfirm(finalValue)}
            disabled={finalValue <= 0}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar R$ {fmt(finalValue)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayModal;
