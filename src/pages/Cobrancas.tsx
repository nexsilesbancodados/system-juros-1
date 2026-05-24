import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt, Check, MessageSquare, Search, X, AlertTriangle, Clock, CheckCircle,
  DollarSign, Send, CalendarDays, Mail, CheckSquare, Square, List, LayoutGrid,
  Calendar as CalendarIcon, SlidersHorizontal, ArrowUpDown, TrendingUp, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import CalendarView from "@/components/cobrancas/CalendarView";
import KanbanView from "@/components/cobrancas/KanbanView";
import { formatBR } from "@/lib/dateUtils";
import EmptyState from "@/components/EmptyState";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

type StatusFilter = "all" | "pending" | "overdue" | "paid";
type PeriodFilter = "all" | "today" | "7d" | "30d" | "future";
type SortKey = "due_asc" | "due_desc" | "amount_desc" | "amount_asc" | "overdue_days";

const useDebounced = <T,>(value: T, ms = 180) => {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
};

const Cobrancas = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [sort, setSort] = useState<SortKey>("due_asc");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 180);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "calendar" | "kanban">("list");
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard "/" focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch(""); searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useMultiTableRealtime(
    ["contract_installments", "contracts"],
    [["cobrancas-installments", user?.id || ""]],
  );

  const { data: installments = [], isLoading: loading } = useQuery({
    queryKey: ["cobrancas-installments", user?.id],
    queryFn: async () => {
      const { data: clients } = await supabase.from("clients").select("id, name, phone, whatsapp, email").eq("user_id", user!.id);
      const clientMap = new Map((clients || []).map((c: any) => [c.id, { name: c.name, phone: c.whatsapp || c.phone, email: c.email }]));

      const { data } = await supabase
        .from("contract_installments")
        .select("*, contracts(capital, frequency, interest_rate, num_installments)")
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
          client_email: client?.email || null,
        };
      });
    },
    enabled: !!user,
  });

  const markPaidOne = async (inst: any) => {
    if (!user) return;
    const { error } = await supabase.from("contract_installments").update({
      status: "paid", paid_at: new Date().toISOString(), paid_amount: inst.amount,
    }).eq("id", inst.id);
    if (error) throw error;

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
    await supabase.from("transactions").insert({
      user_id: user.id, amount: Number(inst.amount), type: "payment",
      description: `Pagamento parcela #${inst.installment_number} - ${inst.client_name}`,
      client_id: inst.client_id, contract_id: inst.contract_id,
    });
    const { data: remaining } = await supabase
      .from("contract_installments").select("id").eq("contract_id", inst.contract_id).neq("status", "paid");
    if (remaining && remaining.length === 0) {
      await supabase.from("contracts").update({ status: "completed" }).eq("id", inst.contract_id);
    }
  };

  const optimisticMarkPaid = (ids: string[]) => {
    const key = ["cobrancas-installments", user?.id];
    const prev = qc.getQueryData<any[]>(key);
    qc.setQueryData<any[]>(key, (old) =>
      (old || []).map((i: any) =>
        ids.includes(i.id)
          ? { ...i, status: "paid", paid_at: new Date().toISOString(), paid_amount: i.amount, _optimistic: true }
          : i
      )
    );
    return prev;
  };

  const handleMarkPaid = async (id: string) => {
    const inst = installments.find((i: any) => i.id === id);
    if (!inst) return;
    const snapshot = optimisticMarkPaid([id]);
    setConfirmPayId(null);
    toast({ title: "✓ Parcela marcada como paga!" });
    try {
      await markPaidOne(inst);
      qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch (e: any) {
      qc.setQueryData(["cobrancas-installments", user?.id], snapshot);
      toast({ title: "Erro ao registrar pagamento", description: e.message, variant: "destructive" });
    }
  };

  const handleBulkMarkPaid = async () => {
    const items = installments.filter((i: any) => selected.has(i.id) && i.status !== "paid");
    if (items.length === 0) { toast({ title: "Nada para pagar" }); return; }
    const snapshot = optimisticMarkPaid(items.map((i: any) => i.id));
    setBulkPaying(true);
    setBulkPayOpen(false);
    setSelected(new Set());
    let ok = 0, fail = 0;
    for (const inst of items) {
      try { await markPaidOne(inst); ok++; } catch { fail++; }
    }
    setBulkPaying(false);
    if (fail > 0) qc.setQueryData(["cobrancas-installments", user?.id], snapshot);
    qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
    toast({
      title: `✓ ${ok} parcela(s) pagas`,
      description: fail > 0 ? `${fail} falha(s) revertida(s).` : undefined,
    });
  };

  const buildMessage = (inst: any) => {
    const portalUrl = `${window.location.origin}/portal-cliente`;
    const total = inst.contracts?.num_installments || inst.total_installments || "";
    const parcelaInfo = total ? `${inst.installment_number} de ${total}` : `${inst.installment_number}`;
    const billingTemplate = profile?.billing_message || `Olá {nome}, sua parcela {parcela} no valor de R$ {valor} venceu em {data}. Por favor, regularize. Acesse seu portal: {portal}`;
    return billingTemplate
      .replace(/\{nome\}|\[Nome do Cliente\]/g, inst.client_name || "")
      .replace(/\{parcela\}|\[Parcela\]/g, parcelaInfo)
      .replace(/\{valor\}|\[Valor da Parcela\]/g, Number(inst.amount).toFixed(2))
      .replace(/\{data\}|\[Data\]/g, formatBR(inst.due_date))
      .replace(/\{portal\}|\[Portal\]/g, portalUrl)
      .replace(/\[Nome da Empresa\]/g, "System Juros").replace(/Sr\(a\)\s*/g, "");
  };

  const handleWhatsApp = (inst: any) => {
    if (!inst.client_phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const phone = inst.client_phone.replace(/\D/g, "");
    const message = buildMessage(inst);
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleEmail = (inst: any) => {
    if (!inst.client_email) { toast({ title: "Sem e-mail", variant: "destructive" }); return; }
    const totalSub = inst.contracts?.num_installments;
    const subject = `Cobrança - Parcela ${inst.installment_number}${totalSub ? ` de ${totalSub}` : ""}`;
    const body = buildMessage(inst);
    window.open(`mailto:${inst.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  const handleSMS = (inst: any) => {
    if (!inst.client_phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const phone = inst.client_phone.replace(/\D/g, "");
    const message = buildMessage(inst);
    window.open(`sms:${phone.startsWith("55") ? "+" + phone : "+55" + phone}?body=${encodeURIComponent(message)}`, "_blank");
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectable = filtered.filter((i: any) => i.status !== "paid").map((i: any) => i.id);
    const allSelected = selectable.length > 0 && selectable.every((id: string) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(selectable));
  };

  const getSelectedItems = () => installments.filter((i: any) => selected.has(i.id));

  const handleBulk = (channel: "whatsapp" | "email" | "sms") => {
    let items = getSelectedItems();
    if (!items.length) {
      const overdue = filtered.filter((i: any) => i.status === "overdue");
      if (!overdue.length) { toast({ title: "Selecione parcelas ou tenha atrasadas" }); return; }
      items = overdue;
    }
    let opened = 0, skipped = 0;
    items.forEach((inst: any, idx: number) => {
      const hasContact = channel === "email" ? !!inst.client_email : !!inst.client_phone;
      if (!hasContact) { skipped++; return; }
      setTimeout(() => {
        if (channel === "whatsapp") handleWhatsApp(inst);
        else if (channel === "email") handleEmail(inst);
        else handleSMS(inst);
      }, idx * 350);
      opened++;
    });
    toast({
      title: `Enviando ${opened} cobrança(s) por ${channel === "whatsapp" ? "WhatsApp" : channel === "email" ? "E-mail" : "SMS"}`,
      description: skipped > 0 ? `${skipped} cliente(s) sem contato e foram ignorados.` : undefined,
    });
    setSelected(new Set());
  };

  // Filtering + sorting
  const filtered = useMemo(() => {
    const q = dSearch.trim().toLowerCase();
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

    let arr = installments.filter((inst: any) => {
      if (filter !== "all" && inst.status !== filter) return false;
      if (q) {
        const name = (inst.client_name || "").toLowerCase();
        const num = `${inst.installment_number}`;
        const amt = String(inst.amount);
        if (!name.includes(q) && !num.includes(q) && !amt.includes(q)) return false;
      }
      if (period !== "all") {
        const d = new Date(inst.due_date);
        if (period === "today") {
          const same = d.toDateString() === now.toDateString();
          if (!same) return false;
        } else if (period === "7d") {
          if (d < now || d >= in7) return false;
        } else if (period === "30d") {
          if (d < now || d >= in30) return false;
        } else if (period === "future") {
          if (d < tomorrow) return false;
        }
      }
      return true;
    });

    const overdueDays = (i: any) => Math.max(0, Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000));
    if (sort === "due_asc") arr = [...arr].sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));
    else if (sort === "due_desc") arr = [...arr].sort((a, b) => +new Date(b.due_date) - +new Date(a.due_date));
    else if (sort === "amount_desc") arr = [...arr].sort((a, b) => Number(b.amount) - Number(a.amount));
    else if (sort === "amount_asc") arr = [...arr].sort((a, b) => Number(a.amount) - Number(b.amount));
    else if (sort === "overdue_days") arr = [...arr].sort((a, b) => overdueDays(b) - overdueDays(a));
    return arr;
  }, [installments, filter, period, sort, dSearch]);

  const stats = useMemo(() => {
    const pending = installments.filter((i: any) => i.status === "pending");
    const overdue = installments.filter((i: any) => i.status === "overdue");
    const paid = installments.filter((i: any) => i.status === "paid");
    const totalPending = pending.reduce((s: number, i: any) => s + Number(i.amount), 0)
      + overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const totalOverdue = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const totalPaid = paid.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const totalContracts = installments.length;
    const inadimplencia = totalContracts > 0 ? (overdue.length / totalContracts) * 100 : 0;
    return {
      total: installments.length,
      pending: pending.length,
      overdue: overdue.length,
      paid: paid.length,
      totalPending, totalOverdue, totalPaid, inadimplencia,
    };
  }, [installments]);

  // Selected sum
  const selectedSum = useMemo(() => {
    return getSelectedItems().reduce((s: number, i: any) => s + Number(i.amount), 0);
  }, [selected, installments]);

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

  const activeFilters = (period !== "all" ? 1 : 0) + (sort !== "due_asc" ? 1 : 0);
  const clearFilters = () => { setPeriod("all"); setSort("due_asc"); };

  return (
    <div className="space-y-5 pb-24">
      {/* Premium hero */}
      <div className="page-hero animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.2)] shrink-0">
              <Receipt size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-headline text-2xl md:text-3xl text-foreground">Cobranças</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gerencie parcelas e envie cobranças via WhatsApp.</p>
            </div>
          </div>
          {stats.overdue > 0 && selected.size === 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleBulk("whatsapp")} className="btn-premium" style={{ background: "linear-gradient(135deg, hsl(var(--success)), hsl(152 65% 55%))" }}>
                <MessageSquare size={14} /> Cobrar atrasadas ({stats.overdue})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade-in">
        {[
          { label: "Pendentes", value: stats.pending, sub: `R$ ${fmt(stats.totalPending)}`, icon: Clock, color: "text-warning", bg: "bg-warning/8", border: "", filterKey: "pending" as const },
          { label: "Atrasadas", value: stats.overdue, sub: `R$ ${fmt(stats.totalOverdue)}`, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/8", border: stats.overdue > 0 ? "border-destructive/20 danger-glow" : "", filterKey: "overdue" as const },
          { label: "Pagas", value: stats.paid, sub: `R$ ${fmt(stats.totalPaid)}`, icon: CheckCircle, color: "text-success", bg: "bg-success/8", border: "", filterKey: "paid" as const },
          { label: "Inadimplência", value: `${stats.inadimplencia.toFixed(1)}%`, sub: `${stats.total} parcelas`, icon: TrendingUp, color: "text-foreground", bg: "bg-muted/30", border: "", filterKey: "all" as const },
        ].map((s: any) => (
          <button
            key={s.label}
            onClick={() => setFilter(s.filterKey)}
            className={`rounded-2xl border bg-card p-4 card-shine text-left transition-all focus-ring ${
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
        <div className="bg-destructive/5 border border-destructive/15 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-destructive" />
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Top inadimplentes</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{overdueByClient.length} cliente(s)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueByClient.slice(0, 8).map(([clientId, info]) => (
              <button
                key={clientId}
                onClick={() => navigate(`/clientes/${clientId}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs cursor-pointer hover:bg-accent/30 hover:border-destructive/30 transition-colors"
              >
                <span className="font-medium text-foreground">{info.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[10px] font-bold">{info.count}x</span>
                <span className="text-muted-foreground">R$ {fmt(info.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View switcher */}
      <div className="flex items-center gap-2 animate-fade-in">
        <div className="pill-tabs">
          {([
            { key: "list", label: "Lista", icon: List },
            { key: "calendar", label: "Calendário", icon: CalendarIcon },
            { key: "kanban", label: "Kanban", icon: LayoutGrid },
          ] as const).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`pill-tab ${view === v.key ? "pill-tab-active" : "pill-tab-inactive"}`}
            >
              <v.icon size={12} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filters + select all */}
      <div className="space-y-3 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por cliente, parcela # ou valor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-24 py-2.5 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground/50 text-sm input-enhanced"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {search ? (
                <>
                  <span className="text-[10px] text-muted-foreground">{filtered.length}</span>
                  <button onClick={() => setSearch("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>
                </>
              ) : (
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md border border-border/40 bg-muted/40 text-[10px] font-mono text-muted-foreground">/</kbd>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative shrink-0 px-3.5 py-2.5 rounded-2xl border transition-all ${activeFilters > 0 ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            title="Filtros e ordenação"
          >
            <SlidersHorizontal size={16} />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground flex items-center justify-center">{activeFilters}</span>
            )}
          </button>

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

          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors focus-ring"
            title="Selecionar todas as parcelas visíveis"
          >
            {selected.size > 0 ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
            <span className="hidden sm:inline">{selected.size > 0 ? `${selected.size}` : "Selecionar"}</span>
          </button>
        </div>

        {showFilters && (
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-4 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Período</span>
                {([
                  { v: "all", label: "Tudo" },
                  { v: "today", label: "Hoje" },
                  { v: "7d", label: "Próx. 7d" },
                  { v: "30d", label: "Próx. 30d" },
                  { v: "future", label: "Futuras" },
                ] as const).map(b => (
                  <button key={b.v} onClick={() => setPeriod(b.v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${period === b.v ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown size={13} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Ordenar</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-muted/30 text-foreground border border-border/30 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="due_asc">Venc. mais próximo</option>
                  <option value="due_desc">Venc. mais distante</option>
                  <option value="amount_desc">Maior valor</option>
                  <option value="amount_asc">Menor valor</option>
                  <option value="overdue_days">Mais dias atrasada</option>
                </select>

                {activeFilters > 0 && (
                  <button onClick={clearFilters} className="ml-2 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/30 backdrop-blur-md shadow-lg shadow-primary/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{selected.size} selecionada(s)</span>
            <span className="text-xs text-foreground/80">Total: <span className="font-bold text-foreground">R$ {fmt(selectedSum)}</span></span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Limpar</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleBulk("whatsapp")} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-success/15 hover:bg-success/25 text-success border border-success/30 flex items-center gap-1.5">
              <MessageSquare size={13} /> WhatsApp
            </button>
            <button onClick={() => handleBulk("email")} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-1.5">
              <Mail size={13} /> E-mail
            </button>
            <button onClick={() => handleBulk("sms")} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 flex items-center gap-1.5">
              <Send size={13} /> SMS
            </button>
            <button onClick={() => setBulkPayOpen(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-foreground text-background hover:opacity-90 flex items-center gap-1.5">
              <Zap size={13} /> Marcar como pagas
            </button>
          </div>
        </div>
      )}

      {/* Calendar view */}
      {view === "calendar" && !loading && (
        <CalendarView
          installments={filtered}
          onWhatsApp={handleWhatsApp}
          onMarkPaid={(id) => setConfirmPayId(id)}
          onClickInstallment={(i) => navigate(`/clientes/${i.client_id}`)}
        />
      )}

      {/* Kanban view */}
      {view === "kanban" && !loading && (
        <KanbanView
          installments={filtered}
          onWhatsApp={handleWhatsApp}
          onMarkPaid={(id) => setConfirmPayId(id)}
          onClickInstallment={(i) => navigate(`/clientes/${i.client_id}`)}
        />
      )}

      {/* List */}
      {view === "list" && (<>
      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={installments.length === 0 ? "Nenhuma parcela gerada ainda." : "Nenhuma parcela com esses filtros."}
          description={installments.length === 0
            ? "Crie um contrato para gerar parcelas automaticamente."
            : "Tente ajustar a busca, status ou período."}
          action={(search || activeFilters > 0 || filter !== "all") ? (
            <button onClick={() => { setSearch(""); setFilter("all"); clearFilters(); }} className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted/40 hover:bg-muted text-foreground">
              Limpar tudo
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2 stagger-fade-in">
          {filtered.map((inst: any) => {
            const isOverdue = inst.status === "overdue";
            const isPaid = inst.status === "paid";
            const now = new Date();
            const dueDate = new Date(inst.due_date);
            const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
            const daysText = isOverdue ? `${daysDiff}d atrasada` : !isPaid ? (daysDiff < 0 ? `em ${Math.abs(daysDiff)}d` : "hoje") : "";
            const isSel = selected.has(inst.id);

            return (
              <div
                key={inst.id}
                className={`rounded-2xl border p-4 flex items-center gap-3 transition-all hover:shadow-sm cursor-pointer ${
                  isSel ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" :
                  isOverdue ? "border-destructive/20 bg-gradient-to-r from-destructive/5 to-transparent danger-glow" :
                  isPaid ? "border-success/15 bg-success/3 success-glow" :
                  "border-border bg-card"
                }`}
                onClick={() => navigate(`/clientes/${inst.client_id}`)}
              >
                {!isPaid && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(inst.id); }}
                    className="shrink-0 p-1 rounded hover:bg-accent transition-colors focus-ring"
                    title="Selecionar"
                  >
                    {isSel
                      ? <CheckSquare size={18} className="text-primary" />
                      : <Square size={18} className="text-muted-foreground" />}
                  </button>
                )}
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
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="font-semibold text-foreground">R$ {fmt(Number(inst.amount))}</span>
                    <span className="flex items-center gap-1"><CalendarDays size={10} /> {dueDate.toLocaleDateString("pt-BR")}</span>
                    {daysText && <span className={isOverdue ? "text-destructive font-semibold" : daysText === "hoje" ? "text-warning font-semibold" : "text-muted-foreground"}>{daysText}</span>}
                    {isPaid && inst.paid_at && <span className="text-success">Pago: {formatBR(inst.paid_at)}</span>}
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
                        <span className="hidden md:inline">WhatsApp</span>
                      </button>
                      {inst.client_email && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEmail(inst); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-all active:scale-95 focus-ring"
                          title="Cobrar via E-mail"
                        >
                          <Mail size={14} />
                          <span className="hidden lg:inline">E-mail</span>
                        </button>
                      )}
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
      </>)}

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
              <button onClick={() => setConfirmPayId(null)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={() => handleMarkPaid(confirmPayId)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk pay modal */}
      {bulkPayOpen && (
        <div className="modal-backdrop" onClick={() => !bulkPaying && setBulkPayOpen(false)}>
          <div className="modal-content max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                <Zap size={28} className="text-success" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Marcar {getSelectedItems().filter((i: any) => i.status !== "paid").length} parcela(s) como pagas?</h3>
              <p className="text-sm text-muted-foreground mt-2">Total recebido: <span className="font-bold text-foreground">R$ {fmt(selectedSum)}</span></p>
              <p className="text-[11px] text-muted-foreground mt-1">As receitas e o lucro serão registrados automaticamente.</p>
            </div>
            <div className="flex gap-2">
              <button disabled={bulkPaying} onClick={() => setBulkPayOpen(false)} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50">Cancelar</button>
              <button disabled={bulkPaying} onClick={handleBulkMarkPaid} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all disabled:opacity-50">
                {bulkPaying ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cobrancas;
