import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import InstallmentRow from "@/components/cobrancas/InstallmentRow";
import PayModal from "@/components/cobrancas/PayModal";
import { useNavigate, useSearchParams } from "react-router-dom";
import InadimplenciaPanel from "@/components/cobrancas/InadimplenciaPanel";
import {
  Receipt, Check, MessageSquare, Search, X, AlertTriangle, Clock, CheckCircle,
  CalendarDays, Mail, CheckSquare, Square, MinusSquare, List, Copy,
  Calendar as CalendarIcon, SlidersHorizontal, ArrowUpDown, Zap, Flame,
  History, Bell, Send
  , ChevronDown, ChevronRight, Layers, ListTree
} from "lucide-react";
import { computeLateFee, computeLateFeeBreakdown } from "@/lib/lateFee";
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
import { fetchAll } from "@/lib/fetchAll";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const relTime = (iso: string) => {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
};

// Frase humana para a próxima parcela do grupo (ou a mais atrasada)
const humanDueLabel = (items: any[]): { text: string; tone: "danger" | "warn" | "ok" | "muted" } => {
  const unpaid = items.filter((i: any) => i.status !== "paid");
  if (!unpaid.length) return { text: "Tudo em dia", tone: "ok" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const withDates = unpaid.map((i: any) => ({ i, d: parseLocalDate(i.due_date) })).filter((x: any) => x.d);
  if (!withDates.length) return { text: `${unpaid.length} pendente(s)`, tone: "muted" };
  const overdue = withDates.filter((x: any) => x.d!.getTime() < today.getTime());
  if (overdue.length) {
    const maxDays = Math.max(...overdue.map((x: any) => Math.floor((today.getTime() - x.d!.getTime()) / 86400000)));
    return { text: overdue.length === 1 ? `há ${maxDays} dia${maxDays === 1 ? "" : "s"} em atraso` : `${overdue.length} parcelas em atraso · até ${maxDays}d`, tone: "danger" };
  }
  withDates.sort((a: any, b: any) => a.d!.getTime() - b.d!.getTime());
  const next = withDates[0];
  const diffDays = Math.round((next.d!.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return { text: "vence hoje", tone: "warn" };
  if (diffDays === 1) return { text: "vence amanhã", tone: "warn" };
  if (diffDays <= 7) return { text: `vence em ${diffDays} dias`, tone: "warn" };
  return { text: `vence em ${diffDays} dias`, tone: "muted" };
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: "parcelas" | "aging" = searchParams.get("tab") === "aging" ? "aging" : "parcelas";
  const setActiveTab = (t: "parcelas" | "aging") => {
    const next = new URLSearchParams(searchParams);
    if (t === "aging") next.set("tab", "aging"); else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [sort, setSort] = useState<SortKey>("amount_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 180);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cobrarAteOpen, setCobrarAteOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<null | { groups: { clientId: string; clientName: string; phone: string; message: string; items: any[] }[]; skipped: number; totalItems: number }>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [previewEditIdx, setPreviewEditIdx] = useState<number | null>(null);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [cobrarAteDate, setCobrarAteDate] = useState<string>(todayISO);
  const [cobrarAteSelected, setCobrarAteSelected] = useState<Set<string>>(new Set());
  const [focoDia, setFocoDia] = useState(false);
  const [simpleMode, setSimpleMode] = useState<boolean>(() => {
    try { const v = localStorage.getItem("cobrancas_simple_mode"); return v === null ? true : v === "1"; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem("cobrancas_simple_mode", simpleMode ? "1" : "0"); } catch {} }, [simpleMode]);
  const [bucket, setBucket] = useState<"all" | "today" | "1-7" | "8-30" | "30+">("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState<"expanded" | "collapsed">("collapsed");
  const toggleGroupCollapse = useCallback((cid: string) => {
    setCollapsed(prev => { const n = new Set(prev); n.has(cid) ? n.delete(cid) : n.add(cid); return n; });
  }, []);
  const [historyFor, setHistoryFor] = useState<{ installmentId: string; clientName: string } | null>(null);
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
      const clients = await fetchAll((f, t) => supabase.from("clients").select("id, name, phone, whatsapp, email").eq("user_id", user!.id).range(f, t));
      const clientMap = new Map((clients || []).map((c: any) => [c.id, { name: c.name, phone: c.whatsapp || c.phone, email: c.email }]));

      const data = await fetchAll((f, t) => supabase
        .from("contract_installments")
        .select("*, contracts(capital, frequency, interest_rate, num_installments)")
        .eq("user_id", user!.id)
        .order("due_date", { ascending: true })
        .range(f, t));

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

  const { data: attempts = [] } = useQuery({
    queryKey: ["collection-attempts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_attempts")
        .select("id, installment_id, client_id, channel, message_preview, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const lastAttemptByInst = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of attempts) if (a.installment_id && !m.has(a.installment_id)) m.set(a.installment_id, a);
    return m;
  }, [attempts]);

  const { data: reminderSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["cobr-reminder-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("settings")
        .select("bot_send_hour, bot_send_minute, bot_auto_send")
        .eq("user_id", user!.id).maybeSingle();
      return data || { bot_send_hour: 9, bot_send_minute: 0, bot_auto_send: false };
    },
    enabled: !!user,
  });

  const logAttempt = async (inst: any, channel: "whatsapp" | "email" | "pix_copy" | "manual", preview?: string) => {
    if (!user) return;
    try {
      await supabase.from("collection_attempts").insert({
        user_id: user.id,
        client_id: inst.client_id,
        contract_id: inst.contract_id,
        installment_id: inst.id,
        channel,
        message_preview: (preview || "").slice(0, 280),
      });
      qc.invalidateQueries({ queryKey: ["collection-attempts", user.id] });
    } catch { /* non-blocking */ }
  };


  const markPaidOne = async (inst: any, paidValue?: number) => {
    if (!user) return;
    const paid = Number(paidValue ?? inst.amount);
    const { error } = await supabase.from("contract_installments").update({
      status: "paid", paid_at: new Date().toISOString(), paid_amount: paid,
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
      user_id: user.id, amount: paid, type: "payment",
      description: `Pagamento parcela #${inst.installment_number} - ${inst.client_name}`,
      client_id: inst.client_id, contract_id: inst.contract_id,
    });
    const { data: remaining } = await supabase
      .from("contract_installments").select("id").eq("contract_id", inst.contract_id).neq("status", "paid");
    if (remaining && remaining.length === 0) {
      await supabase.from("contracts").update({ status: "completed" }).eq("id", inst.contract_id);
    }
  };

  const markPaidPartial = async (inst: any, amount: number) => {
    if (!user) return;
    const prev = Number(inst.paid_amount || 0);
    const next = Math.round((prev + amount) * 100) / 100;
    const { error } = await supabase.from("contract_installments").update({
      paid_amount: next,
    }).eq("id", inst.id);
    if (error) throw error;
    await supabase.from("transactions").insert({
      user_id: user.id, amount, type: "payment",
      description: `Pagamento parcial parcela #${inst.installment_number} - ${inst.client_name}`,
      client_id: inst.client_id, contract_id: inst.contract_id,
    });
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

  const handleMarkPaid = async (id: string, paidValue?: number) => {
    const inst = installments.find((i: any) => i.id === id);
    if (!inst) return;
    const { withFees } = computeLateFeeBreakdown(inst);
    const totalDue = Math.round(withFees * 100) / 100;
    const alreadyPaid = Number(inst.paid_amount || 0);
    const remaining = Math.max(0, Math.round((totalDue - alreadyPaid) * 100) / 100);
    const value = Math.max(0, Number(paidValue ?? remaining));
    if (value <= 0) { toast({ title: "Informe um valor válido", variant: "destructive" }); return; }

    const isFull = value + 0.005 >= remaining;
    setConfirmPayId(null);

    if (isFull) {
      const snapshot = optimisticMarkPaid([id]);
      toast({ title: "✓ Parcela quitada!" });
      try {
        await markPaidOne(inst, alreadyPaid + value);
        qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
        qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      } catch (e: any) {
        qc.setQueryData(["cobrancas-installments", user?.id], snapshot);
        toast({ title: "Erro ao registrar pagamento", description: e.message, variant: "destructive" });
      }
    } else {
      try {
        await markPaidPartial(inst, value);
        qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
        qc.invalidateQueries({ queryKey: ["dashboard-data"] });
        toast({ title: "✓ Pagamento parcial registrado", description: `Restam R$ ${fmt(remaining - value)}` });
      } catch (e: any) {
        toast({ title: "Erro ao registrar pagamento parcial", description: e.message, variant: "destructive" });
      }
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

  const buildMessage = (inst: any, opts: { includePix?: boolean } = {}) => {
    const portalUrl = `${window.location.origin}/portal-cliente`;
    const total = inst.contracts?.num_installments || inst.total_installments || "";
    const parcelaInfo = total ? `${inst.installment_number} de ${total}` : `${inst.installment_number}`;
    const billingTemplate = profile?.billing_message || `Olá {nome}, sua parcela {parcela} no valor de R$ {valor} venceu em {data}. Por favor, regularize. Acesse seu portal: {portal}`;
    let base = billingTemplate
      .replace(/\{nome\}|\[Nome do Cliente\]/g, inst.client_name || "")
      .replace(/\{parcela\}|\[Parcela\]/g, parcelaInfo)
      .replace(/\{valor\}|\[Valor da Parcela\]/g, Number(inst.amount).toFixed(2))
      .replace(/\{data\}|\[Data\]/g, formatBR(inst.due_date))
      .replace(/\{portal\}|\[Portal\]/g, portalUrl)
      .replace(/\[Nome da Empresa\]/g, "CredMais App").replace(/Sr\(a\)\s*/g, "");
    const pix = (profile as any)?.pix_key;
    if (opts.includePix && pix && !/PIX/i.test(base)) {
      base += `\n\n💸 Pague via PIX:\nChave: ${pix}\nValor: R$ ${Number(inst.amount).toFixed(2)}`;
    }
    return base;
  };

  const handleWhatsApp = (inst: any, opts: { withPix?: boolean } = {}) => {
    if (!inst.client_phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const phone = inst.client_phone.replace(/\D/g, "");
    const withPix = opts.withPix ?? !!(profile as any)?.pix_key;
    const message = buildMessage(inst, { includePix: withPix });
    if (withPix && (profile as any)?.pix_key) {
      navigator.clipboard?.writeText((profile as any).pix_key).catch(() => {});
    }
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`, "_blank");
    logAttempt(inst, "whatsapp", message);
  };

  const handleEmail = (inst: any) => {
    if (!inst.client_email) { toast({ title: "Sem e-mail", variant: "destructive" }); return; }
    const totalSub = inst.contracts?.num_installments;
    const subject = `Cobrança - Parcela ${inst.installment_number}${totalSub ? ` de ${totalSub}` : ""}`;
    const body = buildMessage(inst, { includePix: true });
    window.open(`mailto:${inst.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    logAttempt(inst, "email", body);
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

  const buildBulkWhatsAppMessage = (clientName: string, items: any[]) => {
    const portalUrl = `${window.location.origin}/portal-cliente`;
    const pix = (profile as any)?.pix_key;
    const pixType = (profile as any)?.pix_key_type;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lines = items.map((i: any) => {
      const d = parseLocalDate(i.due_date);
      const days = d ? Math.floor((today.getTime() - d.getTime()) / 86400000) : 0;
      const tag = days > 0 ? ` ⚠️ ${days}d atrasada` : days === 0 ? " 📌 vence hoje" : "";
      const contractTag = i.contract_id ? ` (contrato #${String(i.contract_id).slice(0, 6)})` : "";
      return `• Parcela #${i.installment_number}${contractTag} — R$ ${fmt(Number(i.amount))} — venc. ${formatBR(i.due_date)}${tag}`;
    }).join("\n");
    const total = items.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const pixBlock = pix
      ? `\n\n💸 *Pague via PIX*\nChave (${pixType || "PIX"}): *${pix}*\nValor total: *R$ ${fmt(total)}*\n_(a chave já foi copiada para sua área de transferência)_`
      : "";
    return `Olá ${clientName}, tudo bem? 👋\n\nIdentifiquei ${items.length} parcela${items.length > 1 ? "s" : ""} pendente${items.length > 1 ? "s" : ""} totalizando *R$ ${fmt(total)}*:\n\n${lines}${pixBlock}\n\nQualquer dúvida estou à disposição. Obrigado! 🙏\n\nPortal: ${portalUrl}`;
  };

  const handleBulk = (channel: "whatsapp" | "email") => {
    let items = getSelectedItems().filter((i: any) => i.status !== "paid");
    if (!items.length) {
      const overdue = filtered.filter((i: any) => i.status === "overdue");
      if (!overdue.length) { toast({ title: "Selecione parcelas ou tenha atrasadas" }); return; }
      items = overdue;
    }

    if (channel === "whatsapp") {
      // Agrupar por cliente para enviar UMA mensagem consolidada com PIX
      const byClient = new Map<string, any[]>();
      items.forEach((i: any) => {
        if (!byClient.has(i.client_id)) byClient.set(i.client_id, []);
        byClient.get(i.client_id)!.push(i);
      });
      const groups: { clientId: string; clientName: string; phone: string; message: string; items: any[] }[] = [];
      let skipped = 0;
      byClient.forEach((clientItems, clientId) => {
        const first = clientItems[0];
        if (!first.client_phone) { skipped++; return; }
        const phone = first.client_phone.replace(/\D/g, "");
        const num = phone.startsWith("55") ? phone : `55${phone}`;
        groups.push({
          clientId,
          clientName: first.client_name,
          phone: num,
          message: buildBulkWhatsAppMessage(first.client_name, clientItems),
          items: clientItems,
        });
      });
      if (!groups.length) {
        toast({ title: "Nenhum cliente com telefone válido", description: `${skipped} parcela(s) sem contato.` });
        return;
      }
      setBulkPreview({ groups, skipped, totalItems: items.length });
      return;
    }

    let opened = 0, skipped = 0;
    items.forEach((inst: any, idx: number) => {
      if (!inst.client_email) { skipped++; return; }
      setTimeout(() => handleEmail(inst), idx * 350);
      opened++;
    });
    toast({
      title: `Enviando ${opened} cobrança(s) por E-mail`,
      description: skipped > 0 ? `${skipped} cliente(s) sem contato e foram ignorados.` : undefined,
    });
    setSelected(new Set());
  };


  const confirmBulkPreview = async () => {
    if (!bulkPreview) return;
    setBulkSending(true);
    const pix = (profile as any)?.pix_key;
    if (pix) navigator.clipboard?.writeText(pix).catch(() => {});
    bulkPreview.groups.forEach((g, idx) => {
      setTimeout(() => {
        window.open(`https://wa.me/${g.phone}?text=${encodeURIComponent(g.message)}`, "_blank");
        g.items.forEach((i: any) => logAttempt(i, "whatsapp", g.message));
      }, idx * 400);
    });
    toast({
      title: `📲 ${bulkPreview.groups.length} cliente(s) sendo cobrado(s) via WhatsApp`,
      description: `${bulkPreview.totalItems} parcela(s) consolidada(s). ${pix ? "Chave PIX copiada. " : ""}${bulkPreview.skipped > 0 ? `${bulkPreview.skipped} sem telefone.` : ""}`.trim(),
    });
    setSelected(new Set());
    setBulkPreview(null);
    setPreviewEditIdx(null);
    // Refresh installments so the new "cobrado" status from the DB trigger shows up
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["cobrancas-installments"] });
    }, 800);
    setBulkSending(false);
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
      if (bucket !== "all") {
        if (inst.status === "paid") return false;
        const d = parseLocalDate(inst.due_date);
        if (!d) return false;
        const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
        if (bucket === "today" && days !== 0) return false;
        if (bucket === "1-7" && (days < 1 || days > 7)) return false;
        if (bucket === "8-30" && (days < 8 || days > 30)) return false;
        if (bucket === "30+" && days <= 30) return false;
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
  }, [installments, filter, period, sort, dSearch, focoDia, bucket]);

  const grouped = useMemo(() => {
    const map = new Map<string, { client_id: string; client_name: string; items: any[]; total: number; totalWithFees: number; totalFees: number; minDue: string }>();
    filtered.forEach((inst: any) => {
      if (!map.has(inst.client_id)) {
        map.set(inst.client_id, { client_id: inst.client_id, client_name: inst.client_name, items: [], total: 0, totalWithFees: 0, totalFees: 0, minDue: inst.due_date });
      }
      const g = map.get(inst.client_id)!;
      g.items.push(inst);
      if (inst.status !== "paid") {
        const base = Number(inst.amount) || 0;
        const fee = computeLateFee(inst);
        g.total += base;
        g.totalFees += fee;
        g.totalWithFees += base + fee;
      }
      if (inst.due_date < g.minDue) g.minDue = inst.due_date;
    });
    const groups = Array.from(map.values());
    const key = (g: any) => {
      if (sort === "amount_desc") return -g.total;
      if (sort === "amount_asc") return g.total;
      if (sort === "overdue_days") {
        const maxDays = Math.max(...g.items.map((i: any) => {
          const d = parseLocalDate(i.due_date);
          return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : 0;
        }));
        return -maxDays;
      }
      const t = parseLocalDate(g.minDue)?.getTime() ?? 0;
      return sort === "due_desc" ? -t : t;
    };
    groups.sort((a, b) => key(a) - key(b));
    groups.forEach((g: any) => {
      g.items.sort((a: any, b: any) => {
        if (sort === "amount_desc") return Number(b.amount) - Number(a.amount);
        if (sort === "amount_asc") return Number(a.amount) - Number(b.amount);
        if (sort === "overdue_days") {
          const da = parseLocalDate(a.due_date) ? Math.max(0, Math.floor((Date.now() - parseLocalDate(a.due_date)!.getTime()) / 86400000)) : 0;
          const db = parseLocalDate(b.due_date) ? Math.max(0, Math.floor((Date.now() - parseLocalDate(b.due_date)!.getTime()) / 86400000)) : 0;
          return db - da;
        }
        const ta = parseLocalDate(a.due_date)?.getTime() ?? 0;
        const tb = parseLocalDate(b.due_date)?.getTime() ?? 0;
        return sort === "due_desc" ? tb - ta : ta - tb;
      });
    });
    return groups;
  }, [filtered, sort]);

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

  const activeFilters = (period !== "all" ? 1 : 0) + (sort !== "amount_desc" ? 1 : 0) + (focoDia ? 1 : 0) + (bucket !== "all" ? 1 : 0);
  const clearFilters = () => { setPeriod("all"); setSort("amount_desc"); setFocoDia(false); setBucket("all"); };

  const copyPix = async (inst: any) => {
    const pix = (profile as any)?.pix_key;
    if (!pix) { toast({ title: "PIX não configurado", description: "Adicione sua chave PIX nas Configurações.", variant: "destructive" }); return; }
    try {
      await navigator.clipboard.writeText(pix);
      toast({ title: "✓ PIX copiado", description: `R$ ${fmt(Number(inst.amount))} · ${inst.client_name}` });
      logAttempt(inst, "pix_copy", pix);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const saveReminderTime = async (hour: number, minute: number, auto: boolean) => {
    if (!user) return;
    await supabase.from("settings").update({
      bot_send_hour: hour, bot_send_minute: minute, bot_auto_send: auto,
    }).eq("user_id", user.id);
    await refetchSettings();
    toast({ title: "✓ Lembretes atualizados" });
  };

  const hasPixKey = Boolean((profile as any)?.pix_key);
  const onRowClick = useCallback((clientId: string) => navigate(`/clientes/${clientId}`), [navigate]);
  const onToggleSel = useCallback((id: string) => toggleSelect(id), []);
  const onShowHistory = useCallback((id: string, name: string) => setHistoryFor({ installmentId: id, clientName: name }), []);
  const onMarkPaidCb = useCallback((id: string) => setConfirmPayId(id), []);
  const onWhatsAppCb = useCallback((inst: any) => handleWhatsApp(inst), []);
  const onCopyPixCb = useCallback((inst: any) => copyPix(inst), []);
  const onEmailCb = useCallback((inst: any) => handleEmail(inst), []);

  const renderRow = (inst: any) => (
    <InstallmentRow
      key={inst.id}
      inst={inst}
      isSel={selected.has(inst.id)}
      hasPixKey={hasPixKey}
      lastAttempt={lastAttemptByInst.get(inst.id) || null}
      onRowClick={onRowClick}
      onToggleSelect={onToggleSel}
      onWhatsApp={onWhatsAppCb}
      onCopyPix={onCopyPixCb}
      onEmail={onEmailCb}
      onMarkPaid={onMarkPaidCb}
      onShowHistory={onShowHistory}
    />
  );


  const handleWhatsAppGroup = (group: any) => {
    const phone = group.items[0]?.client_phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("55") ? clean : `55${clean}`;
    const unpaid = group.items.filter((i: any) => i.status !== "paid");
    const lines = unpaid.map((i: any) => `- Parcela #${i.installment_number} · R$ ${fmt(Number(i.amount))} (venc. ${formatBR(i.due_date)})`).join("\n");
    const total = unpaid.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const portalUrl = `${window.location.origin}/portal-cliente`;
    const msg = `Olá ${group.client_name}, tudo bem?\n\nIdentificamos ${unpaid.length} parcelas pendentes totalizando R$ ${fmt(total)}:\n${lines}\n\nVocê pode regularizar via PIX ou pelo portal: ${portalUrl}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const toggleGroupSelect = (group: any) => {
    const ids = group.items.filter((i: any) => i.status !== "paid").map((i: any) => i.id);
    const allSelected = ids.length > 0 && ids.every((id: string) => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id: string) => next.delete(id));
      else ids.forEach((id: string) => next.add(id));
      return next;
    });
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Hero enxuto */}
      <div className="page-hero animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Receipt size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">Cobranças</h1>
              <p className="text-muted-foreground text-xs mt-0.5">
                {simpleMode ? "Modo simples — só o essencial" : "Modo avançado — todas as ferramentas"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSimpleMode(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-colors focus-ring ${
                simpleMode ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
              title={simpleMode ? "Mostrar mais opções" : "Voltar ao modo simples"}
            >
              <SlidersHorizontal size={13} /> {simpleMode ? "Ver tudo" : "Modo simples"}
            </button>
            {stats.overdue > 0 && selected.size === 0 && (
              <button onClick={() => handleBulk("whatsapp")} className="btn-premium" style={{ background: "linear-gradient(135deg, hsl(var(--success)), hsl(152 65% 55%))" }}>
                <MessageSquare size={14} /> Cobrar atrasadas ({stats.overdue})
              </button>
            )}
            {!simpleMode && (
              <>
                <button
                  onClick={() => { setFocoDia(v => !v); setFilter("all"); setPeriod("all"); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-semibold transition-colors focus-ring ${
                    focoDia ? "bg-destructive/15 border-destructive/40 text-destructive" : "bg-card border-border text-foreground hover:bg-accent"
                  }`}
                >
                  <Flame size={14} className={focoDia ? "text-destructive" : "text-warning"} />
                  {focoDia ? "Foco do dia ativo" : "Foco do dia"}
                </button>
                <button
                  onClick={() => { setCobrarAteDate(todayISO); setCobrarAteSelected(new Set()); setCobrarAteOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border text-sm font-semibold text-foreground hover:bg-accent transition-colors focus-ring"
                >
                  <CalendarIcon size={14} className="text-primary" /> Cobrar até…
                </button>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Tabs: Parcelas & Cobranças  |  Inadimplência (por cliente) */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-card border border-border w-fit">
        <button
          onClick={() => setActiveTab("parcelas")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "parcelas"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <Receipt size={14} className="inline mr-1.5 -mt-0.5" />
          Parcelas & Cobranças
        </button>
        <button
          onClick={() => setActiveTab("aging")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "aging"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" />
          Inadimplência (por cliente)
        </button>
      </div>

      {activeTab === "aging" ? (
        <InadimplenciaPanel />
      ) : (
        <>
      {/* Métricas de cobranças automáticas — só no modo avançado */}
      {!simpleMode && <CollectionMetrics />}


      {/* Reminder schedule card — só no modo avançado */}
      {!simpleMode && reminderSettings && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${reminderSettings.bot_auto_send ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Lembrete automático diário</p>
              <p className="text-[11px] text-muted-foreground">
                {reminderSettings.bot_auto_send
                  ? `Disparo todo dia às ${String(reminderSettings.bot_send_hour).padStart(2,"0")}:${String(reminderSettings.bot_send_minute).padStart(2,"0")} para parcelas vencidas`
                  : "Desligado — ative para enviar cobranças automáticas todo dia"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="time"
              value={`${String(reminderSettings.bot_send_hour ?? 9).padStart(2,"0")}:${String(reminderSettings.bot_send_minute ?? 0).padStart(2,"0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                saveReminderTime(h || 0, m || 0, reminderSettings.bot_auto_send);
              }}
              className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              onClick={() => saveReminderTime(reminderSettings.bot_send_hour ?? 9, reminderSettings.bot_send_minute ?? 0, !reminderSettings.bot_auto_send)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                reminderSettings.bot_auto_send
                  ? "bg-success text-success-foreground hover:opacity-90"
                  : "bg-muted text-foreground hover:bg-accent"
              }`}
            >
              <Send size={12} /> {reminderSettings.bot_auto_send ? "Ativo" : "Ativar"}
            </button>
          </div>
        </div>
      )}


      {/* Stats cards */}
      <div className={`grid grid-cols-2 ${simpleMode ? "" : "sm:grid-cols-4"} gap-3 stagger-fade-in`}>

        {(() => {
          const all = [
            { label: "Vence hoje", value: dueTodayStats.count, sub: `R$ ${fmt(dueTodayStats.total)}`, icon: CalendarDays, color: "text-primary", bg: "bg-primary/8", border: dueTodayStats.count > 0 ? "border-primary/20" : "", filterKey: "all" as const, onClick: () => { setFocoDia(false); setPeriod("today"); setFilter("all"); } },
            { label: "Atrasadas", value: stats.overdue, sub: `R$ ${fmt(stats.totalOverdue)}`, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/8", border: stats.overdue > 0 ? "border-destructive/20 danger-glow" : "", filterKey: "overdue" as const, onClick: () => { setFocoDia(false); setPeriod("all"); setFilter("overdue"); } },
            { label: "Pendentes", value: stats.pending, sub: `R$ ${fmt(stats.totalPending)}`, icon: Clock, color: "text-warning", bg: "bg-warning/8", border: "", filterKey: "pending" as const, onClick: () => { setFocoDia(false); setPeriod("all"); setFilter("pending"); } },
            { label: "Pagas", value: stats.paid, sub: `R$ ${fmt(stats.totalPaid)}`, icon: CheckCircle, color: "text-success", bg: "bg-success/8", border: "", filterKey: "paid" as const, onClick: () => { setFocoDia(false); setPeriod("all"); setFilter("paid"); } },
          ];
          return (simpleMode ? all.slice(0, 2) : all).map((s: any) => (
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
          ));
        })()}
      </div>

      {/* Bucket de atraso — só no modo avançado */}
      {!simpleMode && (
      <div className="flex items-center gap-2 flex-wrap animate-fade-in">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atraso</span>
        {([
          { v: "all", label: "Todos" },
          { v: "today", label: "Hoje" },
          { v: "1-7", label: "1-7 dias" },
          { v: "8-30", label: "8-30 dias" },
          { v: "30+", label: "30+ dias" },
        ] as const).map(b => (
          <button
            key={b.v}
            onClick={() => setBucket(b.v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              bucket === b.v
                ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      )}

      {/* View switcher — só no modo avançado */}
      {!simpleMode && (
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
        {view === "list" && (
          <div className="pill-tabs" title="Modo de agrupamento">
            <button
              onClick={() => { setGroupMode("expanded"); setCollapsed(new Set()); }}
              className={`pill-tab ${groupMode === "expanded" ? "pill-tab-active" : "pill-tab-inactive"}`}
              aria-label="Mostrar parcelas separadas"
            >
              <ListTree size={12} /> Parcelas
            </button>
            <button
              onClick={() => { setGroupMode("collapsed"); setCollapsed(new Set()); }}
              className={`pill-tab ${groupMode === "collapsed" ? "pill-tab-active" : "pill-tab-inactive"}`}
              aria-label="Mostrar somente totais por cliente"
            >
              <Layers size={12} /> Totais
            </button>
          </div>
        )}
      </div>
      )}


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
                  <button aria-label="Limpar busca" onClick={() => setSearch("")} className="p-1 rounded-md hover:bg-accent text-muted-foreground"><X size={14} /></button>
                </>
              ) : (
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md border border-border/40 bg-muted/40 text-[10px] font-mono text-muted-foreground">/</kbd>
              )}
            </div>
          </div>

          {!simpleMode && (
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
          )}


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


          {!simpleMode && (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors focus-ring"
            title="Selecionar todas as parcelas visíveis" aria-label="Selecionar todas as parcelas visíveis"
          >
            {selected.size > 0 ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
            <span className="hidden sm:inline">{selected.size > 0 ? `${selected.size}` : "Selecionar"}</span>
          </button>
          )}
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
          {(() => null)()}
          {(() => {
            const maxTotalWithFees = Math.max(1, ...grouped.map((g: any) => g.totalWithFees || g.total || 0));
            return grouped.map((group: any) => {
            const groupSelectable = group.items.filter((i: any) => i.status !== "paid");
            const groupSelectedCount = groupSelectable.filter((i: any) => selected.has(i.id)).length;
            const allSelected = groupSelectable.length > 0 && groupSelectedCount === groupSelectable.length;
            const someSelected = groupSelectedCount > 0 && !allSelected;
            const hasUnpaid = groupSelectable.length > 0;
            const unpaidCount = groupSelectable.length;
            const isCollapsed = groupMode === "collapsed" ? !collapsed.has(group.client_id) : collapsed.has(group.client_id);
            const showHeader = hasUnpaid;
            const dueInfo = humanDueLabel(group.items);
            const toneClass =
              dueInfo.tone === "danger" ? "bg-destructive/15 text-destructive border-destructive/30"
              : dueInfo.tone === "warn" ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
              : dueInfo.tone === "ok" ? "bg-success/15 text-success border-success/30"
              : "bg-muted/40 text-muted-foreground border-border";
            const barPct = Math.min(100, Math.round(((group.totalWithFees || group.total) / maxTotalWithFees) * 100));
            const firstUnpaid = groupSelectable[0];
            return (
              <div key={group.client_id} className="rounded-2xl border border-border bg-card/50 hover:bg-card transition-colors overflow-hidden">
                {showHeader && (
                  <div className="px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          aria-label="Selecionar todas as parcelas do cliente"
                          onClick={(e) => { e.stopPropagation(); toggleGroupSelect(group); }}
                          className="shrink-0 p-1 rounded hover:bg-accent transition-colors focus-ring"
                          title="Selecionar todas"
                        >
                          {allSelected
                            ? <CheckSquare size={18} className="text-primary" />
                            : someSelected
                              ? <MinusSquare size={18} className="text-primary" />
                              : <Square size={18} className="text-muted-foreground" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(group.client_id); }}
                          className="min-w-0 flex-1 text-left focus-ring rounded-lg px-1"
                          title={isCollapsed ? "Mostrar parcelas" : "Ocultar parcelas"}
                          aria-label="Alternar exibição das parcelas"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{group.client_name}</p>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${toneClass}`}>
                              {dueInfo.text}
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                            <span className="text-lg font-black text-foreground tabular-nums">
                              R$ {fmt(group.totalWithFees || group.total)}
                            </span>
                            {group.totalFees > 0 && (
                              <span className="text-[11px] text-destructive font-medium">
                                +R$ {fmt(group.totalFees)} multa
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              · {unpaidCount} parcela{unpaidCount === 1 ? "" : "s"}
                            </span>
                            <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                              {isCollapsed ? <><ChevronRight size={12} /> ver parcelas</> : <><ChevronDown size={12} /> ocultar</>}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Barra visual de ranking (relativa ao maior devedor) */}
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${dueInfo.tone === "danger" ? "bg-destructive" : dueInfo.tone === "warn" ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>

                    {/* Ações grandes e óbvias */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsAppGroup(group); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-success text-success-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all focus-ring"
                        title="Cobrar via WhatsApp"
                      >
                        <MessageSquare size={15} /> Cobrar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (unpaidCount === 1 && firstUnpaid) setConfirmPayId(firstUnpaid.id);
                          else toggleGroupCollapse(group.client_id);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all focus-ring"
                        title={unpaidCount === 1 ? "Marcar como paga" : "Ver parcelas para pagar"}
                      >
                        <Check size={15} /> {unpaidCount === 1 ? "Pagar" : "Parcelas"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${group.client_id}`); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent hover:bg-accent/70 text-foreground text-sm font-semibold active:scale-[0.98] transition-all focus-ring"
                        title="Abrir cliente"
                      >
                        <Receipt size={15} /> Cliente
                      </button>
                    </div>
                  </div>
                )}
                {(!showHeader || !isCollapsed) && (
                  <div className={showHeader ? "border-t border-border bg-background/40 px-2 py-2 space-y-1.5" : ""}>
                    {group.items.map((inst: any) => renderRow(inst))}
                  </div>
                )}
              </div>
            );
          });
          })()}
        </div>
      )}
      </>)}
      </>)}


      {/* Payment Confirmation Modal (com pagamento parcial) */}
      {confirmPayId && (() => {
        const inst = installments.find((i: any) => i.id === confirmPayId);
        if (!inst) return null;
        const fee = computeLateFeeBreakdown(inst);
        const alreadyPaid = Number(inst.paid_amount || 0);
        const totalDue = Math.round(fee.withFees * 100) / 100;
        const remaining = Math.max(0, Math.round((totalDue - alreadyPaid) * 100) / 100);
        const dueDate = parseLocalDate(inst.due_date);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysLate = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;
        return <PayModal
          inst={inst}
          fee={fee}
          alreadyPaid={alreadyPaid}
          remaining={remaining}
          daysLate={daysLate}
          onCancel={() => setConfirmPayId(null)}
          onConfirm={(value) => handleMarkPaid(confirmPayId, value)}
        />;
      })()}

      {/* Bulk WhatsApp preview modal */}
      {bulkPreview && (
        <div className="modal-backdrop" onClick={() => !bulkSending && (setBulkPreview(null), setPreviewEditIdx(null))}>
          <div className="modal-content max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2"><MessageSquare size={16} className="text-success" /> Pré-visualizar cobrança em lote</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bulkPreview.groups.length} cliente(s) • {bulkPreview.totalItems} parcela(s){bulkPreview.skipped > 0 ? ` • ${bulkPreview.skipped} sem telefone` : ""}
                </p>
              </div>
              <button aria-label="Fechar prévia" disabled={bulkSending} onClick={() => { setBulkPreview(null); setPreviewEditIdx(null); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {bulkPreview.groups.map((g, idx) => (
                <div key={g.clientId} className="rounded-2xl border border-border bg-card/50">
                  <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{g.clientName}</div>
                      <div className="text-[11px] text-muted-foreground">📱 +{g.phone} • {g.items.length} parcela(s)</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { navigator.clipboard?.writeText(g.message); toast({ title: "Mensagem copiada" }); }}
                        className="px-2 py-1 rounded-lg text-[11px] bg-accent hover:bg-accent/70 text-foreground flex items-center gap-1"
                        title="Copiar mensagem"
                      ><Copy size={11} /> Copiar</button>
                      <button
                        onClick={() => setPreviewEditIdx(previewEditIdx === idx ? null : idx)}
                        className="px-2 py-1 rounded-lg text-[11px] bg-primary/15 hover:bg-primary/25 text-primary"
                      >{previewEditIdx === idx ? "Pronto" : "Editar"}</button>
                      <button
                        aria-label="Remover deste lote"
                        onClick={() => {
                          setBulkPreview((prev) => prev ? { ...prev, groups: prev.groups.filter((_, i) => i !== idx), totalItems: prev.totalItems - g.items.length } : prev);
                          if (previewEditIdx === idx) setPreviewEditIdx(null);
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] bg-destructive/15 hover:bg-destructive/25 text-destructive"
                        title="Remover deste lote"
                      ><X size={11} /></button>
                    </div>
                  </div>
                  {previewEditIdx === idx ? (
                    <textarea
                      value={g.message}
                      onChange={(e) => {
                        const v = e.target.value;
                        setBulkPreview((prev) => prev ? { ...prev, groups: prev.groups.map((gr, i) => i === idx ? { ...gr, message: v } : gr) } : prev);
                      }}
                      rows={10}
                      className="w-full px-4 py-3 text-xs bg-background border-0 rounded-b-2xl resize-y font-mono outline-none"
                    />
                  ) : (
                    <pre className="px-4 py-3 text-xs whitespace-pre-wrap text-foreground/90 font-sans">{g.message}</pre>
                  )}
                </div>
              ))}
              {bulkPreview.groups.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">Nenhum cliente no lote.</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center gap-2">
              <button disabled={bulkSending} onClick={() => { setBulkPreview(null); setPreviewEditIdx(null); }} className="flex-1 px-4 py-2.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50">Cancelar</button>
              <button
                disabled={bulkSending || bulkPreview.groups.length === 0}
                onClick={confirmBulkPreview}
                className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-success text-success-foreground hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={14} /> {bulkSending ? "Abrindo..." : `Enviar ${bulkPreview.groups.length} WhatsApp`}
              </button>
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
                <button aria-label="Fechar" onClick={() => setCobrarAteOpen(false)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><X size={16} /></button>
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

      {/* History modal */}
      {historyFor && (() => {
        const list = attempts.filter((a: any) => a.installment_id === historyFor.installmentId);
        return (
          <div className="modal-backdrop" onClick={() => setHistoryFor(null)}>
            <div className="modal-content max-w-md p-0" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><History size={16} className="text-primary" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Histórico de cobranças</h3>
                    <p className="text-[11px] text-muted-foreground">{historyFor.clientName}</p>
                  </div>
                </div>
                <button onClick={() => setHistoryFor(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={14} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tentativa registrada ainda.</p>
                ) : list.map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-border bg-card/50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        {a.channel === "whatsapp" ? "💬 WhatsApp" : a.channel === "email" ? "✉️ E-mail" : a.channel === "pix_copy" ? "🔑 PIX copiado" : a.channel === "sms" ? "📱 SMS" : "✍️ Manual"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">há {relTime(a.created_at)}</span>
                    </div>
                    {a.message_preview && (
                      <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-3">{a.message_preview}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>

  );
};

export default Cobrancas;
