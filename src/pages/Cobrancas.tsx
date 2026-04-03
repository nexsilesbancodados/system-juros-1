import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Check, MessageSquare, Search, X, AlertTriangle, Clock, CheckCircle, DollarSign, Send, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const Cobrancas = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "paid">("all");
  const [search, setSearch] = useState("");
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);

  const { data: installments = [], isLoading: loading } = useQuery({
    queryKey: ["cobrancas-installments", user?.id],
    queryFn: async () => {
      const { data: clients } = await supabase.from("clients").select("id, name, phone, whatsapp").eq("user_id", user!.id);
      const clientMap = new Map((clients || []).map((c: any) => [c.id, { name: c.name, phone: c.whatsapp || c.phone }]));

      const { data } = await supabase
        .from("contract_installments")
        .select("*, contracts(capital, frequency, interest_rate)")
        .eq("user_id", user!.id)
        .order("due_date", { ascending: true });

      const now = new Date();
      return (data || []).map((inst: any) => {
        const client = clientMap.get(inst.client_id);
        const isOverdue = inst.status === "pending" && new Date(inst.due_date) < now;
        return {
          ...inst,
          status: isOverdue ? "overdue" : inst.status,
          client_name: client?.name || "—",
          client_phone: client?.phone || null,
        };
      });
    },
    enabled: !!user,
  });

  const handleMarkPaid = async (id: string) => {
    const inst = installments.find((i: any) => i.id === id);
    if (!inst || !user) return;

    const { error } = await supabase.from("contract_installments").update({
      status: "paid", paid_at: new Date().toISOString(), paid_amount: inst.amount,
    }).eq("id", id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    // Register profit (interest portion)
    const contract = inst.contracts;
    if (contract) {
      const interestRate = Number(contract.interest_rate || 0) / 100;
      const interestPortion = Number(inst.amount) * (interestRate / (1 + interestRate));
      if (interestPortion > 0) {
        await supabase.from("profits").insert({
          user_id: user.id, amount: interestPortion,
          description: `Juros parcela #${inst.installment_number} - ${inst.client_name}`,
          client_id: inst.client_id,
        });
      }
    }

    // Register transaction
    await supabase.from("transactions").insert({
      user_id: user.id, amount: Number(inst.amount), type: "payment",
      description: `Pagamento parcela #${inst.installment_number} - ${inst.client_name}`,
      client_id: inst.client_id, contract_id: inst.contract_id,
    });

    // Check if all installments for this contract are paid
    const { data: remaining } = await supabase
      .from("contract_installments")
      .select("id")
      .eq("contract_id", inst.contract_id)
      .neq("status", "paid");

    if (remaining && remaining.length === 0) {
      await supabase.from("contracts").update({ status: "completed" }).eq("id", inst.contract_id);
    }

    toast({ title: "✓ Parcela marcada como paga!" });
    setConfirmPayId(null);
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const handleWhatsApp = (inst: any) => {
    if (!inst.client_phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const phone = inst.client_phone.replace(/\D/g, "");
    const billingTemplate = profile?.billing_message || `Olá {nome}, sua parcela {parcela} no valor de R$ {valor} venceu em {data}. Por favor, regularize.`;
    const message = billingTemplate
      .replace(/\{nome\}|\[Nome do Cliente\]/g, inst.client_name || "")
      .replace(/\{parcela\}/g, `${inst.installment_number}`)
      .replace(/\{valor\}|\[Valor da Parcela\]/g, Number(inst.amount).toFixed(2))
      .replace(/\{data\}/g, new Date(inst.due_date).toLocaleDateString("pt-BR"))
      .replace(/\[Nome da Empresa\]/g, "System Juros").replace(/Sr\(a\)\s*/g, "");
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleBulkWhatsApp = () => {
    const overdue = filtered.filter((i: any) => i.status === "overdue");
    if (!overdue.length) { toast({ title: "Nenhuma parcela atrasada" }); return; }
    handleWhatsApp(overdue[0]);
    if (overdue.length > 1) toast({ title: `${overdue.length - 1} cobrança(s) restantes`, description: "Envie uma por uma clicando no botão Cobrar." });
  };

  const filtered = installments.filter((inst: any) => {
    if (filter !== "all" && inst.status !== filter) return false;
    if (search && !inst.client_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: installments.length,
    pending: installments.filter((i: any) => i.status === "pending").length,
    overdue: installments.filter((i: any) => i.status === "overdue").length,
    paid: installments.filter((i: any) => i.status === "paid").length,
    totalPending: installments.filter((i: any) => i.status === "pending" || i.status === "overdue").reduce((acc: number, i: any) => acc + Number(i.amount), 0),
    totalOverdue: installments.filter((i: any) => i.status === "overdue").reduce((acc: number, i: any) => acc + Number(i.amount), 0),
  };

  const overdueByClient = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    installments.filter((i: any) => i.status === "overdue").forEach((i: any) => {
      const existing = map.get(i.client_id) || { name: i.client_name || "—", count: 0, total: 0 };
      existing.count++;
      existing.total += Number(i.amount);
      map.set(i.client_id, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [installments]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie parcelas e envie cobranças via WhatsApp.</p>
        </div>
        {stats.overdue > 0 && (
          <button onClick={handleBulkWhatsApp} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all focus-ring">
            <Send size={14} /> Cobrar Atrasadas ({stats.overdue})
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade-in">
        {[
          { label: "Pendentes", value: stats.pending, sub: `R$ ${fmt(stats.totalPending)}`, icon: Clock, color: "text-warning", bg: "bg-warning/8", border: "", filterKey: "pending" as const },
          { label: "Atrasadas", value: stats.overdue, sub: `R$ ${fmt(stats.totalOverdue)}`, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/8", border: stats.overdue > 0 ? "border-destructive/20 danger-glow" : "", filterKey: "overdue" as const },
          { label: "Pagas", value: stats.paid, sub: "", icon: CheckCircle, color: "text-success", bg: "bg-success/8", border: "", filterKey: "paid" as const },
          { label: "Total", value: stats.total, sub: "", icon: Receipt, color: "text-foreground", bg: "bg-muted/30", border: "", filterKey: "all" as const },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilter(s.filterKey)}
            className={`rounded-xl border bg-card p-4 card-shine text-left transition-all focus-ring ${
              filter === s.filterKey ? "border-primary/30 ring-1 ring-primary/20" : s.border || "border-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={14} className={s.color} />
              </div>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
            {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
          </button>
        ))}
      </div>

      {/* Overdue Summary by Client */}
      {overdueByClient.length > 0 && filter !== "paid" && (
        <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-destructive" />
            <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Inadimplentes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueByClient.slice(0, 6).map(([clientId, info]) => (
              <div
                key={clientId}
                onClick={() => navigate(`/clientes/${clientId}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <span className="font-medium text-foreground">{info.name}</span>
                <span className="text-destructive font-bold">{info.count}x</span>
                <span className="text-muted-foreground">R$ {fmt(info.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-in">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm input-enhanced" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>}
        </div>
        <div className="pill-tabs">
          {([
            { key: "all", label: "Todas", count: stats.total },
            { key: "overdue", label: "Atrasadas", count: stats.overdue },
            { key: "pending", label: "Pendentes", count: stats.pending },
            { key: "paid", label: "Pagas", count: stats.paid },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`pill-tab ${filter === f.key ? "pill-tab-active" : "pill-tab-inactive"}`}
            >
              {f.label}
              {f.count > 0 && filter !== f.key && (
                <span className="text-[9px] px-1 rounded bg-muted/50">{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <div className="empty-state-icon">
            <Receipt size={28} className="text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-medium">
            {installments.length === 0 ? "Nenhuma parcela gerada." : "Nenhuma parcela com este filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 stagger-fade-in">
          {filtered.map((inst: any) => {
            const isOverdue = inst.status === "overdue";
            const isPaid = inst.status === "paid";
            const now = new Date();
            const dueDate = new Date(inst.due_date);
            const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
            const daysText = isOverdue ? `${daysDiff}d atrasada` : !isPaid ? (daysDiff < 0 ? `em ${Math.abs(daysDiff)}d` : "hoje") : "";

            return (
              <div
                key={inst.id}
                className={`rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-sm cursor-pointer ${
                  isOverdue ? "border-destructive/20 bg-destructive/3 danger-glow" :
                  isPaid ? "border-success/15 bg-success/3 success-glow" :
                  "border-border bg-card"
                }`}
                onClick={() => navigate(`/clientes/${inst.client_id}`)}
              >
                <div className={`num-badge w-10 h-10 rounded-xl ${
                  isOverdue ? "bg-destructive/10 text-destructive" :
                  isPaid ? "bg-success/10 text-success" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {inst.installment_number}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-foreground truncate">{inst.client_name}</p>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${
                      isOverdue ? "bg-destructive/10 text-destructive border-destructive/20 badge-pulse" :
                      isPaid ? "bg-success/10 text-success border-success/20" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isOverdue ? "Atrasada" : isPaid ? "Paga" : "Pendente"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">R$ {fmt(Number(inst.amount))}</span>
                    <span className="flex items-center gap-1"><CalendarDays size={10} /> {dueDate.toLocaleDateString("pt-BR")}</span>
                    {daysText && <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>{daysText}</span>}
                    {isPaid && inst.paid_at && <span className="text-success">Pago: {new Date(inst.paid_at).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isPaid && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsApp(inst); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-all active:scale-95 focus-ring"
                        title="Cobrar via WhatsApp"
                      >
                        <MessageSquare size={14} />
                        <span className="hidden sm:inline">Cobrar</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmPayId(inst.id); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-accent transition-all active:scale-95 focus-ring"
                        title="Marcar como paga"
                      >
                        <Check size={14} />
                        <span className="hidden sm:inline">Paga</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {confirmPayId && (
        <div className="modal-backdrop" onClick={() => setConfirmPayId(null)}>
          <div className="modal-content max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={28} className="text-success" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Confirmar Pagamento?</h3>
              {(() => {
                const inst = installments.find((i: any) => i.id === confirmPayId);
                return inst ? (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-foreground">{inst.client_name}</p>
                    <p className="text-sm text-muted-foreground">Parcela #{inst.installment_number} · R$ {fmt(Number(inst.amount))}</p>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPayId(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={() => handleMarkPaid(confirmPayId)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cobrancas;
