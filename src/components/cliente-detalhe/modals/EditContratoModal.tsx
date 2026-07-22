import { X } from "lucide-react";
import { INPUT, FREQ } from "../constants";

type Props = {
  form: any;
  setForm: (v: any) => void;
  regen: boolean;
  setRegen: (v: boolean) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function EditContratoModal({ form, setForm, regen, setRegen, saving, onClose, onSave }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Editar Empréstimo</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital (R$)</label>
            <input type="number" step="0.01" value={form.capital} onChange={e => setForm({ ...form, capital: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Taxa (%)</label>
            <input type="number" step="0.1" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº Parcelas</label>
            <input type="number" value={form.num_installments} onChange={e => setForm({ ...form, num_installments: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor parcela (R$)</label>
            <input type="number" step="0.01" value={form.installment_amount} onChange={e => setForm({ ...form, installment_amount: e.target.value })} className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequência</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(FREQ).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, frequency: v })}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${form.frequency === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">1º Vencimento</label>
            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Diária (%)</label>
            <input type="number" step="0.01" value={form.daily_interest_percent} onChange={e => setForm({ ...form, daily_interest_percent: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Multa Mensal (%)</label>
            <input type="number" step="0.1" value={form.late_fee_percent} onChange={e => setForm({ ...form, late_fee_percent: e.target.value })} className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={INPUT + " min-h-[60px]"} />
          </div>
        </div>
        <label className="flex items-start gap-2 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer">
          <input type="checkbox" checked={regen} onChange={e => setRegen(e.target.checked)} className="mt-0.5" />
          <span className="text-xs text-foreground">
            <strong>Regenerar parcelas pendentes</strong>
            <span className="block text-muted-foreground mt-0.5">Mantém as parcelas já pagas e recria as restantes com os novos valores e datas.</span>
          </span>
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
