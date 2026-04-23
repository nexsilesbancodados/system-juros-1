import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Database, Users, FileText, DollarSign, AlertCircle,
  HardDrive, Activity, TrendingUp, Briefcase
} from "lucide-react";

type Counts = {
  clients: number;
  contracts: number;
  installments: number;
  overdue: number;
  transactions: number;
  expenses: number;
  notifications: number;
  vehicles: number;
  pledges: number;
  totalCapital: number;
  totalProfit: number;
  totalExpense: number;
};

export const SystemHealth = () => {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        clientsR, contractsR, instR, overdueR, txR, expR, notifR, vehR, pledgeR, profilesR,
      ] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("contract_installments").select("id", { count: "exact", head: true }),
        supabase.from("contract_installments").select("id", { count: "exact", head: true }).eq("status", "overdue"),
        supabase.from("transactions").select("id", { count: "exact", head: true }),
        supabase.from("expenses").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }),
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
        supabase.from("pledges").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("loan_balance, profit_balance, expense_balance"),
      ]);

      const profiles = (profilesR.data || []) as Array<{ loan_balance: number; profit_balance: number; expense_balance: number }>;
      const totalCapital = profiles.reduce((s, p) => s + Number(p.loan_balance || 0), 0);
      const totalProfit = profiles.reduce((s, p) => s + Number(p.profit_balance || 0), 0);
      const totalExpense = profiles.reduce((s, p) => s + Number(p.expense_balance || 0), 0);

      setCounts({
        clients: clientsR.count || 0,
        contracts: contractsR.count || 0,
        installments: instR.count || 0,
        overdue: overdueR.count || 0,
        transactions: txR.count || 0,
        expenses: expR.count || 0,
        notifications: notifR.count || 0,
        vehicles: vehR.count || 0,
        pledges: pledgeR.count || 0,
        totalCapital, totalProfit, totalExpense,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!counts) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  const items = [
    { icon: Users, label: "Clientes (todos tenants)", value: counts.clients, tone: "primary" },
    { icon: FileText, label: "Contratos ativos", value: counts.contracts, tone: "info" },
    { icon: Briefcase, label: "Parcelas geradas", value: counts.installments, tone: "accent" },
    { icon: AlertCircle, label: "Parcelas vencidas", value: counts.overdue, tone: "danger" },
    { icon: Activity, label: "Transações", value: counts.transactions, tone: "success" },
    { icon: HardDrive, label: "Veículos cadastrados", value: counts.vehicles, tone: "warning" },
    { icon: Database, label: "Notificações", value: counts.notifications, tone: "primary" },
    { icon: TrendingUp, label: "Penhoras", value: counts.pledges, tone: "accent" },
  ];

  const tones: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    success: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
    danger: "from-destructive/20 to-destructive/5 text-destructive",
    warning: "from-amber-500/20 to-amber-500/5 text-amber-500",
    accent: "from-purple-500/20 to-purple-500/5 text-purple-400",
    info: "from-sky-500/20 to-sky-500/5 text-sky-400",
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Saúde do Sistema</h2>
        <p className="text-sm text-muted-foreground">Estatísticas globais de toda a base de dados.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-2xl border border-border bg-card p-4">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tones[it.tone]} flex items-center justify-center mb-2`}>
              <it.icon size={16} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{it.label}</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{it.value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <DollarSign size={14} /> Capital total na rua
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{fmt(counts.totalCapital)}</p>
          <p className="text-xs text-muted-foreground mt-1">Soma de loan_balance de todos os tenants</p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <TrendingUp size={14} /> Lucro total gerado
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{fmt(counts.totalProfit)}</p>
          <p className="text-xs text-muted-foreground mt-1">Soma de profit_balance de todos os tenants</p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-destructive/10 to-transparent p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <AlertCircle size={14} /> Despesas totais
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{fmt(counts.totalExpense)}</p>
          <p className="text-xs text-muted-foreground mt-1">Soma de expense_balance de todos os tenants</p>
        </div>
      </div>
    </div>
  );
};
