import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, X, CheckCircle2, Loader2, Receipt, AlertCircle, Clock } from "lucide-react";

interface Props { open: boolean; onClose: () => void; }

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const QuickPaymentModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const { data: installments, isLoading } = useQuery({
    queryKey: ["quick-pay-installments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("contract_installments")
        .select("id, amount, due_date, installment_number, client_id, clients:client_id(name, cpf_cnpj)")
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

  if (!open) return null;

  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-fade-in" onClick={onClose} />
      <div className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[61] px-4 animate-scale-in">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <Receipt size={16} className="text-primary" />
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">Registrar pagamento</p>
              <p className="text-[10px] text-muted-foreground">Busque por nome ou CPF</p>
            </div>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">ESC</kbd>
          </div>

          <div className="px-4 py-3 border-b border-border/30">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome do cliente ou CPF..."
                className="w-full h-10 pl-9 pr-9 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            {isLoading && (
              <div className="py-12 text-center">
                <Loader2 size={20} className="mx-auto animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center">
                <CheckCircle2 size={28} className="mx-auto text-success/50 mb-2" />
                <p className="text-sm text-foreground font-semibold">Nada pendente</p>
                <p className="text-[11px] text-muted-foreground">{query ? "Nenhuma parcela encontrada" : "Todas as parcelas estão pagas"}</p>
              </div>
            )}
            {filtered.map((inst: any) => {
              const due = new Date(inst.due_date);
              const isOverdue = due < today;
              const isToday = due.toDateString() === new Date().toDateString();
              return (
                <div key={inst.id} className="px-4 py-3 flex items-center gap-3 border-b border-border/20 hover:bg-accent/20 transition-colors">
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
                      Parcela {inst.installment_number} · {due.toLocaleDateString("pt-BR")}
                      {isOverdue && <span className="text-destructive font-bold ml-1">· ATRASADO</span>}
                      {isToday && <span className="text-primary font-bold ml-1">· HOJE</span>}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0">R$ {fmtBRL(Number(inst.amount))}</p>
                  <button
                    onClick={() => handlePay(inst.id, Number(inst.amount))}
                    disabled={saving === inst.id}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    {saving === inst.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Pagar
                  </button>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground/60 flex items-center justify-between">
            <span>Atalho global: <kbd className="px-1 py-0.5 rounded bg-muted font-mono">p</kbd></span>
            <span>{filtered.length} parcela{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickPaymentModal;
