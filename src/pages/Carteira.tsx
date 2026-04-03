import { useState, useEffect } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

  // Merge into timeline
  const timeline = [
    ...profits.map((p) => ({ type: "in" as const, desc: p.description, amount: Number(p.amount), date: p.date, source: "Lucro" })),
    ...installments.map((i) => ({ type: "in" as const, desc: `Parcela recebida`, amount: Number(i.amount), date: i.paid_at, source: "Parcela" })),
    ...expenses.map((e) => ({ type: "out" as const, desc: e.description, amount: Number(e.amount), date: e.date, source: e.category || "Gasto" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu saldo e movimentações.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Saldo Total</span>
          </div>
          <p className={`text-2xl font-bold ${saldo >= 0 ? "text-green-400" : "text-destructive"}`}>R$ {saldo.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={18} className="text-green-400" />
            <span className="text-sm text-muted-foreground">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-green-400">R$ {totalEntradas.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={18} className="text-destructive" />
            <span className="text-sm text-muted-foreground">Saídas</span>
          </div>
          <p className="text-2xl font-bold text-destructive">R$ {totalSaidas.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Histórico de Transações</h2>
        {timeline.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma transação registrada.</div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {timeline.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === "in" ? "bg-green-500/10" : "bg-destructive/10"}`}>
                    {t.type === "in" ? <ArrowUpRight size={14} className="text-green-400" /> : <ArrowDownRight size={14} className="text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{t.desc}</p>
                    <p className="text-xs text-muted-foreground">{t.source} · {new Date(t.date).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.type === "in" ? "text-green-400" : "text-destructive"}`}>
                  {t.type === "in" ? "+" : "-"}R$ {t.amount.toFixed(2)}
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
