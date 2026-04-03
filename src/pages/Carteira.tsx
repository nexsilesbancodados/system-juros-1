import { useState, useEffect, useMemo } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Banknote, CreditCard, Plus, Minus, Calendar, Search, X, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Carteira = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profits, setProfits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [searchTimeline, setSearchTimeline] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    const [p, e, i] = await Promise.all([
      supabase.from("profits").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("contract_installments").select("*").eq("user_id", user.id).eq("status", "paid").order("paid_at", { ascending: false }),
    ]);
    setProfits(p.data || []);
    setExpenses(e.data || []);
    setInstallments(i.data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchAll(); }, [user]);

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
      const { error } = await supabase.from("profits").insert({ user_id: user.id, amount: val, description, date: now });
      if (error) { toast({ title: "Erro ao adicionar entrada", variant: "destructive" }); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("expenses").insert({ user_id: user.id, amount: val, description, date: now, category: "Retirada manual" });
      if (error) { toast({ title: "Erro ao registrar saída", variant: "destructive" }); setSaving(false); return; }
    }

    toast({ title: dialogType === "in" ? "✓ Entrada adicionada!" : "✓ Saída registrada!" });
    setAmount(""); setDescription(""); setDialogOpen(false); setSaving(false);
    setLoading(true); fetchAll();
  };

  const totalEntradas = profits.reduce((a, p) => a + Number(p.amount), 0) + installments.reduce((a, i) => a + Number(i.paid_amount || i.amount), 0);
  const totalSaidas = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const saldo = totalEntradas - totalSaidas;

  const timeline = useMemo(() => {
    const all = [
      ...profits.map((p) => ({ type: "in" as const, desc: p.description, amount: Number(p.amount), date: p.date, source: "Lucro" })),
      ...installments.map((i) => ({ type: "in" as const, desc: "Parcela recebida", amount: Number(i.amount), date: i.paid_at, source: "Parcela" })),
      ...expenses.map((e) => ({ type: "out" as const, desc: e.description, amount: Number(e.amount), date: e.date, source: e.category || "Gasto" })),
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
  }, [profits, expenses, installments, timeFilter, searchTimeline]);

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

  // Group timeline by date
  const grouped = timeline.reduce((acc, t) => {
    const key = new Date(t.date).toLocaleDateString("pt-BR");
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, typeof timeline>);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote size={24} className="text-primary" /> Carteira
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do seu saldo e movimentações.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen && dialogType === "in"} onOpenChange={(o) => { setDialogOpen(o); if (o) setDialogType("in"); }}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 font-medium text-sm transition-colors">
                <Plus size={16} /> Entrada
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-success">
                  <ArrowUpRight size={20} /> Adicionar Entrada
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Descrição</Label><Input placeholder="Ex: Depósito, Recebimento..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div><Label>Valor (R$)</Label><Input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <button disabled={saving || !amount || !description} onClick={handleSave} className="w-full py-2.5 rounded-lg bg-success text-success-foreground font-medium hover:opacity-90 transition-colors disabled:opacity-50">
                  {saving ? "Salvando..." : "Confirmar Entrada"}
                </button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen && dialogType === "out"} onOpenChange={(o) => { setDialogOpen(o); if (o) setDialogType("out"); }}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium text-sm transition-colors">
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
                <button disabled={saving || !amount || !description} onClick={handleSave} className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-colors disabled:opacity-50">
                  {saving ? "Salvando..." : "Confirmar Saída"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
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
