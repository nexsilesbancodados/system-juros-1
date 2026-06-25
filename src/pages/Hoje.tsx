import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import { toast } from "sonner";
import {
  Sunrise, AlertCircle, CheckCircle2, ListTodo, Receipt,
  TrendingUp, ArrowRight, MessageSquare, Loader2, Plus, Clock, Sparkles,
  UserPlus, FileText, Wallet, Cake, CalendarDays, Flame, History, DollarSign
} from "lucide-react";
import SmartAlerts from "@/components/SmartAlerts";
import { formatBR, parseLocalDate } from "@/lib/dateUtils";

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };
const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; };
const endOfMonth = () => { const d = new Date(); d.setMonth(d.getMonth()+1, 0); d.setHours(23,59,59,999); return d; };
const inDays = (n: number) => { const d = startOfToday(); d.setDate(d.getDate()+n); return d; };
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (iso: string) => formatBR(iso, { day: "2-digit", month: "short" });
const fmtDayLabel = (iso: string) => {
  const d = parseLocalDate(iso);
  if (!d) return "";
  const today = startOfToday();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return formatBR(d, { weekday: "short", day: "2-digit", month: "2-digit" });
};

const Hoje = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  useMultiTableRealtime(
    ["contract_installments", "todos", "notifications", "profits"],
    [["hoje", user?.id]],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["hoje", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const today = startOfToday().toISOString();
      const eod = endOfToday().toISOString();
      const in7 = inDays(7).toISOString();
      const som = startOfMonth().toISOString();
      const eom = endOfMonth().toISOString();

      const [
        dueTodayRes, overdueRes, todosRes, notifRes, profitsTodayRes, promisesRes,
        next7Res, paidRecentRes, profitsMonthRes, pendingMonthRes, clientsRes,
      ] = await Promise.all([
        supabase.from("contract_installments")
          .select("id, amount, due_date, installment_number, client_id, contract_id, clients:client_id(name, phone, whatsapp), contracts:contract_id(capital)")
          .eq("user_id", user.id).eq("status", "pending")
          .gte("due_date", today).lte("due_date", eod)
          .order("due_date", { ascending: true }).limit(50),
        supabase.from("contract_installments")
          .select("id, amount, due_date, installment_number, client_id, contract_id, clients:client_id(name, phone, whatsapp), contracts:contract_id(capital)")
          .eq("user_id", user.id).eq("status", "pending")
          .lt("due_date", today)
          .order("due_date", { ascending: true }).limit(200),
        supabase.from("todos").select("id, task, is_complete").eq("user_id", user.id).eq("is_complete", false).order("created_at", { ascending: false }).limit(8),
        supabase.from("notifications").select("id, message, type, link, sent_at").eq("user_id", user.id).eq("is_read", false).order("sent_at", { ascending: false }).limit(5),
        supabase.from("profits").select("amount").eq("user_id", user.id).gte("date", today).lte("date", eod),
        supabase.from("audit_logs").select("id, details, created_at").eq("user_id", user.id).eq("action", "promise_to_pay").order("created_at", { ascending: false }).limit(5),
        // Agenda 7 dias (incluindo hoje)
        supabase.from("contract_installments")
          .select("id, amount, due_date, client_id, clients:client_id(name)")
          .eq("user_id", user.id).eq("status", "pending")
          .gte("due_date", today).lte("due_date", in7)
          .order("due_date", { ascending: true }).limit(80),
        // Últimos pagamentos
        supabase.from("contract_installments")
          .select("id, paid_amount, paid_at, client_id, clients:client_id(name)")
          .eq("user_id", user.id).eq("status", "paid")
          .not("paid_at", "is", null)
          .order("paid_at", { ascending: false }).limit(5),
        // Lucro do mês
        supabase.from("profits").select("amount").eq("user_id", user.id).gte("date", som).lte("date", eom),
        // A receber no mês (pendente)
        supabase.from("contract_installments").select("amount")
          .eq("user_id", user.id).eq("status", "pending")
          .gte("due_date", som).lte("due_date", eom),
        // Aniversariantes (puxa só os com birth_date e filtra no client)
        supabase.from("clients")
          .select("id, name, birth_date, phone, whatsapp")
          .eq("user_id", user.id)
          .not("birth_date", "is", null)
          .limit(500),
      ]);

      // Top devedores: agrupa atraso por cliente
      const debtors: Record<string, { id: string; name: string; total: number; count: number; phone?: string; whatsapp?: string }> = {};
      (overdueRes.data || []).forEach((i: any) => {
        const cid = i.client_id; if (!cid) return;
        if (!debtors[cid]) debtors[cid] = { id: cid, name: i.clients?.name || "Cliente", total: 0, count: 0, phone: i.clients?.phone, whatsapp: i.clients?.whatsapp };
        debtors[cid].total += Number(i.amount);
        debtors[cid].count += 1;
      });
      const topDebtors = Object.values(debtors).sort((a, b) => b.total - a.total).slice(0, 5);

      // Agenda 7 dias agrupada por data
      const agendaMap: Record<string, { date: string; items: any[]; total: number }> = {};
      (next7Res.data || []).forEach((i: any) => {
        const key = i.due_date.slice(0, 10);
        if (!agendaMap[key]) agendaMap[key] = { date: i.due_date, items: [], total: 0 };
        agendaMap[key].items.push(i);
        agendaMap[key].total += Number(i.amount);
      });
      const agenda = Object.values(agendaMap).sort((a, b) => a.date.localeCompare(b.date));

      // Aniversariantes de hoje
      const now = new Date();
      const todayMD = `${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const birthdays = (clientsRes.data || []).filter((c: any) => {
        if (!c.birth_date) return false;
        const md = c.birth_date.slice(5, 10);
        return md === todayMD;
      });

      const profitMonth = (profitsMonthRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const aReceberMonth = (pendingMonthRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

      return {
        dueToday: dueTodayRes.data || [],
        overdue: overdueRes.data || [],
        todos: todosRes.data || [],
        notifications: notifRes.data || [],
        profitToday: (profitsTodayRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0),
        promises: (promisesRes.data || []).map((p: any) => ({
          id: p.id,
          date: p.details?.promise_date,
          client: p.details?.client_name || "Cliente",
          msg: p.details?.message
        })),
        topDebtors,
        agenda,
        birthdays,
        paidRecent: paidRecentRes.data || [],
        profitMonth,
        aReceberMonth,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const totals = useMemo(() => ({
    dueToday: (data?.dueToday || []).reduce((s, i: any) => s + Number(i.amount), 0),
    overdue: (data?.overdue || []).reduce((s, i: any) => s + Number(i.amount), 0),
    overdueCount: data?.overdue.length || 0,
    dueTodayCount: data?.dueToday.length || 0,
  }), [data]);

  const markPaid = async (id: string, amount: number) => {
    setSavingId(id);
    const { error } = await supabase.from("contract_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: amount })
      .eq("id", id);
    setSavingId(null);
    if (error) { toast.error("Erro ao registrar pagamento"); return; }
    toast.success("Pagamento registrado");
    qc.invalidateQueries({ queryKey: ["hoje"] });
  };

  const toggleTodo = async (id: string, current: boolean) => {
    await supabase.from("todos").update({ is_complete: !current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["hoje"] });
  };

  const sendWhats = (phone?: string, clientName?: string, customMsg?: string, amount?: number, due?: string) => {
    if (!phone) { toast.error("Cliente sem telefone"); return; }
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("55") ? clean : `55${clean}`;
    const msg = encodeURIComponent(customMsg || `Olá ${clientName || ""}! Lembrete da parcela de R$ ${fmtBRL(amount || 0)} vencendo em ${due ? fmtTime(due) : "breve"}.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-2xl bg-muted/30" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/30" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/30" />)}
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: "Novo cliente", Icon: UserPlus, to: "/clientes/novo", color: "from-primary/20 to-primary/5 text-primary border-primary/20" },
    { label: "Registrar pagamento", Icon: DollarSign, to: "/cobrancas", color: "from-success/20 to-success/5 text-success border-success/20" },
    { label: "Lançar gasto", Icon: Wallet, to: "/gastos", color: "from-destructive/20 to-destructive/5 text-destructive border-destructive/20" },
    { label: "Lançar lucro", Icon: TrendingUp, to: "/lucros", color: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20" },
  ];


  return (
    <section className="space-y-4" aria-labelledby="hoje-title">
      <a
        href="#hoje-cobrancas"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-bold"
      >
        Pular para cobranças prioritárias
      </a>

      {/* Header compacto */}
      <header className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-card/60 to-card px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5 truncate">
            <Sunrise size={11} aria-hidden="true" />
            <span className="hidden sm:inline">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
            <span className="sm:hidden">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
          </p>
          <h1 id="hoje-title" className="text-base sm:text-xl font-bold text-foreground leading-tight truncate">
            {greeting} <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {totals.dueTodayCount === 0 && totals.overdueCount === 0
              ? "Sem cobranças pendentes hoje."
              : `${totals.dueTodayCount} hoje · ${totals.overdueCount} em atraso`}
          </p>
        </div>
        <button
          onClick={() => navigate("/clientes/novo")}
          className="shrink-0 px-2.5 sm:px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          aria-label="Novo cliente"
        >
          <Plus size={13} /> <span className="hidden sm:inline">Novo cliente</span>
        </button>
      </header>

      {/* Ações rápidas */}
      <nav aria-label="Ações rápidas" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {quickActions.map(a => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            className={`group rounded-xl border bg-gradient-to-br ${a.color} px-2.5 sm:px-3 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-2 hover:scale-[1.01] transition-transform`}
          >
            <a.Icon size={15} className="shrink-0" />
            <span className="text-xs sm:text-xs font-bold text-foreground truncate text-left">{a.label}</span>
          </button>
        ))}
      </nav>


      {/* KPIs compactos: 4 colunas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" role="list" aria-label="Indicadores">
        {[
          { label: "Vencendo hoje", value: `R$ ${fmtBRL(totals.dueToday)}`, sub: `${totals.dueTodayCount} parc.`, color: "text-primary", bg: "bg-primary/5 border-primary/15", Icon: Clock },
          { label: "Em atraso", value: `R$ ${fmtBRL(totals.overdue)}`, sub: `${totals.overdueCount} parc.`, color: "text-destructive", bg: "bg-destructive/5 border-destructive/15", Icon: AlertCircle },
          { label: "Lucro hoje", value: `R$ ${fmtBRL(data?.profitToday || 0)}`, sub: "registrado", color: "text-success", bg: "bg-success/5 border-success/15", Icon: TrendingUp },
          { label: "A receber no mês", value: `R$ ${fmtBRL(data?.aReceberMonth || 0)}`, sub: "pendente", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/15", Icon: CalendarDays },
        ].map(k => (
          <div key={k.label} role="listitem" className={`rounded-xl border px-3 py-2 ${k.bg}`}>
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold truncate">{k.label}</p>
              <k.Icon size={12} className={k.color} aria-hidden="true" />
            </div>
            <p className={`text-sm sm:text-base font-bold ${k.color} truncate`}>{k.value}</p>
            <p className="text-xs text-muted-foreground truncate">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Primeiro nível: Cobranças + painel lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section
          id="hoje-cobrancas"
          aria-labelledby="hoje-cobrancas-title"
          className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/60 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
            <h2 id="hoje-cobrancas-title" className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Receipt size={12} className="text-primary" /> Cobranças prioritárias
            </h2>
            <button onClick={() => navigate("/cobrancas")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          <ul className="divide-y divide-border/20 max-h-[380px] overflow-y-auto">
            {[...(data?.overdue || []), ...(data?.dueToday || [])].length === 0 && (
              <li className="py-10 text-center list-none">
                <CheckCircle2 size={28} className="mx-auto text-success/60 mb-1.5" />
                <p className="text-xs font-semibold text-foreground">Tudo em dia!</p>
              </li>
            )}
            {[...(data?.overdue || []), ...(data?.dueToday || [])].slice(0, 30).map((inst: any) => {
              const dueLocal = parseLocalDate(inst.due_date) ?? new Date(inst.due_date);
              const isOverdue = dueLocal < startOfToday();
              const daysLate = isOverdue ? Math.floor((startOfToday().getTime() - dueLocal.getTime()) / 86400000) : 0;
              const clientName = inst.clients?.name || "Cliente";
              const amount = Number(inst.amount);
              return (
                <li key={inst.id} className="px-3 py-2 flex items-center gap-2 hover:bg-accent/20 transition-colors">
                  <button onClick={() => navigate(`/clientes/${inst.client_id}`)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold text-foreground truncate">{clientName}</p>
                      {isOverdue && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{daysLate}d</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Parc {inst.installment_number} · {fmtTime(inst.due_date)}
                      {inst.contract_id && (
                        <span className="ml-1 px-1 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs" title={`Contrato ${inst.contract_id}`}>
                          #{String(inst.contract_id).slice(0, 6)}
                        </span>
                      )}
                    </p>
                  </button>
                  <p className="text-xs font-bold text-foreground shrink-0">R$ {fmtBRL(amount)}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => sendWhats(inst.clients?.whatsapp || inst.clients?.phone, clientName, undefined, amount, inst.due_date)}
                      className="min-w-8 min-h-8 p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20"
                      aria-label="WhatsApp"
                    >
                      <MessageSquare size={12} />
                    </button>
                    <button
                      onClick={() => markPaid(inst.id, amount)}
                      disabled={savingId === inst.id}
                      className="min-h-8 px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingId === inst.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      <span className="hidden sm:inline">Pagar</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-3" aria-label="Tarefas e alertas">
          <section className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <ListTodo size={12} className="text-amber-400" /> Tarefas
              </h2>
              <button onClick={() => navigate("/ferramentas/tarefas")} className="text-xs text-primary hover:underline">Ver tudo</button>
            </div>
            <ul className="divide-y divide-border/20 max-h-48 overflow-y-auto">
              {data?.todos.length === 0 && (
                <li className="px-3 py-5 text-xs text-muted-foreground text-center list-none">Nenhuma tarefa</li>
              )}
              {data?.todos.map((t: any) => (
                <li key={t.id}>
                  <button
                    onClick={() => toggleTodo(t.id, t.is_complete)}
                    className="w-full px-3 py-2 flex items-start gap-2 hover:bg-accent/20 transition-colors text-left"
                  >
                    <div className="w-3.5 h-3.5 mt-0.5 rounded border-2 border-border shrink-0" />
                    <p className="text-xs text-foreground flex-1 leading-snug">{t.task}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {data?.promises && data.promises.length > 0 && (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
              <div className="px-3 py-2 border-b border-primary/20">
                <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <Sparkles size={12} /> Promessas IA
                </h2>
              </div>
              <ul className="divide-y divide-primary/10">
                {data.promises.map((p: any) => (
                  <li key={p.id} className="px-3 py-2">
                    <p className="text-xs font-bold text-foreground">{p.client}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 italic">"{p.msg}"</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Clock size={9} className="text-primary" />
                      <span className="text-xs font-bold text-primary">{p.date ? formatBR(p.date) : '??'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <SmartAlerts
            overdue={data?.overdue || []}
            dueToday={data?.dueToday || []}
            notifications={data?.notifications || []}
          />
        </aside>
      </div>

      {/* Segundo nível: 4 painéis novos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Top 5 devedores */}
        <section className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Flame size={12} className="text-destructive" /> Top devedores
            </h2>
          </div>
          <ul className="divide-y divide-border/20 max-h-72 overflow-y-auto">
            {(data?.topDebtors || []).length === 0 && (
              <li className="px-3 py-5 text-xs text-muted-foreground text-center list-none">Sem atrasos 🎉</li>
            )}
            {(data?.topDebtors || []).map((d, idx) => (
              <li key={d.id} className="px-3 py-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-destructive/15 text-destructive text-xs font-bold flex items-center justify-center shrink-0">{idx+1}</span>
                <button onClick={() => navigate(`/clientes/${d.id}`)} className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-foreground truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.count} parcelas · R$ {fmtBRL(d.total)}</p>
                </button>
                <button
                  onClick={() => sendWhats(d.whatsapp || d.phone, d.name, `Olá ${d.name}, identificamos parcelas em atraso totalizando R$ ${fmtBRL(d.total)}. Podemos regularizar?`)}
                  className="min-w-8 min-h-8 p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20"
                >
                  <MessageSquare size={11} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Agenda 7 dias */}
        <section className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <CalendarDays size={12} className="text-primary" /> Agenda 7 dias
            </h2>
            <button onClick={() => navigate("/cobrancas")} className="text-xs text-primary hover:underline">Ver</button>
          </div>
          <ul className="divide-y divide-border/20 max-h-72 overflow-y-auto">
            {(data?.agenda || []).length === 0 && (
              <li className="px-3 py-5 text-xs text-muted-foreground text-center list-none">Sem vencimentos</li>
            )}
            {(data?.agenda || []).map(d => (
              <li key={d.date} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground capitalize">{fmtDayLabel(d.date)}</p>
                  <p className="text-xs text-muted-foreground">{d.items.length} parcela{d.items.length !== 1 ? "s" : ""}</p>
                </div>
                <p className="text-xs font-bold text-primary shrink-0">R$ {fmtBRL(d.total)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Aniversariantes */}
        <section className="rounded-2xl border border-pink-500/20 bg-pink-500/5 overflow-hidden">
          <div className="px-3 py-2 border-b border-pink-500/20 flex items-center justify-between">
            <h2 className="text-sm font-bold text-pink-400 flex items-center gap-1.5">
              <Cake size={12} /> Aniversariantes
            </h2>
          </div>
          <ul className="divide-y divide-pink-500/10 max-h-72 overflow-y-auto">
            {(data?.birthdays || []).length === 0 && (
              <li className="px-3 py-5 text-xs text-muted-foreground text-center list-none">Ninguém faz aniversário hoje</li>
            )}
            {(data?.birthdays || []).map((c: any) => (
              <li key={c.id} className="px-3 py-2 flex items-center gap-2">
                <span className="text-base" aria-hidden>🎂</span>
                <button onClick={() => navigate(`/clientes/${c.id}`)} className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBR(c.birth_date)}</p>
                </button>
                <button
                  onClick={() => sendWhats(c.whatsapp || c.phone, c.name, `Feliz aniversário, ${c.name}! 🎉 Tudo de bom para você hoje.`)}
                  className="min-w-8 min-h-8 p-1.5 rounded-lg bg-pink-500/15 text-pink-400 hover:bg-pink-500/25"
                >
                  <MessageSquare size={11} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Resumo financeiro + últimos pagamentos */}
        <section className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <History size={12} className="text-success" /> Resumo do mês
            </h2>
            <button onClick={() => navigate("/financeiro")} className="text-xs text-primary hover:underline">Ver</button>
          </div>
          <div className="px-3 py-2 grid grid-cols-2 gap-2 border-b border-border/20">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Lucro</p>
              <p className="text-sm font-bold text-success">R$ {fmtBRL(data?.profitMonth || 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">A receber</p>
              <p className="text-sm font-bold text-amber-400">R$ {fmtBRL(data?.aReceberMonth || 0)}</p>
            </div>
          </div>
          <ul className="divide-y divide-border/20 flex-1 overflow-y-auto">
            <li className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground font-bold list-none">Últimos pagamentos</li>
            {(data?.paidRecent || []).length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center list-none">Nenhum recebimento</li>
            )}
            {(data?.paidRecent || []).map((p: any) => (
              <li key={p.id} className="px-3 py-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{p.clients?.name || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">{fmtTime(p.paid_at)}</p>
                </div>
                <p className="text-xs font-bold text-success shrink-0">+ R$ {fmtBRL(Number(p.paid_amount || 0))}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default Hoje;
