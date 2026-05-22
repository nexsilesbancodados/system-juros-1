import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import { toast } from "sonner";
import {
  Sunrise, AlertCircle, CheckCircle2, Bell, ListTodo, Receipt,
  TrendingUp, ArrowRight, Phone, MessageSquare, Loader2, Plus, Clock
} from "lucide-react";
import SmartAlerts from "@/components/SmartAlerts";

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

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

      const [dueTodayRes, overdueRes, todosRes, notifRes, profitsTodayRes] = await Promise.all([
        supabase.from("contract_installments")
          .select("id, amount, due_date, installment_number, client_id, clients:client_id(name, phone, whatsapp)")
          .eq("user_id", user.id).eq("status", "pending")
          .gte("due_date", today).lte("due_date", eod)
          .order("due_date", { ascending: true }).limit(50),
        supabase.from("contract_installments")
          .select("id, amount, due_date, installment_number, client_id, clients:client_id(name, phone, whatsapp)")
          .eq("user_id", user.id).eq("status", "pending")
          .lt("due_date", today)
          .order("due_date", { ascending: true }).limit(50),
        supabase.from("todos").select("id, task, is_complete").eq("user_id", user.id).eq("is_complete", false).order("created_at", { ascending: false }).limit(8),
        supabase.from("notifications").select("id, message, type, link, sent_at").eq("user_id", user.id).eq("is_read", false).order("sent_at", { ascending: false }).limit(5),
        supabase.from("profits").select("amount").eq("user_id", user.id).gte("date", today).lte("date", eod),
      ]);

      return {
        dueToday: dueTodayRes.data || [],
        overdue: overdueRes.data || [],
        todos: todosRes.data || [],
        notifications: notifRes.data || [],
        profitToday: (profitsTodayRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0),
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

  const sendWhats = (phone?: string, clientName?: string, amount?: number, due?: string) => {
    if (!phone) { toast.error("Cliente sem telefone"); return; }
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("55") ? clean : `55${clean}`;
    const msg = encodeURIComponent(`Olá ${clientName || ""}! Lembrete da parcela de R$ ${fmtBRL(amount || 0)} vencendo em ${due ? fmtTime(due) : "breve"}.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 rounded-2xl bg-muted/30" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/30" />)}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="hoje-title">
      {/* Skip-link para conteúdo principal */}
      <a
        href="#hoje-cobrancas"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-bold"
      >
        Pular para cobranças prioritárias
      </a>

      {/* Header / saudação */}
      <header className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-card/60 to-card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
            <Sunrise size={12} aria-hidden="true" /> {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <h1 id="hoje-title" className="text-2xl font-bold text-foreground mt-1">{greeting} <span aria-hidden="true">👋</span></h1>
          <p className="text-sm text-muted-foreground mt-0.5" aria-live="polite">
            {totals.dueTodayCount === 0 && totals.overdueCount === 0
              ? "Sem cobranças pendentes hoje. Bom trabalho!"
              : `${totals.dueTodayCount} cobrança${totals.dueTodayCount !== 1 ? "s" : ""} hoje · ${totals.overdueCount} em atraso`}
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => navigate("/clientes/novo")}
            aria-label="Cadastrar novo cliente"
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus size={14} aria-hidden="true" /> Novo cliente
          </button>
        </div>
      </header>

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="list" aria-label="Indicadores do dia">
        {[
          { label: "Vencendo hoje", value: `R$ ${fmtBRL(totals.dueToday)}`, sub: `${totals.dueTodayCount} parcela${totals.dueTodayCount !== 1 ? "s" : ""}`, color: "text-primary", bg: "bg-primary/5 border-primary/15", Icon: Clock },
          { label: "Em atraso", value: `R$ ${fmtBRL(totals.overdue)}`, sub: `${totals.overdueCount} parcela${totals.overdueCount !== 1 ? "s" : ""}`, color: "text-destructive", bg: "bg-destructive/5 border-destructive/15", Icon: AlertCircle },
          { label: "Lucro hoje", value: `R$ ${fmtBRL(data?.profitToday || 0)}`, sub: "entradas registradas", color: "text-success", bg: "bg-success/5 border-success/15", Icon: TrendingUp },
          { label: "Tarefas abertas", value: String(data?.todos.length || 0), sub: "pendentes", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/15", Icon: ListTodo },
        ].map(k => (
          <div
            key={k.label}
            role="listitem"
            aria-label={`${k.label}: ${k.value}, ${k.sub}`}
            className={`rounded-2xl border p-4 ${k.bg}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{k.label}</p>
              <k.Icon size={14} className={k.color} aria-hidden="true" />
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cobranças do dia */}
        <section
          id="hoje-cobrancas"
          aria-labelledby="hoje-cobrancas-title"
          className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/60 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <h2 id="hoje-cobrancas-title" className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt size={14} className="text-primary" aria-hidden="true" /> Cobranças prioritárias
            </h2>
            <button
              onClick={() => navigate("/cobrancas")}
              aria-label="Ver todas as cobranças"
              className="text-[11px] text-primary hover:underline flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary px-1"
            >
              Ver todas <ArrowRight size={11} aria-hidden="true" />
            </button>
          </div>
          <ul className="divide-y divide-border/20 max-h-[440px] overflow-y-auto" aria-label="Lista de cobranças prioritárias">
            {[...(data?.overdue || []), ...(data?.dueToday || [])].length === 0 && (
              <li className="py-12 text-center list-none">
                <CheckCircle2 size={32} className="mx-auto text-success/60 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma cobrança pendente para hoje</p>
              </li>
            )}
            {[...(data?.overdue || []), ...(data?.dueToday || [])].map((inst: any) => {
              const isOverdue = new Date(inst.due_date) < startOfToday();
              const daysLate = isOverdue ? Math.floor((startOfToday().getTime() - new Date(inst.due_date).getTime()) / 86400000) : 0;
              const clientName = inst.clients?.name || "Cliente";
              const amount = Number(inst.amount);
              return (
                <li key={inst.id} className="px-4 py-3 flex items-center gap-3 hover:bg-accent/20 focus-within:bg-accent/20 transition-colors">
                  <button
                    onClick={() => navigate(`/clientes/${inst.client_id}`)}
                    aria-label={`Abrir detalhes de ${clientName}, parcela ${inst.installment_number}${isOverdue ? `, ${daysLate} dias atrasada` : ""}`}
                    className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{clientName}</p>
                      {isOverdue && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold" aria-label={`${daysLate} dias em atraso`}>
                          {daysLate}d atrasado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Parcela {inst.installment_number} · Vence {fmtTime(inst.due_date)}
                    </p>
                  </button>
                  <p className="text-sm font-bold text-foreground shrink-0" aria-label={`Valor R$ ${fmtBRL(amount)}`}>
                    R$ {fmtBRL(amount)}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => sendWhats(inst.clients?.whatsapp || inst.clients?.phone, clientName, amount, inst.due_date)}
                      aria-label={`Enviar lembrete por WhatsApp para ${clientName}`}
                      className="min-w-9 min-h-9 p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
                    >
                      <MessageSquare size={13} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => markPaid(inst.id, amount)}
                      disabled={savingId === inst.id}
                      aria-label={`Marcar parcela ${inst.installment_number} de ${clientName} como paga, valor R$ ${fmtBRL(amount)}`}
                      className="min-h-9 px-2.5 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    >
                      {savingId === inst.id ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
                      <span className="hidden sm:inline">Pagar</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Painel lateral: tarefas + alertas */}
        <aside className="space-y-4" aria-label="Tarefas e alertas">
          {/* Tarefas */}
          <section aria-labelledby="hoje-tarefas-title" className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h2 id="hoje-tarefas-title" className="text-sm font-bold text-foreground flex items-center gap-2">
                <ListTodo size={14} className="text-amber-400" aria-hidden="true" /> Tarefas
              </h2>
              <button
                onClick={() => navigate("/ferramentas/tarefas")}
                aria-label="Ver todas as tarefas"
                className="text-[11px] text-primary hover:underline rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Ver tudo
              </button>
            </div>
            <ul className="divide-y divide-border/20 max-h-60 overflow-y-auto" aria-label="Lista de tarefas pendentes">
              {data?.todos.length === 0 && (
                <li className="px-4 py-6 text-xs text-muted-foreground text-center list-none">Nenhuma tarefa pendente</li>
              )}
              {data?.todos.map((t: any) => (
                <li key={t.id}>
                  <button
                    onClick={() => toggleTodo(t.id, t.is_complete)}
                    role="checkbox"
                    aria-checked={t.is_complete}
                    aria-label={`Marcar tarefa como ${t.is_complete ? "pendente" : "concluída"}: ${t.task}`}
                    className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-accent/20 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <div className="w-4 h-4 mt-0.5 rounded border-2 border-border shrink-0" aria-hidden="true" />
                    <p className="text-xs text-foreground flex-1 leading-snug">{t.task}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Alertas inteligentes agrupados */}
          <SmartAlerts
            overdue={data?.overdue || []}
            dueToday={data?.dueToday || []}
            notifications={data?.notifications || []}
          />
        </aside>
      </div>
    </section>
  );
};

export default Hoje;
