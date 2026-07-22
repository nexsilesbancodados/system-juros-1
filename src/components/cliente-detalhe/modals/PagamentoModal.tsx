import { X } from "lucide-react";
import { INPUT, fmt } from "../constants";

type Props = {
  inst: any;
  amount: string;
  setAmount: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  receiptFile: File | null;
  setReceiptFile: (f: File | null) => void;
  uploading: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const METHODS = [
  { v: "pix", l: "PIX" },
  { v: "dinheiro", l: "Dinheiro" },
  { v: "transferencia", l: "Transf." },
  { v: "outro", l: "Outro" },
];

export default function PagamentoModal(p: Props) {
  const close = () => { if (!p.uploading) { p.onClose(); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={close}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Pagamento</h2>
          <button onClick={close} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Parcela #{p.inst.installment_number}</p>
          <p className="text-lg font-bold text-foreground">R$ {fmt(Number(p.inst.amount))}</p>
          {Number(p.inst.paid_amount || 0) > 0 && <p className="text-xs text-success">Já pago: R$ {fmt(Number(p.inst.paid_amount))}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label>
          <input type="number" step="0.01" value={p.amount} onChange={e => p.setAmount(e.target.value)} placeholder={fmt(Number(p.inst.amount))} className={INPUT} autoFocus />
        </div>
        <div className="flex gap-2">
          <button onClick={() => p.setAmount(String(p.inst.amount))} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">Total</button>
          <button onClick={() => p.setAmount(String(Number(p.inst.amount) / 2))} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent">Metade</button>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Forma de pagamento</label>
          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map(opt => (
              <button key={opt.v} type="button" onClick={() => p.setMethod(opt.v)}
                className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${p.method === opt.v ? "bg-primary/15 border-primary text-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Comprovante (opcional)</label>
          <input type="file" accept="image/*,application/pdf" onChange={e => p.setReceiptFile(e.target.files?.[0] || null)}
            aria-label="Comprovante de pagamento"
            className="w-full text-xs text-muted-foreground file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-card file:text-xs file:font-medium file:text-foreground file:cursor-pointer" />
          {p.receiptFile && <p className="text-[10px] text-muted-foreground mt-1 truncate">📎 {p.receiptFile.name}</p>}
        </div>
        <button onClick={p.onSubmit} disabled={!p.amount || parseFloat(p.amount) <= 0 || p.uploading}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
          {p.uploading ? "Enviando..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
