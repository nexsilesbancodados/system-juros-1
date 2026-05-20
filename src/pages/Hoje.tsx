import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
    <div className="space-y-5">
      {/* Header / saudação */}
      <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-card/60 to-card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
            <Sunrise size={12} /> {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <h1 className="text-2xl font-bold text-foreground mt-1">{greeting} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totals.dueTodayCount === 0 && totals.overdueCount === 0
              ? "Sem cobranças pendentes hoje. Bom trabalho!"
              : `${totals.dueTodayCount} cobrança${totals.dueTodayCount !== 1 ? "s" : ""} hoje · ${totals.overdueCount} em atraso`}
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <button onClick={() => navigate("/clientes/novo")} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus size={14} /> Novo cliente
          </button>
        </div>
      </div>

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Vencendo hoje", value: `R$ ${fmtBRL(totals.dueToday)}`, sub: `${totals.dueTodayCount} parcela${totals.dueTodayCount !== 1 ? "s" : ""}`, color: "text-primary", bg: "bg-primary/5 border-primary/15", Icon: Clock },
          { label: "Em atraso", value: `R$ ${fmtBRL(totals.overdue)}`, sub: `${totals.overdueCount} parcela${totals.overdueCount !== 1 ? "s" : ""}`, color: "text-destructive", bg: "bg-destructive/5 border-destructive/15", Icon: AlertCircle },
          { label: "Lucro hoje", value: `R$ ${fmtBRL(data?.profitToday || 0)}`, sub: "entradas registradas", color: "text-success", bg: "bg-success/5 border-success/15", Icon: TrendingUp },
          { label: "Tarefas abertas", value: String(data?.todos.length || 0), sub: "pendentes", color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/15", Icon: ListTodo },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{k.label}</p>
              <k.Icon size={14} className={k.color} />
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cobranças do dia */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt size={14} className="text-primary" /> Cobranças prioritárias
            </h2>
            <button onClick={() => navigate("/cobrancas")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={11} />
            </button>
          </div>
          <div className="divide-y divide-border/20 max-h-[440px] overflow-y-auto">
            {[...(data?.overdue || []), ...(data?.dueToday || [])].length === 0 && (
              <div className="py-12 text-center">
                <CheckCircle2 size={32} className="mx-auto text-success/60 mb-2" />
                <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma cobrança pendente para hoje</p>
              </div>
            )}
            {[...(data?.overdue || []), ...(data?.dueToday || [])].map((inst: any) => {
              const isOverdue = new Date(inst.due_date) < startOfToday();
              const daysLate = isOverdue ? Math.floor((startOfToday().getTime() - new Date(inst.due_date).getTime()) / 86400000) : 0;
              return (
                <div key={inst.id} className="px-4 py-3 flex items-center gap-3 hover:bg-accent/20 transition-colors">
                  <button onClick={() => navigate(`/clientes/${inst.client_id}`)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{inst.clients?.name || "Cliente"}</p>
                      {isOverdue && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">
                          {daysLate}d atrasado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Parcela {inst.installment_number} · Vence {fmtTime(inst.due_date)}
                    </p>
                  </button>
                  <p className="text-sm font-bold text-foreground shrink-0">R$ {fmtBRL(Number(inst.amount))}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => sendWhats(inst.clients?.whatsapp || inst.clients?.phone, inst.clients?.name, Number(inst.amount), inst.due_date)}
                      className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                      title="WhatsApp"
                    >
                      <MessageSquare size={13} />
                    </button>
                    <button
                      onClick={() => markPaid(inst.id, Number(inst.amount))}
                      disabled={savingId === inst.id}
                      className="px-2.5 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                      title="Marcar como pago"
                    >
                      {savingId === inst.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      <span className="hidden sm:inline">Pagar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel lateral: tarefas + notificações */}
        <div className="space-y-4">
          {/* Tarefas */}
          <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ListTodo size={14} className="text-amber-400" /> Tarefas
              </h2>
              <button onClick={() => navigate("/ferramentas/tarefas")} className="text-[11px] text-primary hover:underline">Ver tudo</button>
            </div>
            <div className="divide-y divide-border/20 max-h-60 overflow-y-auto">
              {data?.todos.length === 0 && (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Nenhuma tarefa pendente</p>
              )}
              {data?.todos.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => toggleTodo(t.id, t.is_complete)}
                  className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-accent/20 transition-colors text-left"
                >
                  <div className="w-4 h-4 mt-0.5 rounded border-2 border-border shrink-0" />
                  <p className="text-xs text-foreground flex-1 leading-snug">{t.task}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Notificações */}
          <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Bell size={14} className="text-orange-400" /> Notificações
              </h2>
              <button onClick={() => navigate("/notificacoes")} className="text-[11px] text-primary hover:underline">Ver tudo</button>
            </div>
            <div className="divide-y divide-border/20 max-h-60 overflow-y-auto">
              {data?.notifications.length === 0 && (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Tudo lido</p>
              )}
              {data?.notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => n.link && navigate(n.link)}
                  className="w-full px-4 py-2.5 hover:bg-accent/20 transition-colors text-left"
                >
                  <p className="text-xs text-foreground leading-snug">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.sent_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hoje;
