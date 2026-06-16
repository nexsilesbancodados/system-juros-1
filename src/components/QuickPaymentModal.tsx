import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, X, CheckCircle2, Loader2, Receipt, AlertCircle, Clock, SplitSquareHorizontal } from "lucide-react";
import { formatBR, parseLocalDate } from "@/lib/dateUtils";

interface Props { open: boolean; onClose: () => void; }

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const QuickPaymentModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [partialFor, setPartialFor] = useState<string | null>(null);
  const [partialValue, setPartialValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const { data: installments, isLoading } = useQuery({
    queryKey: ["quick-pay-installments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("contract_installments")
        .select("id, amount, paid_amount, due_date, installment_number, client_id, contract_id, clients:client_id(name, cpf_cnpj), contracts:contract_id(capital)")
        .eq("user_id", user.id).eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(200);
      return data || [];
    },
    enabled: !!user && open,
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    if (!installments) return [];
    const q = query.trim().toLowerCase();
    if (!q) return installments.slice(0, 20);
    return installments.filter((i: any) =>
      (i.clients?.name || "").toLowerCase().includes(q) ||
      (i.clients?.cpf_cnpj || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [installments, query]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll active row into view
  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handlePay = async (id: string, amount: number) => {
    setSaving(id);
    const { error } = await supabase.from("contract_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: amount })
      .eq("id", id);
    setSaving(null);
    if (error) { toast.error("Erro ao registrar pagamento"); return; }
    toast.success("Pagamento registrado", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          await supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", id);
          qc.invalidateQueries({ queryKey: ["quick-pay-installments"] });
          qc.invalidateQueries({ queryKey: ["hoje"] });
          toast.success("Desfeito");
        }
      }
    });
    qc.invalidateQueries({ queryKey: ["quick-pay-installments"] });
    qc.invalidateQueries({ queryKey: ["hoje"] });
  };

  const handlePartial = async (inst: any) => {
    const paidNow = Number(String(partialValue).replace(",", "."));
    const remaining = Number(inst.amount);
    if (!paidNow || paidNow <= 0) { toast.error("Informe um valor válido"); return; }
    if (paidNow >= remaining) {
      await handlePay(inst.id, remaining);
      setPartialFor(null); setPartialValue("");
      return;
    }
    setSaving(inst.id);
    const newRemaining = +(remaining - paidNow).toFixed(2);
    const accumulated = +(Number(inst.paid_amount || 0) + paidNow).toFixed(2);
    const { error } = await supabase.from("contract_installments")
      .update({ amount: newRemaining, paid_amount: accumulated })
      .eq("id", inst.id);
    setSaving(null);
    if (error) { toast.error("Erro ao registrar pagamento parcial"); return; }
    toast.success(`Parcial: R$ ${fmtBRL(paidNow)} · Resta R$ ${fmtBRL(newRemaining)}`, {
      action: {
        label: "Desfazer",
        onClick: async () => {
          await supabase.from("contract_installments")
            .update({ amount: remaining, paid_amount: Number(inst.paid_amount || 0) || null })
            .eq("id", inst.id);
          qc.invalidateQueries({ queryKey: ["quick-pay-installments"] });
          qc.invalidateQueries({ queryKey: ["hoje"] });
          toast.success("Desfeito");
        }
      }
    });
    setPartialFor(null); setPartialValue("");
    qc.invalidateQueries({ queryKey: ["quick-pay-installments"] });
    qc.invalidateQueries({ queryKey: ["hoje"] });
  };

  // Keyboard navigation: Esc closes, ArrowUp/Down navigate, Enter pays active
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && filtered[activeIdx] && document.activeElement === inputRef.current) {
        e.preventDefault();
        const inst = filtered[activeIdx];
        handlePay(inst.id, Number(inst.amount));
      } else if (e.key === "Tab") {
        // Simple focus trap within dialog
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIdx, onClose]);

  if (!open) return null;

  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-pay-title"
        aria-describedby="quick-pay-desc"
        className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[61] px-4 animate-scale-in"
      >
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Receipt size={16} className="text-primary" aria-hidden="true" />
            <div className="flex-1">
              <h2 id="quick-pay-title" className="text-xs font-bold text-foreground">Registrar pagamento</h2>
              <p id="quick-pay-desc" className="text-[10px] text-muted-foreground">
                Busque por nome ou CPF · ↑↓ navega · Enter paga · Esc fecha
              </p>
            </div>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono" aria-hidden="true">ESC</kbd>
            <button
              onClick={onClose}
              aria-label="Fechar modal de pagamento"
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-border/30">
            <label htmlFor="quick-pay-search" className="sr-only">Buscar parcela por nome do cliente ou CPF</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <input
                ref={inputRef}
                id="quick-pay-search"
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls="quick-pay-list"
                aria-activedescendant={filtered[activeIdx] ? `qpay-item-${filtered[activeIdx].id}` : undefined}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome do cliente ou CPF..."
                className="w-full h-10 pl-9 pr-9 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div
            id="quick-pay-list"
            role="listbox"
            aria-label="Parcelas pendentes"
            className="max-h-[55vh] overflow-y-auto"
          >
            {isLoading && (
              <div className="py-12 text-center" role="status" aria-live="polite">
                <Loader2 size={20} className="mx-auto animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Carregando parcelas</span>
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center" role="status">
                <CheckCircle2 size={28} className="mx-auto text-success/50 mb-2" aria-hidden="true" />
                <p className="text-sm text-foreground font-semibold">Nada pendente</p>
                <p className="text-[11px] text-muted-foreground">{query ? "Nenhuma parcela encontrada" : "Todas as parcelas estão pagas"}</p>
              </div>
            )}
            {filtered.map((inst: any, idx: number) => {
              const due = parseLocalDate(inst.due_date) ?? new Date(inst.due_date);
              const isOverdue = due < today;
              const t0 = new Date(); t0.setHours(0,0,0,0);
              const isToday = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() === t0.getTime();
              const isActive = idx === activeIdx;
              const status = isOverdue ? "atrasada" : isToday ? "vence hoje" : "pendente";
              return (
                <div key={inst.id}>
                <div
                  ref={(el) => (itemRefs.current[idx] = el)}
                  id={`qpay-item-${inst.id}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`px-4 py-3 flex items-center gap-3 border-b border-border/20 transition-colors ${
                    isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isOverdue ? "bg-destructive/10 text-destructive" :
                    isToday ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`} aria-hidden="true">
                    {isOverdue ? <AlertCircle size={14} /> : <Clock size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{inst.clients?.name || "Cliente"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Parcela {inst.installment_number} · {formatBR(inst.due_date)}
                      {inst.contract_id && (
                        <span className="ml-1 px-1 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]" title={`Contrato ${inst.contract_id}`}>
                          #{String(inst.contract_id).slice(0, 6)}
                          {inst.contracts?.capital ? ` · R$ ${fmtBRL(Number(inst.contracts.capital))}` : ""}
                        </span>
                      )}
                      {isOverdue && <span className="text-destructive font-bold ml-1">· ATRASADO</span>}
                      {isToday && <span className="text-primary font-bold ml-1">· HOJE</span>}
                      {Number(inst.paid_amount || 0) > 0 && (
                        <span className="text-warning font-bold ml-1">· PARCIAL pago R$ {fmtBRL(Number(inst.paid_amount))}</span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0" aria-label={`Valor R$ ${fmtBRL(Number(inst.amount))}`}>
                    R$ {fmtBRL(Number(inst.amount))}
                  </p>
                  <button
                    onClick={() => { setPartialFor(partialFor === inst.id ? null : inst.id); setPartialValue(""); }}
                    aria-label="Pagamento parcial"
                    title="Pagamento parcial"
                    className="px-2 py-1.5 rounded-lg bg-muted text-foreground text-[11px] font-bold hover:bg-accent transition-colors flex items-center gap-1 shrink-0"
                  >
                    <SplitSquareHorizontal size={11} aria-hidden="true" />
                    Parcial
                  </button>
                  <button
                    onClick={() => handlePay(inst.id, Number(inst.amount))}
                    disabled={saving === inst.id}
                    aria-label={`Pagar parcela ${inst.installment_number} de ${inst.clients?.name || "cliente"}, ${status}, R$ ${fmtBRL(Number(inst.amount))}`}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    {saving === inst.id ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={11} aria-hidden="true" />}
                    Pagar
                  </button>
                </div>
                {partialFor === inst.id && (
                  <div className="px-4 py-2 bg-muted/30 border-b border-border/20 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Valor pago agora:</span>
                    <div className="relative flex-1 max-w-[160px]">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Number(inst.amount)}
                        autoFocus
                        value={partialValue}
                        onChange={(e) => setPartialValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePartial(inst); } }}
                        placeholder="0,00"
                        className="w-full h-8 pl-8 pr-2 rounded-md bg-background border border-border text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">de R$ {fmtBRL(Number(inst.amount))}</span>
                    <button
                      onClick={() => handlePartial(inst)}
                      disabled={saving === inst.id}
                      className="ml-auto px-3 py-1.5 rounded-md bg-success text-success-foreground text-[11px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving === inst.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Confirmar
                    </button>
                    <button
                      onClick={() => { setPartialFor(null); setPartialValue(""); }}
                      className="px-2 py-1.5 rounded-md hover:bg-accent text-muted-foreground text-[11px]"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground/80 flex items-center justify-between">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑↓</kbd> navegar ·
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono ml-1">Enter</kbd> pagar
            </span>
            <span aria-live="polite">{filtered.length} parcela{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickPaymentModal;
