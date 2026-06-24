import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, X, CheckCircle2, Loader2, Receipt, AlertCircle, Clock, SplitSquareHorizontal, CheckSquare, Square, Banknote } from "lucide-react";
import { formatBR, parseLocalDate } from "@/lib/dateUtils";

interface Props { open: boolean; onClose: () => void; }

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PaymentMethod = "pix" | "cash" | "card" | "transfer" | "boleto";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "card", label: "Cartão" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

const QuickPaymentModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [partialFor, setPartialFor] = useState<string | null>(null);
  const [partialValue, setPartialValue] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [bulkSaving, setBulkSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setSelected(new Set());
      setPartialFor(null);
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

  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = filtered.map((i: any) => i.id);
    const allSelected = allIds.every((id: string) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id: string) => next.delete(id));
      else allIds.forEach((id: string) => next.add(id));
      return next;
    });
  };

  const selectedInstallments = useMemo(
    () => (installments || []).filter((i: any) => selected.has(i.id)),
    [installments, selected]
  );
  const selectedTotal = useMemo(
    () => selectedInstallments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
    [selectedInstallments]
  );

  const handlePay = async (id: string, amount: number) => {
    setSaving(id);
    const { error } = await supabase.from("contract_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: amount, payment_method: method })
      .eq("id", id);
    setSaving(null);
    if (error) { toast.error("Erro ao registrar pagamento"); return; }
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    toast.success(`Pagamento registrado · ${METHODS.find(m => m.value === method)?.label}`, {
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

  const handleBulkPay = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const items = (installments || []).filter((i: any) => selected.has(i.id));
    setBulkSaving(true);
    const nowIso = new Date().toISOString();
    const updates = await Promise.all(items.map((i: any) =>
      supabase.from("contract_installments")
        .update({ status: "paid", paid_at: nowIso, paid_amount: Number(i.amount), payment_method: method })
        .eq("id", i.id)
    ));
    setBulkSaving(false);
    const failed = updates.filter((r) => r.error).length;
    if (failed > 0) { toast.error(`${failed} pagamento(s) falharam`); }
    if (failed < items.length) {
      toast.success(`${items.length - failed} parcela(s) quitadas · ${METHODS.find(m => m.value === method)?.label}`, {
        action: {
          label: "Desfazer",
          onClick: async () => {
            await Promise.all(items.map((i: any) =>
              supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", i.id)
            ));
            qc.invalidateQueries({ queryKey: ["quick-pay-installments"] });
            qc.invalidateQueries({ queryKey: ["hoje"] });
            toast.success("Desfeito");
          }
        }
      });
    }
    setSelected(new Set());
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
      .update({ amount: newRemaining, paid_amount: accumulated, payment_method: method })
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
      } else if (e.key === " " && filtered[activeIdx] && document.activeElement === inputRef.current) {
        e.preventDefault();
        toggleSelect(filtered[activeIdx].id);
      } else if (e.key === "Enter" && filtered[activeIdx] && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (selected.size > 0) handleBulkPay();
        else {
          const inst = filtered[activeIdx];
          handlePay(inst.id, Number(inst.amount));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIdx, onClose, selected, method]);

  if (!open) return null;

  const today = new Date(); today.setHours(0,0,0,0);
  const allVisibleSelected = filtered.length > 0 && filtered.every((i: any) => selected.has(i.id));

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
        className="fixed inset-x-0 top-[5vh] mx-auto w-[calc(100vw-1rem)] sm:w-full max-w-2xl z-[61] px-0 sm:px-4 animate-scale-in"
      >
        <div className="rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Receipt size={16} className="text-primary" />
            <div className="flex-1">
              <h2 id="quick-pay-title" className="text-xs font-bold text-foreground">Registrar pagamento</h2>
              <p className="text-[10px] text-muted-foreground">
                Espaço marca · Enter paga · ↑↓ navega · Esc fecha
              </p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {/* Payment method + search */}
          <div className="px-4 py-3 border-b border-border/30 space-y-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <Banknote size={12} className="text-muted-foreground shrink-0 mr-1" />
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors ${
                    method === m.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome do cliente ou CPF..."
                className="w-full h-10 pl-9 pr-9 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground">
                  <X size={12} />
                </button>
              )}
            </div>
            {filtered.length > 0 && (
              <button
                onClick={selectAllVisible}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                {allVisibleSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                {allVisibleSelected ? "Desmarcar todas" : "Selecionar todas visíveis"}
              </button>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {isLoading && (
              <div className="py-12 text-center"><Loader2 size={20} className="mx-auto animate-spin text-muted-foreground" /></div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center">
                <CheckCircle2 size={28} className="mx-auto text-success/50 mb-2" />
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
              const isSelected = selected.has(inst.id);
              return (
                <div key={inst.id}>
                <div
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`px-4 py-3 flex items-center gap-3 border-b border-border/20 transition-colors ${
                    isSelected ? "bg-primary/10" : isActive ? "bg-accent/30 ring-1 ring-primary/20" : "hover:bg-accent/20"
                  }`}
                >
                  <button
                    onClick={() => toggleSelect(inst.id)}
                    aria-label={isSelected ? "Desmarcar parcela" : "Marcar parcela"}
                    className="shrink-0 text-primary hover:scale-110 transition-transform"
                  >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-muted-foreground" />}
                  </button>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isOverdue ? "bg-destructive/10 text-destructive" :
                    isToday ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isOverdue ? <AlertCircle size={14} /> : <Clock size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{inst.clients?.name || "Cliente"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Parcela {inst.installment_number} · {formatBR(inst.due_date)}
                      {isOverdue && <span className="text-destructive font-bold ml-1">· ATRASADO</span>}
                      {isToday && <span className="text-primary font-bold ml-1">· HOJE</span>}
                      {Number(inst.paid_amount || 0) > 0 && (
                        <span className="text-warning font-bold ml-1">· PARCIAL R$ {fmtBRL(Number(inst.paid_amount))}</span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0">
                    R$ {fmtBRL(Number(inst.amount))}
                  </p>
                  <button
                    onClick={() => { setPartialFor(partialFor === inst.id ? null : inst.id); setPartialValue(""); }}
                    title="Pagamento parcial"
                    className="px-2 py-1.5 rounded-lg bg-muted text-foreground text-[11px] font-bold hover:bg-accent transition-colors flex items-center gap-1 shrink-0"
                  >
                    <SplitSquareHorizontal size={11} />
                    Parcial
                  </button>
                  <button
                    onClick={() => handlePay(inst.id, Number(inst.amount))}
                    disabled={saving === inst.id}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    {saving === inst.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Pagar
                  </button>
                </div>
                {partialFor === inst.id && (
                  <div className="px-4 py-2 bg-muted/30 border-b border-border/20 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">Valor pago agora:</span>
                    <div className="relative flex-1 max-w-[160px]">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">R$</span>
                      <input
                        type="number" step="0.01" min="0" max={Number(inst.amount)} autoFocus
                        value={partialValue}
                        onChange={(e) => setPartialValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePartial(inst); } }}
                        placeholder="0,00"
                        className="w-full h-8 pl-8 pr-2 rounded-md bg-background border border-border text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">de R$ {fmtBRL(Number(inst.amount))}</span>
                    <button onClick={() => handlePartial(inst)} disabled={saving === inst.id}
                      className="ml-auto px-3 py-1.5 rounded-md bg-success text-success-foreground text-[11px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                      {saving === inst.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      Confirmar
                    </button>
                    <button onClick={() => { setPartialFor(null); setPartialValue(""); }}
                      className="px-2 py-1.5 rounded-md hover:bg-accent text-muted-foreground text-[11px]">Cancelar</button>
                  </div>
                )}
                </div>
              );
            })}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 ? (
            <div className="px-4 py-3 border-t border-border bg-primary/5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">
                  {selected.size} parcela{selected.size !== 1 ? "s" : ""} selecionada{selected.size !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Total: <span className="font-bold text-foreground">R$ {fmtBRL(selectedTotal)}</span> · via {METHODS.find(m => m.value === method)?.label}
                </p>
              </div>
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-2 rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-accent"
              >
                Limpar
              </button>
              <button
                onClick={handleBulkPay}
                disabled={bulkSaving}
                className="px-4 py-2 rounded-lg bg-success text-success-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-md"
              >
                {bulkSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Quitar tudo
              </button>
            </div>
          ) : (
            <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground/80 flex items-center justify-between">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">␣</kbd> marca ·
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono ml-1">Enter</kbd> paga
              </span>
              <span>{filtered.length} parcela{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default QuickPaymentModal;
