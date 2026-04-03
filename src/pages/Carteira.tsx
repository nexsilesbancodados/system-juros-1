import { useState, useEffect } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Banknote, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const Carteira = () => {
  const { user } = useAuth();
  const [profits, setProfits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [p, e, i] = await Promise.all([
        supabase.from("profits").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("installments").select("*").eq("user_id", user.id).eq("status", "paid").order("paid_at", { ascending: false }),
      ]);
      setProfits(p.data || []);
      setExpenses(e.data || []);
      setInstallments(i.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const totalEntradas = profits.reduce((a, p) => a + Number(p.amount), 0) + installments.reduce((a, i) => a + Number(i.amount), 0);
  const totalSaidas = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const saldo = totalEntradas - totalSaidas;

  const timeline = [
    ...profits.map((p) => ({ type: "in" as const, desc: p.description, amount: Number(p.amount), date: p.date, source: "Lucro" })),
    ...installments.map((i) => ({ type: "in" as const, desc: "Parcela recebida", amount: Number(i.amount), date: i.paid_at, source: "Parcela" })),
    ...expenses.map((e) => ({ type: "out" as const, desc: e.description, amount: Number(e.amount), date: e.date, source: e.category || "Gasto" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const stats = [
    {
      icon: Wallet,
      label: "Saldo Total",
      value: `R$ ${fmt(saldo)}`,
      color: saldo >= 0 ? "text-emerald-500" : "text-destructive",
      bg: saldo >= 0 ? "bg-emerald-500/10" : "bg-destructive/10",
    },
    {
      icon: ArrowUpRight,
      label: "Total Entradas",
      value: `R$ ${fmt(totalEntradas)}`,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: ArrowDownRight,
      label: "Total Saídas",
      value: `R$ ${fmt(totalSaidas)}`,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  // Progress bar
  const total = totalEntradas + totalSaidas || 1;
  const entradasPct = Math.round((totalEntradas / total) * 100);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Banknote size={24} className="text-primary" /> Carteira
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu saldo e movimentações.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s, idx) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 animate-fade-in card-hover" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={20} className={s.color} />
              </div>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Balance Bar */}
      <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" /> Proporção Entradas / Saídas
          </span>
          <span className="text-xs text-muted-foreground">{entradasPct}% entradas</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${entradasPct}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Entradas: R$ {fmt(totalEntradas)}</span>
          <span>Saídas: R$ {fmt(totalSaidas)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <CreditCard size={18} className="text-primary" /> Histórico de Transações
          </h2>
          <span className="text-xs text-muted-foreground">{timeline.length} transações</span>
        </div>
        {timeline.length === 0 ? (
          <div className="text-center py-12">
            <Wallet size={48} className="mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground text-sm">Nenhuma transação registrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {timeline.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${t.type === "in" ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                    {t.type === "in" ? <ArrowUpRight size={16} className="text-emerald-500" /> : <ArrowDownRight size={16} className="text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.desc}</p>
                    <p className="text-xs text-muted-foreground">{t.source} · {new Date(t.date).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.type === "in" ? "text-emerald-500" : "text-destructive"}`}>
                  {t.type === "in" ? "+" : "−"}R$ {fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Carteira;
