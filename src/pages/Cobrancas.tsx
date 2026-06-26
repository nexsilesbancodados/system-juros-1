import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt, Check, MessageSquare, Search, X, AlertTriangle, Clock, CheckCircle,
  CalendarDays, Mail, CheckSquare, Square, List, Copy,
  Calendar as CalendarIcon, SlidersHorizontal, ArrowUpDown, Zap, Flame
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import CalendarView from "@/components/cobrancas/CalendarView";
import { formatBR, parseLocalDate } from "@/lib/dateUtils";
import EmptyState from "@/components/EmptyState";
import CollectionMetrics from "@/components/cobrancas/CollectionMetrics";

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
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cobrarAteOpen, setCobrarAteOpen] = useState(false);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [cobrarAteDate, setCobrarAteDate] = useState<string>(todayISO);
  const [cobrarAteSelected, setCobrarAteSelected] = useState<Set<string>>(new Set());
  const [focoDia, setFocoDia] = useState(false);
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

      const today = new Date(); today.setHours(0,0,0,0);
      return (data || []).map((inst: any) => {
        const client = clientMap.get(inst.client_id);
        const dueLocal = parseLocalDate(inst.due_date);
        const isOverdue = inst.status === "pending" && dueLocal !== null && dueLocal < today;
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
      if (focoDia) {
        if (inst.status === "paid") return false;
        const d = parseLocalDate(inst.due_date);
        if (!d) return false;
        // Focar do dia = atrasadas + vence hoje
        if (d > now) return false;
      }
      if (q) {
        const name = (inst.client_name || "").toLowerCase();
        const num = `${inst.installment_number}`;
        const amt = String(inst.amount);
        if (!name.includes(q) && !num.includes(q) && !amt.includes(q)) return false;
      }
      if (period !== "all") {
        const d = parseLocalDate(inst.due_date);
        if (!d) return false;
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

    const ts = (s: string) => (parseLocalDate(s)?.getTime() ?? 0);
    const overdueDays = (i: any) => Math.max(0, Math.floor((Date.now() - ts(i.due_date)) / 86400000));
    if (sort === "due_asc") arr = [...arr].sort((a, b) => ts(a.due_date) - ts(b.due_date));
    else if (sort === "due_desc") arr = [...arr].sort((a, b) => ts(b.due_date) - ts(a.due_date));
    else if (sort === "amount_desc") arr = [...arr].sort((a, b) => Number(b.amount) - Number(a.amount));
    else if (sort === "amount_asc") arr = [...arr].sort((a, b) => Number(a.amount) - Number(b.amount));
    else if (sort === "overdue_days") arr = [...arr].sort((a, b) => overdueDays(b) - overdueDays(a));
    return arr;
  }, [installments, filter, period, sort, dSearch, focoDia]);

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

  const dueTodayStats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const items = installments.filter((i: any) => {
      if (i.status === "paid") return false;
      const d = parseLocalDate(i.due_date);
      return d && d.toDateString() === today.toDateString();
    });
    return { count: items.length, total: items.reduce((s: number, i: any) => s + Number(i.amount), 0) };
  }, [installments]);

  const activeFilters = (period !== "all" ? 1 : 0) + (sort !== "due_asc" ? 1 : 0) + (focoDia ? 1 : 0);
  const clearFilters = () => { setPeriod("all"); setSort("due_asc"); setFocoDia(false); };

  const copyPix = async (inst: any) => {
    const pix = (profile as any)?.pix_key;
    if (!pix) { toast({ title: "PIX não configurado", description: "Adicione sua chave PIX nas Configurações.", variant: "destructive" }); return; }
    try {
      await navigator.clipboard.writeText(pix);
      toast({ title: "✓ PIX copiado", description: `R$ ${fmt(Number(inst.amount))} · ${inst.client_name}` });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };


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
              <h1 className="text-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Cobranças</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gerencie parcelas e envie cobranças via WhatsApp.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setCobrarAteDate(todayISO); setCobrarAteSelected(new Set()); setCobrarAteOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border text-sm font-semibold text-foreground hover:bg-accent transition-colors focus-ring"
              title="Selecionar uma data e ver tudo a cobrar até ela"
            >
              <CalendarIcon size={14} className="text-primary" /> Cobrar até…
            </button>
            {stats.overdue > 0 && selected.size === 0 && (
              <button onClick={() => handleBulk("whatsapp")} className="btn-premium" style={{ background: "linear-gradient(135deg, hsl(var(--success)), hsl(152 65% 55%))" }}>
                <MessageSquare size={14} /> Cobrar atrasadas ({stats.overdue})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Métricas de cobranças automáticas */}
      <CollectionMetrics />

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-fade-in">

        {[
          { label: "Vence hoje", value: dueTodayStats.count, sub: `R$ ${fmt(dueTodayStats.total)}`, icon: CalendarDays, color: "text-primary", bg: "bg-primary/8", border: dueTodayStats.count > 0 ? "border-primary/20" : "", filterKey: "all" as const, onClick: () => { setFocoDia(false); setPeriod("today"); setFilter("all"); } },
          { label: "Atrasadas", value: stats.overdue, sub: `R$ ${fmt(stats.totalOverdue)}`, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/8", border: stats.overdue > 0 ? "border-destructive/20 danger-glow" : "", filterKey: "overdue" as const, onClick: () => { setFocoDia(false); setPeriod("all"); setFilter("overdue"); } },
          { label: "Pendentes", value: stats.pending, sub: `R$ ${fmt(stats.totalPending)}`, icon: Clock, color: "text-warning", bg: "bg-warning/8", border: "", filterKey: "pending" as const, onClick: () => { setFocoDia(false); setPeriod("all"); setFilter("pending"); } },
          { label: "Pagas", value: stats.paid, sub: `R$ ${fmt(stats.totalPaid)}`, icon: CheckCircle, color: "text-success", bg: "bg-success/8", border: "", filterKey: "paid" as const, onClick: () => { setFocoDia(false); setPeriod("all"); setFilter("paid"); } },
        ].map((s: any) => (
          <button
            key={s.label}
            onClick={s.onClick}
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

      {/* View switcher */}
      <div className="flex items-center gap-2 animate-fade-in">
        <div className="pill-tabs">
          {([
            { key: "list", label: "Lista", icon: List },
            { key: "calendar", label: "Calendário", icon: CalendarIcon },
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
            {period !== "all" && (
              <>
                <span className="mx-1 w-px h-5 bg-border/40" />
                <button
                  onClick={() => setPeriod("all")}
                  className="pill-tab pill-tab-active"
                  title="Período ativo — clique para limpar"
                >
                  {period === "today" ? "Hoje" : period === "7d" ? "7 dias" : period === "30d" ? "30 dias" : "Futuras"}
                  <X size={10} />
                </button>
              </>
            )}
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
            const now = new Date(); now.setHours(0,0,0,0);
            const dueDate = parseLocalDate(inst.due_date) ?? new Date(inst.due_date);
            const daysDiff = Math.floor((now.getTime() - new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()) / 86400000);
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
                    <span className="flex items-center gap-1"><CalendarDays size={10} /> {formatBR(inst.due_date)}</span>
                    {inst.contract_id && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]" title={`Contrato ${inst.contract_id}`}>
                        #{String(inst.contract_id).slice(0, 6)}
                        {inst.contracts?.capital ? ` · R$ ${fmt(Number(inst.contracts.capital))}` : ""}
                      </span>
                    )}
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

      {/* Cobrar até <data> Modal */}
      {cobrarAteOpen && (() => {
        const limit = parseLocalDate(cobrarAteDate);
        if (limit) limit.setHours(23, 59, 59, 999);
        const items = installments
          .filter((i: any) => i.status !== "paid")
          .filter((i: any) => {
            const d = parseLocalDate(i.due_date);
            return d && limit && d <= limit;
          })
          .sort((a: any, b: any) => (parseLocalDate(a.due_date)?.getTime() ?? 0) - (parseLocalDate(b.due_date)?.getTime() ?? 0));

        const today = new Date(); today.setHours(0,0,0,0);
        const groups = new Map<string, any[]>();
        items.forEach((i: any) => {
          const arr = groups.get(i.client_id) || [];
          arr.push(i);
          groups.set(i.client_id, arr);
        });
        const totalAll = items.reduce((s: number, i: any) => s + Number(i.amount), 0);
        const totalOverdue = items.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + Number(i.amount), 0);
        const totalToday = items.filter((i: any) => {
          const d = parseLocalDate(i.due_date);
          return d && d.toDateString() === today.toDateString();
        }).reduce((s: number, i: any) => s + Number(i.amount), 0);

        const allIds = items.map((i: any) => i.id);
        const allChecked = allIds.length > 0 && allIds.every((id: string) => cobrarAteSelected.has(id));
        const selItems = items.filter((i: any) => cobrarAteSelected.has(i.id));
        const selSum = selItems.reduce((s: number, i: any) => s + Number(i.amount), 0);

        const toggleAll = () => setCobrarAteSelected(allChecked ? new Set() : new Set(allIds));
        const toggleOne = (id: string) => setCobrarAteSelected(prev => {
          const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
        });

        const cobrarSelecionados = () => {
          const target = (selItems.length > 0 ? selItems : items).filter((i: any) => i.client_phone);
          if (target.length === 0) { toast({ title: "Sem telefones para cobrar", variant: "destructive" }); return; }
          target.forEach((inst: any, idx: number) => setTimeout(() => handleWhatsApp(inst), idx * 350));
          toast({ title: `Enviando ${target.length} cobrança(s) por WhatsApp` });
        };
        const baixarSelecionados = async () => {
          const target = selItems.length > 0 ? selItems : items;
          if (target.length === 0) return;
          const snapshot = optimisticMarkPaid(target.map((i: any) => i.id));
          setCobrarAteSelected(new Set());
          let ok = 0, fail = 0;
          for (const inst of target) { try { await markPaidOne(inst); ok++; } catch { fail++; } }
          if (fail > 0) qc.setQueryData(["cobrancas-installments", user?.id], snapshot);
          qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
          qc.invalidateQueries({ queryKey: ["dashboard-data"] });
          toast({ title: `✓ ${ok} parcela(s) marcadas como pagas`, description: fail > 0 ? `${fail} falha(s).` : undefined });
        };

        return (
          <div className="modal-backdrop" onClick={() => setCobrarAteOpen(false)}>
            <div className="modal-content w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <CalendarIcon size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Cobrar até a data selecionada</h3>
                    <p className="text-[11px] text-muted-foreground">Inclui atrasadas anteriores + vencendo até a data.</p>
                  </div>
                </div>
                <button onClick={() => setCobrarAteOpen(false)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
              </div>

              {/* Date + presets */}
              <div className="px-5 py-3 border-b border-border space-y-3 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data limite</label>
                  <input
                    type="date"
                    value={cobrarAteDate}
                    onChange={(e) => { setCobrarAteDate(e.target.value); setCobrarAteSelected(new Set()); }}
                    className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  {[
                    { label: "Hoje", days: 0 },
                    { label: "+3 dias", days: 3 },
                    { label: "+7 dias", days: 7 },
                    { label: "Fim do mês", days: -1 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => {
                        const d = new Date();
                        if (p.days === -1) { d.setMonth(d.getMonth() + 1, 0); }
                        else d.setDate(d.getDate() + p.days);
                        setCobrarAteDate(d.toISOString().slice(0, 10));
                        setCobrarAteSelected(new Set());
                      }}
                      className="px-2.5 py-1 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >{p.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Atrasadas</p>
                    <p className="text-sm font-bold text-destructive">R$ {fmt(totalOverdue)}</p>
                  </div>
                  <div className="rounded-xl bg-warning/10 border border-warning/20 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-warning font-semibold">Vence hoje</p>
                    <p className="text-sm font-bold text-warning">R$ {fmt(totalToday)}</p>
                  </div>
                  <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Total a cobrar</p>
                    <p className="text-sm font-bold text-primary">R$ {fmt(totalAll)}</p>
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {items.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle size={32} className="text-success mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">Nada a cobrar até esta data 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                        {allChecked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                        {allChecked ? "Desmarcar todas" : `Selecionar ${items.length}`}
                      </button>
                      <span className="text-[11px] text-muted-foreground">{groups.size} cliente(s)</span>
                    </div>
                    {Array.from(groups.entries()).map(([cid, list]) => {
                      const name = list[0].client_name;
                      const sum = list.reduce((s, i) => s + Number(i.amount), 0);
                      return (
                        <div key={cid} className="rounded-xl border border-border bg-card/50">
                          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{name}</p>
                            <p className="text-xs font-bold text-primary">R$ {fmt(sum)}</p>
                          </div>
                          <div className="divide-y divide-border/40">
                            {list.map((inst: any) => {
                              const d = parseLocalDate(inst.due_date);
                              const days = d ? Math.floor((today.getTime() - d.getTime()) / 86400000) : 0;
                              return (
                                <label key={inst.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={cobrarAteSelected.has(inst.id)}
                                    onChange={() => toggleOne(inst.id)}
                                    className="w-4 h-4 accent-primary"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">
                                      Parcela #{inst.installment_number} · {formatBR(inst.due_date)}
                                    </p>
                                    <p className="text-[11px]">
                                      <span className={inst.status === "overdue" ? "text-destructive font-semibold" : "text-muted-foreground"}>
                                        {inst.status === "overdue" ? `${days}d em atraso` : days === 0 ? "Vence hoje" : `Em ${-days}d`}
                                      </span>
                                    </p>
                                  </div>
                                  <p className="text-sm font-bold text-foreground shrink-0">R$ {fmt(Number(inst.amount))}</p>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="px-5 py-3 border-t border-border bg-card/95 backdrop-blur flex items-center justify-between gap-3 shrink-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{selItems.length > 0 ? `${selItems.length} selecionada(s)` : "Todas as parcelas"}</p>
                    <p className="text-base font-bold text-foreground">R$ {fmt(selItems.length > 0 ? selSum : totalAll)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={cobrarSelecionados} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success/15 text-success border border-success/30 text-xs font-semibold hover:bg-success/25 transition-colors">
                      <MessageSquare size={14} /> Cobrar WhatsApp
                    </button>
                    <button onClick={baixarSelecionados} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
                      <Check size={14} /> Dar baixa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Cobrancas;
