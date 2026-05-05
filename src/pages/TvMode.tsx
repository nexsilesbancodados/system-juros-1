import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import { ArrowLeft, Wallet, TrendingUp, AlertCircle, Users, FileSignature, Activity } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function TvMode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useMultiTableRealtime(["contracts", "contract_installments", "clients"], [["tv-mode-data", user?.id || ""]]);

  const { data } = useQuery({
    queryKey: ["tv-mode-data", user?.id],
    queryFn: async () => {
      const [c, i, cl] = await Promise.all([
        supabase.from("contracts").select("*, clients(name)").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*").eq("user_id", user!.id),
        supabase.from("clients").select("id").eq("user_id", user!.id),
      ]);
      return { contracts: c.data || [], installments: i.data || [], clients: cl.data || [] };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const m = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const active = data.contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
    const capital = active.reduce((s: number, c: any) => s + Number(c.capital), 0);
    const paid = data.installments.filter((i: any) => i.status === "paid");
    const received = paid.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const overdue = data.installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < today);
    const overdueAmt = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const paidToday = paid.filter((p: any) => p.paid_at?.startsWith(todayStr));
    const paidTodayAmt = paidToday.reduce((s: number, p: any) => s + Number(p.paid_amount || p.amount), 0);
    return { capital, received, overdue: overdueAmt, paidToday: paidTodayAmt, paidTodayCount: paidToday.length, contratos: active.length, clientes: data.clients.length, overdueCount: overdue.length };
  }, [data]);

  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const tiles = [
    { label: "Capital na Rua", value: fmt(m?.capital || 0), color: "text-primary", icon: Wallet },
    { label: "Total Recebido", value: fmt(m?.received || 0), color: "text-success", icon: TrendingUp },
    { label: "Em Atraso", value: fmt(m?.overdue || 0), color: "text-destructive", icon: AlertCircle },
    { label: "Recebido Hoje", value: fmt(m?.paidToday || 0), color: "text-success", icon: Activity },
  ];

  const small = [
    { label: "Contratos Ativos", value: m?.contratos || 0, color: "text-primary", icon: FileSignature },
    { label: "Clientes", value: m?.clientes || 0, color: "text-foreground", icon: Users },
    { label: "Parcelas Atrasadas", value: m?.overdueCount || 0, color: "text-destructive", icon: AlertCircle },
    { label: "Pagamentos Hoje", value: m?.paidTodayCount || 0, color: "text-success", icon: Activity },
  ];

  return (
    <div className="fixed inset-0 bg-background overflow-auto">
      <button
        onClick={() => navigate("/dashboard")}
        className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl bg-card/80 backdrop-blur border border-border hover:bg-card text-xs text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft size={14} /> Sair
      </button>

      <div className="min-h-screen p-6 md:p-10 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Painel ao Vivo</p>
            <h1 className="text-display text-4xl md:text-6xl text-foreground capitalize">{date}</h1>
          </div>
          <div className="text-right">
            <p className="text-display text-5xl md:text-7xl text-primary tabular-nums">{time}</p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 mt-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-success font-bold">Tempo Real</span>
            </div>
          </div>
        </div>

        {/* Big tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
          {tiles.map((t) => (
            <div key={t.label} className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-10 flex flex-col justify-between min-h-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">{t.label}</span>
                <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <t.icon size={26} className={t.color} />
                </div>
              </div>
              <p className={`text-5xl md:text-7xl font-bold tabular-nums ${t.color}`}>{t.value}</p>
            </div>
          ))}
        </div>

        {/* Small stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {small.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center">
                <s.icon size={20} className={s.color} />
              </div>
              <div>
                <p className={`text-3xl md:text-4xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
