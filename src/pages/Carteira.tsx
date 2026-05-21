import { useState, useMemo } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Banknote, CreditCard, Plus, Minus, Calendar, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";

const Carteira = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [searchTimeline, setSearchTimeline] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"in" | "out" | "withdraw">("in");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Realtime subscriptions
  useMultiTableRealtime(
    ["profits", "expenses", "contract_installments", "transactions"],
    [["carteira-profits", user?.id || ""], ["carteira-expenses", user?.id || ""], ["carteira-installments", user?.id || ""], ["carteira-capital", user?.id || ""], ["carteira-withdrawals", user?.id || ""]],
  );

  const { data: profits = [], isLoading: loadingProfits } = useQuery({
    queryKey: ["carteira-profits", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profits").select("*").eq("user_id", user!.id).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["carteira-expenses", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").eq("user_id", user!.id).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: installments = [], isLoading: loadingInst } = useQuery({
    queryKey: ["carteira-installments", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("contract_installments").select("*").eq("user_id", user!.id).eq("status", "paid").order("paid_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Aportes de capital (dinheiro disponível para emprestar - NÃO é lucro)
  const { data: capital = [], isLoading: loadingCapital } = useQuery({
    queryKey: ["carteira-capital", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user!.id).eq("type", "capital_injection").order("date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Retiradas de capital
  const { data: withdrawals = [], isLoading: loadingWithdraw } = useQuery({
    queryKey: ["carteira-withdrawals", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user!.id).eq("type", "capital_withdrawal").order("date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const loading = loadingProfits || loadingExpenses || loadingInst || loadingCapital || loadingWithdraw;

  const handleSave = async () => {
    if (!user || !amount || !description) return;
    setSaving(true);
    const now = new Date().toISOString();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      setSaving(false);
      return;
    }

    if (dialogType === "in") {
      // Aporte de capital: dinheiro disponível para emprestar, NÃO é lucro
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id, amount: val, description, date: now,
        type: "capital_injection", category: "Aporte de capital",
      });
      if (error) { toast({ title: "Erro ao adicionar aporte", variant: "destructive" }); setSaving(false); return; }
    } else if (dialogType === "withdraw") {
      // Retirada de capital: reduz o capital disponível, NÃO é gasto/despesa
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id, amount: val, description, date: now,
        type: "capital_withdrawal", category: "Retirada de capital",
      });
      if (error) { toast({ title: "Erro ao retirar capital", variant: "destructive" }); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("expenses").insert({ user_id: user.id, amount: val, description, date: now, category: "Retirada manual" });
      if (error) { toast({ title: "Erro ao registrar saída", variant: "destructive" }); setSaving(false); return; }
    }

    toast({ title: dialogType === "in" ? "✓ Aporte adicionado!" : dialogType === "withdraw" ? "✓ Capital retirado!" : "✓ Saída registrada!" });
    setAmount(""); setDescription(""); setDialogOpen(false); setSaving(false);
    qc.invalidateQueries({ queryKey: ["carteira-capital"] });
    qc.invalidateQueries({ queryKey: ["carteira-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["carteira-expenses"] });
    qc.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const handleDeleteCapital = async (id: string) => {
    if (!confirm("Remover este lançamento de capital?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao remover", variant: "destructive" }); return; }
    toast({ title: "✓ Lançamento removido" });
    qc.invalidateQueries({ queryKey: ["carteira-capital"] });
    qc.invalidateQueries({ queryKey: ["carteira-withdrawals"] });
  };

  const totalCapital = capital.reduce((a: number, c: any) => a + Number(c.amount), 0);
  const totalWithdrawals = withdrawals.reduce((a: number, w: any) => a + Number(w.amount), 0);
  const totalLucros = profits.reduce((a: number, p: any) => a + Number(p.amount), 0);
  const totalParcelas = installments.reduce((a: number, i: any) => a + Number(i.paid_amount || i.amount), 0);
  const totalEntradas = totalCapital + totalLucros + totalParcelas;
  const totalSaidas = expenses.reduce((a: number, e: any) => a + Number(e.amount), 0) + totalWithdrawals;
  const saldo = totalEntradas - totalSaidas;

  const timeline = useMemo(() => {
    const all = [
      ...capital.map((c: any) => ({ type: "in" as const, desc: c.description, amount: Number(c.amount), date: c.date, source: "Aporte", removable: true, id: c.id })),
      ...withdrawals.map((w: any) => ({ type: "out" as const, desc: w.description, amount: Number(w.amount), date: w.date, source: "Retirada de capital", removable: true, id: w.id })),
      ...profits.map((p: any) => ({ type: "in" as const, desc: p.description, amount: Number(p.amount), date: p.date, source: "Lucro", removable: false, id: p.id })),
      ...installments.map((i: any) => ({ type: "in" as const, desc: "Parcela recebida", amount: Number(i.amount), date: i.paid_at, source: "Parcela", removable: false, id: i.id })),
      ...expenses.map((e: any) => ({ type: "out" as const, desc: e.description, amount: Number(e.amount), date: e.date, source: e.category || "Gasto", removable: false, id: e.id })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const now = new Date();
    const filterDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = filterDays[timeFilter];

    return all.filter(t => {
      if (days) {
        const diff = (now.getTime() - new Date(t.date).getTime()) / 86400000;
        if (diff > days) return false;
      }
      if (searchTimeline && !t.desc.toLowerCase().includes(searchTimeline.toLowerCase()) && !t.source.toLowerCase().includes(searchTimeline.toLowerCase())) return false;
      return true;
    });
  }, [profits, expenses, installments, capital, withdrawals, timeFilter, searchTimeline]);

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

  const total = totalEntradas + totalSaidas || 1;
  const entradasPct = Math.round((totalEntradas / total) * 100);

  const grouped = timeline.reduce((acc, t) => {
    const key = new Date(t.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, typeof timeline>);

  return (
    <div className="space-y-6">
      <div className="page-hero animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.2)]">
              <Banknote size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-headline text-2xl md:text-3xl text-foreground">Carteira</h1>
              <p className="text-muted-foreground text-sm mt-1">Visão geral do seu saldo e movimentações.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={dialogOpen && dialogType === "in"} onOpenChange={(o) => { setDialogOpen(o); if (o) setDialogType("in"); }}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-success/15 text-success hover:bg-success/25 font-semibold text-sm transition-colors border border-success/20">
                  <Plus size={16} /> Aporte
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-success">
                    <ArrowUpRight size={20} /> Adicionar Aporte de Capital
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground -mt-1">Dinheiro disponível para emprestar. Não conta como lucro.</p>
                  <div><Label>Descrição</Label><Input placeholder="Ex: Depósito inicial, Aporte sócio..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <button disabled={saving || !amount || !description} onClick={handleSave} className="w-full py-2.5 rounded-xl bg-success text-success-foreground font-semibold hover:opacity-90 transition-colors disabled:opacity-50">
                    {saving ? "Salvando..." : "Confirmar Aporte"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen && dialogType === "withdraw"} onOpenChange={(o) => { setDialogOpen(o); if (o) setDialogType("withdraw"); }}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-warning/15 text-warning hover:bg-warning/25 font-semibold text-sm transition-colors border border-warning/20">
                  <Minus size={16} /> Retirar Capital
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-warning">
                    <ArrowDownRight size={20} /> Retirar Capital
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground -mt-1">Reduz o capital disponível para emprestar. Não é gasto/despesa.</p>
                  <div><Label>Descrição</Label><Input placeholder="Ex: Devolução sócio, Saque pessoal..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <button disabled={saving || !amount || !description} onClick={handleSave} className="w-full py-2.5 rounded-xl bg-warning text-warning-foreground font-semibold hover:opacity-90 transition-colors disabled:opacity-50">
                    {saving ? "Salvando..." : "Confirmar Retirada"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen && dialogType === "out"} onOpenChange={(o) => { setDialogOpen(o); if (o) setDialogType("out"); }}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-destructive/15 text-destructive hover:bg-destructive/25 font-semibold text-sm transition-colors border border-destructive/20">
                  <Minus size={16} /> Saída
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <ArrowDownRight size={20} /> Registrar Saída
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Descrição</Label><Input placeholder="Ex: Saque, Pagamento..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <button disabled={saving || !amount || !description} onClick={handleSave} className="w-full py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-colors disabled:opacity-50">
                    {saving ? "Salvando..." : "Confirmar Saída"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-fade-in">
        {[
          { icon: Wallet, label: "Saldo Total", value: `R$ ${fmt(saldo)}`, color: saldo >= 0 ? "text-success" : "text-destructive", bg: saldo >= 0 ? "bg-success/10" : "bg-destructive/10", glow: saldo >= 0 ? "success-glow" : "danger-glow" },
          { icon: ArrowUpRight, label: "Total Entradas", value: `R$ ${fmt(totalEntradas)}`, color: "text-success", bg: "bg-success/10", glow: "" },
          { icon: ArrowDownRight, label: "Total Saídas", value: `R$ ${fmt(totalSaidas)}`, color: "text-destructive", bg: "bg-destructive/10", glow: "" },
        ].map((s, idx) => (
          <div key={s.label} className={`rounded-2xl border border-border bg-card p-5 card-shine ${s.glow}`} style={{ animationDelay: `${idx * 100}ms` }}>
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
      <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" /> Proporção Entradas / Saídas
          </span>
          <span className="text-xs text-muted-foreground">{entradasPct}% entradas</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-success transition-all duration-700" style={{ width: `${entradasPct}%` }} />
          <div className="h-full bg-destructive/60 transition-all duration-700" style={{ width: `${100 - entradasPct}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="status-dot status-dot-success" /> Entradas: R$ {fmt(totalEntradas)}</span>
          <span className="flex items-center gap-1"><span className="status-dot status-dot-danger" /> Saídas: R$ {fmt(totalSaidas)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky-header">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <CreditCard size={18} className="text-primary" /> Histórico
            <span className="text-xs text-muted-foreground font-normal">({timeline.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar..." value={searchTimeline} onChange={e => setSearchTimeline(e.target.value)}
                className="pl-8 pr-7 py-1.5 rounded-lg bg-accent/50 border border-border text-xs text-foreground placeholder:text-muted-foreground w-36 input-enhanced" />
              {searchTimeline && <button onClick={() => setSearchTimeline("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={12} className="text-muted-foreground" /></button>}
            </div>
            <div className="pill-tabs">
              {(["all", "7d", "30d", "90d"] as const).map(f => (
                <button key={f} onClick={() => setTimeFilter(f)} className={`pill-tab text-[10px] px-2 py-1 ${timeFilter === f ? "pill-tab-active" : "pill-tab-inactive"}`}>
                  {f === "all" ? "Todos" : f}
                </button>
              ))}
            </div>
          </div>
        </div>
        {timeline.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Wallet size={28} className="text-muted-foreground/30" /></div>
            <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="divider-label px-5 py-2 text-muted-foreground sticky top-0 bg-card/95 z-[5]">
                  <Calendar size={10} /> {date}
                </div>
                <div className="divide-y divide-border/50">
                  {items.map((t, idx) => (
                    <div key={idx} className="data-row px-5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.type === "in" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {t.type === "in" ? <ArrowUpRight size={16} className="text-success" /> : <ArrowDownRight size={16} className="text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.desc}</p>
                        <p className="text-[10px] text-muted-foreground">{t.source}</p>
                      </div>
                      <span className={`font-semibold text-sm ${t.type === "in" ? "text-success" : "text-destructive"}`}>
                        {t.type === "in" ? "+" : "−"}R$ {fmt(t.amount)}
                      </span>
                      {t.removable && (
                        <button onClick={() => handleDeleteCapital(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remover">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Carteira;
