import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import {
  Download, CalendarIcon, BarChart3, Brain, FileText,
  TrendingUp, TrendingDown, Wallet, HandCoins, AlertTriangle, CheckCircle2,
  Users, FileSignature, Clock, Target, PiggyBank, Receipt,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PredictiveAnalytics } from "@/components/analises/PredictiveAnalytics";

type DetailColumn = { label: string; key: string; align?: "left" | "right"; format?: (v: any, row: any) => string };
type DetailPayload = {
  title: string;
  criteria: string;
  total?: string;
  count?: number;
  columns: DetailColumn[];
  rows: any[];
} | null;

type PresetKey = "hoje" | "ontem" | "7d" | "30d" | "mes" | "3m" | "6m" | "12m" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
  { key: "custom", label: "Personalizado" },
];

function getPresetRange(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "hoje": return { from: startOfDay(now), to: endOfDay(now) };
    case "ontem": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "mes": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "3m": return { from: subMonths(now, 3), to: now };
    case "6m": return { from: subMonths(now, 6), to: now };
    case "12m": return { from: subMonths(now, 12), to: now };
    default: return { from: subMonths(now, 6), to: now };
  }
}

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type StatTone = "default" | "success" | "danger" | "warning" | "info";

const toneClasses: Record<StatTone, { value: string; icon: string; bg: string; border: string }> = {
  default: { value: "text-foreground", icon: "text-muted-foreground", bg: "bg-muted/30", border: "" },
  success: { value: "text-success", icon: "text-success", bg: "bg-success/10", border: "border-success/20" },
  danger:  { value: "text-destructive", icon: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  warning: { value: "text-amber-500", icon: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  info:    { value: "text-primary", icon: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
};

type Stat = {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;
  positiveIsGood?: boolean;
  tone?: StatTone;
  icon?: React.ComponentType<any>;
};

function StatCard({ s, onClick }: { s: Stat; onClick?: () => void }) {
  const tone = toneClasses[s.tone || "default"];
  const Icon = s.icon;
  const showDelta = typeof s.delta === "number" && isFinite(s.delta);
  const up = showDelta && (s.delta as number) >= 0;
  const good = showDelta && ((s.positiveIsGood ?? true) ? up : !up);
  const clickable = !!onClick;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        "glass-card rounded-2xl p-4 flex flex-col gap-2 text-left w-full",
        tone.border,
        clickable && "hover:border-primary/40 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
        !clickable && "cursor-default"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
        {Icon ? (
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", tone.bg)}>
            <Icon size={15} className={tone.icon} />
          </div>
        ) : null}
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", tone.value)}>{s.value}</p>
      {showDelta ? (
        <p className={cn("text-[11px] font-semibold flex items-center gap-1", good ? "text-success" : "text-destructive")}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(s.delta as number).toFixed(1)}% vs período anterior
        </p>
      ) : s.hint ? (
        <p className="text-[11px] text-muted-foreground">{s.hint}</p>
      ) : null}
    </button>
  );
}

function DetailModal({ payload, onClose }: { payload: DetailPayload; onClose: () => void }) {
  const open = !!payload;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{payload?.title}</DialogTitle>
          <DialogDescription>{payload?.criteria}</DialogDescription>
        </DialogHeader>
        {payload && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-xs">
              {payload.total !== undefined && (
                <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold">Total: {payload.total}</div>
              )}
              {payload.count !== undefined && (
                <div className="px-3 py-1.5 rounded-lg bg-muted text-foreground font-semibold">{payload.count} item(ns)</div>
              )}
            </div>
            {payload.rows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {payload.columns.map((c) => (
                        <th key={c.key} className={cn("px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold", c.align === "right" ? "text-right" : "text-left")}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {payload.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        {payload.columns.map((c) => (
                          <td key={c.key} className={cn("px-3 py-2 tabular-nums", c.align === "right" ? "text-right" : "text-left")}>
                            {c.format ? c.format(row[c.key], row) : (row[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

const Analises = () => {
  const { user } = useAuth();
  const [activePreset, setActivePreset] = useState<PresetKey>("30d");
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [detail, setDetail] = useState<DetailPayload>(null);

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key);
    if (key !== "custom") {
      const { from, to } = getPresetRange(key);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  useMultiTableRealtime(
    ["contracts", "contract_installments", "clients", "transactions", "profits", "expenses"],
    [["analises-data", user?.id || ""]],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["analises-data", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients] = await Promise.all([
        supabase.from("contracts").select("*").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*, clients(id, name)").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status, created_at").eq("user_id", user!.id),
      ]);
      return {
        contracts: contracts.data || [],
        installments: installments.data || [],
        clients: clients.data || [],
      };
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const m = useMemo(() => {
    if (!data) return null;
    const { contracts, installments, clients } = data;
    const now = new Date();
    const rangeStart = startOfDay(dateFrom);
    const rangeEnd = endOfDay(dateTo);
    const inRange = (d: Date) => d >= rangeStart && d <= rangeEnd;
    // Normaliza due_date (que pode vir como "YYYY-MM-DD" ou ISO) para Date local sem deslocamento de fuso
    const parseDueLocal = (s: string) => {
      if (!s) return new Date(NaN);
      const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Date(s);
    };
    const dueDayStr = (s: string) => String(s || "").slice(0, 10);
    const todayStr = format(now, "yyyy-MM-dd");
    const tomorrowStr = format(subDays(now, -1), "yyyy-MM-dd");
    const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
    const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");

    const paidInRange = installments.filter((i: any) => i.status === "paid" && i.paid_at && inRange(new Date(i.paid_at)));
    const contractsInRange = contracts.filter((c: any) => c.created_at && inRange(new Date(c.created_at)));
    const dueInRange = installments.filter((i: any) => {
      const d = dueDayStr(i.due_date);
      return d >= rangeStartStr && d <= rangeEndStr;
    });

    // ─── Empréstimos no período
    const totalLent = contractsInRange.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
    const newContracts = contractsInRange.length;
    const ticketMedio = newContracts > 0 ? totalLent / newContracts : 0;
    const novosClientes = clients.filter((c: any) => c.created_at && inRange(new Date(c.created_at))).length;
    const totalProfitExpected = contractsInRange.reduce((s: number, c: any) => s + Math.max(0, Number(c.total_amount || 0) - Number(c.capital || 0)), 0);

    // ─── Recebimentos no período
    const totalReceived = paidInRange.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
    const paidCount = paidInRange.length;
    const lucroPeriodo = paidInRange.reduce((s: number, i: any) => {
      const c = contracts.find((c: any) => c.id === i.contract_id);
      if (!c?.num_installments) return s;
      const principal = Number(c.capital) / Number(c.num_installments);
      return s + Math.max(0, Number(i.paid_amount || i.amount) - principal);
    }, 0);
    const multas = paidInRange.reduce((s: number, i: any) => s + Number(i.late_fee || 0), 0);

    // ─── Atraso (saldo atual — não filtrado pelo período)
    const overdueAll = installments.filter((i: any) => i.status === "pending" && dueDayStr(i.due_date) < todayStr);
    const overdueAmount = overdueAll.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const overdueClients = new Set(overdueAll.map((i: any) => i.client_id)).size;
    const ag = (min: number, max: number) => overdueAll.filter((i: any) => {
      const d = Math.floor((startOfDay(now).getTime() - startOfDay(parseDueLocal(i.due_date)).getTime()) / 86400000);
      return d >= min && d <= max;
    });
    const aging = {
      a: ag(1, 7), b: ag(8, 15), c: ag(16, 30), d: ag(31, 60), e: ag(61, 9999),
    };
    const sumAmt = (arr: any[]) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);

    // ─── Carteira (snapshot atual)
    const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
    const capitalAtivo = activeContracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
    const aReceberTotal = installments
      .filter((i: any) => i.status === "pending")
      .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const quitados = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      return insts.length > 0 && insts.every((i: any) => i.status === "paid");
    }).length;
    const quitadosNoPeriodo = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      if (insts.length === 0 || insts.some((i: any) => i.status !== "paid")) return false;
      const last = insts.map((i: any) => i.paid_at ? new Date(i.paid_at).getTime() : 0).reduce((a, b) => Math.max(a, b), 0);
      return last >= rangeStart.getTime() && last <= rangeEnd.getTime();
    }).length;

    // ─── Capital emprestado (histórico) — independente do período
    const totalLentHistory = contracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
    // Contratos encerrados (quitados/cancelados) devolvem 100% do capital para a carteira
    const CLOSED_STATUSES = new Set(["completed", "paid", "closed", "finished", "quitado", "cancelled", "canceled"]);
    const closedContractIds = new Set(contracts.filter((c: any) => CLOSED_STATUSES.has(String(c.status || "").toLowerCase())).map((c: any) => c.id));
    const paidPrincipalAll = contracts.reduce((s: number, c: any) => {
      const cap = Number(c.capital || 0);
      if (closedContractIds.has(c.id)) return s + cap; // contrato encerrado → capital volta inteiro
      if (!c.num_installments) return s;
      const paidCount = installments.filter((i: any) => i.contract_id === c.id && i.status === "paid").length;
      return s + (cap / Number(c.num_installments)) * paidCount;
    }, 0);
    const outstandingCapital = Math.max(0, totalLentHistory - paidPrincipalAll);
    const totalProfitExpectedAll = contracts.reduce((s: number, c: any) => s + Math.max(0, Number(c.total_amount || 0) - Number(c.capital || 0)), 0);

    // ─── Cobrança / inadimplência
    // Considera "paga no prazo" apenas quando o pagamento ocorreu até a data de vencimento
    const dueAlready = dueInRange.filter((i: any) => dueDayStr(i.due_date) <= todayStr);
    const pagasNoPrazo = dueAlready.filter((i: any) => {
      if (i.status !== "paid" || !i.paid_at) return false;
      return format(new Date(i.paid_at), "yyyy-MM-dd") <= dueDayStr(i.due_date);
    }).length;
    const taxaCobranca = dueAlready.length > 0 ? (pagasNoPrazo / dueAlready.length) * 100 : 0;
    const inadRate = installments.length > 0 ? (overdueAll.length / installments.length) * 100 : 0;

    // ─── Previsão próximos 30 dias
    const upcoming = installments.filter((i: any) => {
      if (i.status !== "pending") return false;
      const d = dueDayStr(i.due_date);
      return d >= todayStr && d <= format(subDays(now, -30), "yyyy-MM-dd");
    });
    const upcoming7 = upcoming.filter((i: any) => dueDayStr(i.due_date) <= format(subDays(now, -7), "yyyy-MM-dd"));
    const forecastAmount = upcoming.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const forecast7Amount = upcoming7.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    // ─── Vence hoje / amanhã
    const dueToday = installments.filter((i: any) => i.status === "pending" && dueDayStr(i.due_date) === todayStr);
    const dueTomorrow = installments.filter((i: any) => i.status === "pending" && dueDayStr(i.due_date) === tomorrowStr);

    // ─── Comparação com período anterior
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    const prevStart = new Date(rangeStart.getTime() - rangeMs - 1);
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevLent = contracts
      .filter((c: any) => { const d = new Date(c.created_at); return d >= prevStart && d <= prevEnd; })
      .reduce((s: number, c: any) => s + Number(c.capital), 0);
    const prevReceived = installments
      .filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= prevStart && new Date(i.paid_at) <= prevEnd)
      .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);
    const prevPaidCount = installments.filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= prevStart && new Date(i.paid_at) <= prevEnd).length;
    const prevContracts = contracts.filter((c: any) => { const d = new Date(c.created_at); return d >= prevStart && d <= prevEnd; }).length;
    const prevProfit = contracts
      .filter((c: any) => { const d = new Date(c.created_at); return d >= prevStart && d <= prevEnd; })
      .reduce((s: number, c: any) => s + Math.max(0, Number(c.total_amount || 0) - Number(c.capital || 0)), 0);
    const delta = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    // ─── Top piores pagadores
    const overdueByClient = new Map<string, { name: string; amount: number; count: number; maxDays: number }>();
    overdueAll.forEach((i: any) => {
      const cid = i.client_id;
      const cname = i.clients?.name || clients.find((c: any) => c.id === cid)?.name || "—";
      const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
      const cur = overdueByClient.get(cid) || { name: cname, amount: 0, count: 0, maxDays: 0 };
      cur.amount += Number(i.amount);
      cur.count += 1;
      cur.maxDays = Math.max(cur.maxDays, days);
      overdueByClient.set(cid, cur);
    });
    const worstPayers = Array.from(overdueByClient.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // ─── Frequência dos novos contratos do período
    const freqLabels: Record<string, string> = { daily: "Diários", weekly: "Semanais", biweekly: "Quinzenais", monthly: "Mensais" };
    const freqCount: Record<string, number> = { daily: 0, weekly: 0, biweekly: 0, monthly: 0 };
    contractsInRange.forEach((c: any) => {
      const f = c.frequency || "monthly";
      freqCount[f] = (freqCount[f] || 0) + 1;
    });

    // ─── Helpers para construir detalhes
    const clientName = (cid: string) => clients.find((c: any) => c.id === cid)?.name || "—";
    const contractTag = (cid: string) => cid ? `#${String(cid).slice(0, 6)}` : "—";
    const daysLate = (due: string) => Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(parseDueLocal(due)).getTime()) / 86400000));

    const decorateInst = (i: any) => ({ ...i, _client: clientName(i.client_id), _contract: contractTag(i.contract_id), _days: daysLate(i.due_date), _paid: Number(i.paid_amount || i.amount || 0) });
    const decorateContract = (c: any) => {
      const total = Number(c.total_amount || 0);
      const cap = Number(c.capital || 0);
      return { ...c, _client: clientName(c.client_id), _contract: contractTag(c.id), _total: total, _lucro: Math.max(0, total - cap) };
    };

    const instCols: DetailColumn[] = [
      { label: "Cliente", key: "_client" },
      { label: "Contrato", key: "_contract" },
      { label: "Parcela", key: "installment_number", align: "right" },
      { label: "Vencimento", key: "due_date", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" },
      { label: "Valor", key: "amount", align: "right", format: (v) => fmtBRL(Number(v || 0)) },
      { label: "Status", key: "status" },
    ];
    const overdueCols: DetailColumn[] = [
      { label: "Cliente", key: "_client" },
      { label: "Contrato", key: "_contract" },
      { label: "Vencimento", key: "due_date", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" },
      { label: "Atraso", key: "_days", align: "right", format: (v) => `${v}d` },
      { label: "Valor", key: "amount", align: "right", format: (v) => fmtBRL(Number(v || 0)) },
    ];
    const paidCols: DetailColumn[] = [
      { label: "Cliente", key: "_client" },
      { label: "Contrato", key: "_contract" },
      { label: "Pago em", key: "paid_at", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" },
      { label: "Vencimento", key: "due_date", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" },
      { label: "Valor", key: "_paid", align: "right", format: (v) => fmtBRL(Number(v || 0)) },
    ];
    const contractCols: DetailColumn[] = [
      { label: "Cliente", key: "_client" },
      { label: "Contrato", key: "_contract" },
      { label: "Capital", key: "capital", align: "right", format: (v) => fmtBRL(Number(v || 0)) },
      { label: "A receber", key: "_total", align: "right", format: (v) => fmtBRL(Number(v || 0)) },
      { label: "Lucro previsto", key: "_lucro", align: "right", format: (v) => fmtBRL(Number(v || 0)) },
      { label: "Parcelas", key: "num_installments", align: "right" },
      { label: "Criado", key: "created_at", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" },
    ];

    const historyRows = contracts.map((c: any) => {
      const paidInsts = installments.filter((i: any) => i.contract_id === c.id && i.status === "paid").length;
      const principalPer = Number(c.num_installments || 0) > 0 ? Number(c.capital || 0) / Number(c.num_installments) : 0;
      const remainingCapital = Math.max(0, Number(c.capital || 0) - paidInsts * principalPer);
      return { ...decorateContract(c), _remainingCapital: remainingCapital };
    }).sort((a: any, b: any) => b._remainingCapital - a._remainingCapital);

    const overdueRows = overdueAll.map(decorateInst).sort((a: any, b: any) => b._days - a._days);
    const paidRows = paidInRange.map(decorateInst).sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    const contractsRows = contractsInRange.map(decorateContract).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const activeRows = activeContracts.map(decorateContract);
    const pendingRows = installments.filter((i: any) => i.status === "pending").map(decorateInst).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const dueTodayRows = dueToday.map(decorateInst);
    const dueTomorrowRows = dueTomorrow.map(decorateInst);
    const upcomingRows = upcoming.map(decorateInst).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const upcoming7Rows = upcoming7.map(decorateInst).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const newClientsRows = clients.filter((c: any) => c.created_at && inRange(new Date(c.created_at)))
      .map((c: any) => ({ ...c, _created: c.created_at }))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const quitadosRows = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      return insts.length > 0 && insts.every((i: any) => i.status === "paid");
    }).map(decorateContract);
    const quitadosPeriodoRows = contracts.filter((c: any) => {
      const insts = installments.filter((i: any) => i.contract_id === c.id);
      if (insts.length === 0 || insts.some((i: any) => i.status !== "paid")) return false;
      const last = insts.map((i: any) => i.paid_at ? new Date(i.paid_at).getTime() : 0).reduce((a, b) => Math.max(a, b), 0);
      return last >= rangeStart.getTime() && last <= rangeEnd.getTime();
    }).map(decorateContract);

    const overdueByClientRows = Array.from(overdueByClient.entries()).map(([cid, v]) => ({
      _client: v.name, _contract: contractTag(cid), count: v.count, maxDays: v.maxDays, amount: v.amount,
    })).sort((a: any, b: any) => b.amount - a.amount);

    const lucroRows = paidInRange.map((i: any) => {
      const c = contracts.find((c: any) => c.id === i.contract_id);
      const principal = c?.num_installments ? Number(c.capital) / Number(c.num_installments) : 0;
      const lucro = Math.max(0, Number(i.paid_amount || i.amount) - principal);
      return { ...decorateInst(i), _lucro: lucro };
    }).filter((r: any) => r._lucro > 0).sort((a: any, b: any) => b._lucro - a._lucro);

    const multasRows = paidInRange.filter((i: any) => Number(i.late_fee || 0) > 0)
      .map((i: any) => ({ ...decorateInst(i), _fee: Number(i.late_fee || 0) }))
      .sort((a: any, b: any) => b._fee - a._fee);

    const agingCols = overdueCols;
    const makeAging = (arr: any[], label: string) => ({
      title: `Em atraso · ${label}`,
      criteria: `Parcelas pendentes cuja data de vencimento caiu na faixa "${label}" em relação a hoje.`,
      total: fmtBRL(sumAmt(arr)),
      count: arr.length,
      columns: agingCols,
      rows: arr.map(decorateInst).sort((a: any, b: any) => b._days - a._days),
    });

    const details: Record<string, DetailPayload> = {
      totalLent: { title: "Total emprestado no período", criteria: `Soma do capital dos contratos criados entre ${format(dateFrom, "dd/MM/yy")} e ${format(dateTo, "dd/MM/yy")}.`, total: fmtBRL(totalLent), count: contractsRows.length, columns: contractCols, rows: contractsRows },
      totalProfitExpected: { title: "Lucro total dos contratos no período", criteria: `Soma do lucro previsto (total do contrato − capital) dos contratos criados entre ${format(dateFrom, "dd/MM/yy")} e ${format(dateTo, "dd/MM/yy")}.`, total: fmtBRL(totalProfitExpected), count: contractsRows.length, columns: contractCols, rows: contractsRows },
      newContracts: { title: "Novos contratos no período", criteria: "Contratos cuja data de criação está dentro do período selecionado.", count: contractsRows.length, columns: contractCols, rows: contractsRows },
      ticketMedio: { title: "Ticket médio", criteria: "Total emprestado ÷ nº de contratos no período.", total: fmtBRL(ticketMedio), count: contractsRows.length, columns: contractCols, rows: contractsRows },
      novosClientes: { title: "Novos clientes no período", criteria: "Clientes cuja data de cadastro caiu dentro do período selecionado.", count: newClientsRows.length, columns: [{ label: "Cliente", key: "name" }, { label: "Cadastro", key: "_created", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" }, { label: "Status", key: "status" }], rows: newClientsRows },
      totalReceived: { title: "Total recebido no período", criteria: "Soma do valor pago das parcelas com status \"pago\" e data de pagamento dentro do período.", total: fmtBRL(totalReceived), count: paidRows.length, columns: paidCols, rows: paidRows },
      paidCount: { title: "Parcelas pagas no período", criteria: "Parcelas marcadas como pagas cuja data de pagamento caiu no período.", count: paidRows.length, columns: paidCols, rows: paidRows },
      lucro: { title: "Lucro (juros) recebido", criteria: "Para cada parcela paga, calcula valor pago − (capital ÷ nº parcelas). Considera só valores positivos.", total: fmtBRL(lucroPeriodo), count: lucroRows.length, columns: [...paidCols, { label: "Juros", key: "_lucro", align: "right", format: (v) => fmtBRL(Number(v || 0)) }], rows: lucroRows },
      multas: { title: "Multas recebidas", criteria: "Soma do campo late_fee das parcelas pagas no período.", total: fmtBRL(multas), count: multasRows.length, columns: [...paidCols, { label: "Multa", key: "_fee", align: "right", format: (v) => fmtBRL(Number(v || 0)) }], rows: multasRows },
      overdue: { title: "Parcelas em atraso (agora)", criteria: "Todas as parcelas pendentes cujo vencimento já passou — independente do período selecionado.", total: fmtBRL(overdueAmount), count: overdueRows.length, columns: overdueCols, rows: overdueRows },
      overdueClients: { title: "Clientes inadimplentes (agora)", criteria: "Clientes com pelo menos uma parcela em atraso. Total agrupado por cliente.", count: overdueByClientRows.length, columns: [{ label: "Cliente", key: "_client" }, { label: "Parcelas", key: "count", align: "right" }, { label: "Maior atraso", key: "maxDays", align: "right", format: (v) => `${v}d` }, { label: "Valor", key: "amount", align: "right", format: (v) => fmtBRL(Number(v || 0)) }], rows: overdueByClientRows },
      inadRate: { title: "Taxa de inadimplência", criteria: "Parcelas em atraso ÷ total de parcelas no sistema.", total: fmtPct(inadRate), count: overdueRows.length, columns: overdueCols, rows: overdueRows },
      taxaCobranca: { title: "Taxa de cobrança", criteria: "Parcelas pagas no prazo ÷ parcelas que venceram dentro do período (até hoje).", total: fmtPct(taxaCobranca), count: dueAlready.length, columns: instCols, rows: dueAlready.map(decorateInst) },
      agingA: makeAging(aging.a, "1-7 dias"),
      agingB: makeAging(aging.b, "8-15 dias"),
      agingC: makeAging(aging.c, "16-30 dias"),
      agingD: makeAging(aging.d, "31-60 dias"),
      agingE: makeAging(aging.e, "60+ dias"),
      capitalAtivo: { title: "Capital ativo na rua", criteria: "Soma do capital dos contratos com status \"ativo\" ou \"em atraso\".", total: fmtBRL(capitalAtivo), count: activeRows.length, columns: contractCols, rows: activeRows },
      totalLentHistory: { title: "Total emprestado (desde sempre)", criteria: "Soma do capital de todos os contratos criados, independente do período selecionado.", total: fmtBRL(totalLentHistory), count: contracts.length, columns: contractCols, rows: contracts.map(decorateContract).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) },
      totalProfitExpectedAll: { title: "Lucro total esperado (desde sempre)", criteria: "Soma do lucro previsto (total do contrato − capital) de todos os contratos, independente do período selecionado.", total: fmtBRL(totalProfitExpectedAll), count: contracts.length, columns: contractCols, rows: contracts.map(decorateContract).sort((a: any, b: any) => b._lucro - a._lucro) },
      outstandingCapital: { title: "Saldo de capital emprestado", criteria: "Capital total já emprestado menos o principal já recuperado pelas parcelas pagas.", total: fmtBRL(outstandingCapital), count: historyRows.filter((r: any) => r._remainingCapital > 0).length, columns: [...contractCols, { label: "Capital em aberto", key: "_remainingCapital", align: "right", format: (v) => fmtBRL(Number(v || 0)) }], rows: historyRows.filter((r: any) => r._remainingCapital > 0) },
      aReceber: { title: "A receber (total)", criteria: "Soma do valor de todas as parcelas com status \"pendente\".", total: fmtBRL(aReceberTotal), count: pendingRows.length, columns: instCols, rows: pendingRows },
      activeContracts: { title: "Contratos ativos", criteria: "Contratos com status \"ativo\" ou \"em atraso\".", count: activeRows.length, columns: contractCols, rows: activeRows },
      totalClients: { title: "Total de clientes", criteria: "Todos os clientes cadastrados (independente de status).", count: clients.length, columns: [{ label: "Cliente", key: "name" }, { label: "Cadastro", key: "created_at", format: (v) => v ? format(new Date(v), "dd/MM/yy") : "—" }, { label: "Status", key: "status" }], rows: clients },
      quitados: { title: "Contratos quitados (geral)", criteria: "Contratos cujas parcelas estão todas com status \"pago\".", count: quitadosRows.length, columns: contractCols, rows: quitadosRows },
      quitadosPeriodo: { title: "Contratos quitados no período", criteria: "Contratos cuja última parcela foi paga dentro do período selecionado.", count: quitadosPeriodoRows.length, columns: contractCols, rows: quitadosPeriodoRows },
      dueToday: { title: "Vence hoje", criteria: "Parcelas pendentes com data de vencimento igual a hoje.", total: fmtBRL(dueTodayRows.reduce((s: number, i: any) => s + Number(i.amount || 0), 0)), count: dueTodayRows.length, columns: instCols, rows: dueTodayRows },
      dueTomorrow: { title: "Vence amanhã", criteria: "Parcelas pendentes com data de vencimento igual a amanhã.", total: fmtBRL(dueTomorrowRows.reduce((s: number, i: any) => s + Number(i.amount || 0), 0)), count: dueTomorrowRows.length, columns: instCols, rows: dueTomorrowRows },
      forecast7: { title: "Previsão · próximos 7 dias", criteria: "Parcelas pendentes com vencimento nos próximos 7 dias.", total: fmtBRL(forecast7Amount), count: upcoming7Rows.length, columns: instCols, rows: upcoming7Rows },
      forecast30: { title: "Previsão · próximos 30 dias", criteria: "Parcelas pendentes com vencimento nos próximos 30 dias.", total: fmtBRL(forecastAmount), count: upcomingRows.length, columns: instCols, rows: upcomingRows },
    };

    const freqDetails: Record<string, DetailPayload> = {};
    Object.keys(freqLabels).forEach((key) => {
      const rows = contractsInRange.filter((c: any) => (c.frequency || "monthly") === key).map(decorateContract);
      freqDetails[key] = {
        title: `Contratos ${freqLabels[key].toLowerCase()} no período`,
        criteria: `Contratos criados no período com frequência "${freqLabels[key]}".`,
        count: rows.length,
        columns: contractCols,
        rows,
      };
    });

    return {
      // empréstimos
      totalLent, newContracts, ticketMedio, novosClientes, totalProfitExpected,
      // recebimentos
      totalReceived, paidCount, lucroPeriodo, multas,
      // atraso
      overdueAmount, overdueCount: overdueAll.length, overdueClients, aging, sumAmt,
      // carteira
      capitalAtivo, aReceberTotal, activeCount: activeContracts.length, totalClients: clients.length,
      totalLentHistory, outstandingCapital, totalProfitExpectedAll,
      quitados, quitadosNoPeriodo,
      // cobrança
      taxaCobranca, inadRate,
      // previsão
      forecastAmount, forecast7Amount, upcomingCount: upcoming.length, upcoming7Count: upcoming7.length,
      dueTodayAmount: dueToday.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      dueTodayCount: dueToday.length,
      dueTomorrowAmount: dueTomorrow.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      dueTomorrowCount: dueTomorrow.length,
      // deltas
      deltaLent: delta(totalLent, prevLent),
      deltaReceived: delta(totalReceived, prevReceived),
      deltaPaidCount: delta(paidCount, prevPaidCount),
      deltaContracts: delta(newContracts, prevContracts),
      deltaProfit: delta(totalProfitExpected, prevProfit),
      // listas
      worstPayers,
      freqLabels, freqCount,
      // detalhes
      details, freqDetails,
    };
  }, [data, dateFrom, dateTo]);

  const handleExport = () => {
    if (!data) return;
    const rows = data.installments.map((i: any) => {
      const c = data.contracts.find((c: any) => c.id === i.contract_id);
      return `${i.installment_number},${i.amount},${i.due_date},${i.status},${i.paid_at || ""},${c?.capital || ""}`;
    });
    const csv = "Parcela,Valor,Vencimento,Status,Pago em,Capital\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-analises.csv";
    a.click();
  };

  if (isLoading || !m) return <div className="text-center py-12 text-muted-foreground">Carregando análises...</div>;

  const periodLabel = `${format(dateFrom, "dd/MM/yy")} → ${format(dateTo, "dd/MM/yy")}`;

  return (
    <div className="space-y-6">
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon"><BarChart3 size={22} /></div>
            <div>
              <h1 className="text-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Análises</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Totais organizados por tipo · {periodLabel}</p>
            </div>
          </div>
          <button onClick={handleExport} className="btn-ghost">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <Tabs defaultValue="classic" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="classic" className="flex items-center gap-2">
            <FileText size={14} /> Estatísticas
          </TabsTrigger>
          <TabsTrigger value="predictive" className="flex items-center gap-2">
            <Brain size={14} /> Inteligência Preditiva (IA)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictive">
          <PredictiveAnalytics />
        </TabsContent>

        <TabsContent value="classic" className="space-y-8">
          {/* ─── Período ─── */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
              <span className="text-label shrink-0">Período</span>
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePreset(p.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      activePreset === p.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(dateFrom, "dd/MM/yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { if (d) { setDateFrom(d); setActivePreset("custom"); } }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(dateTo, "dd/MM/yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { if (d) { setDateTo(d); setActivePreset("custom"); } }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* ─── EMPRÉSTIMOS ─── */}
          <Section title="Empréstimos no período" subtitle="Quanto saiu do caixa e quanto vai render">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard onClick={() => setDetail(m.details.totalLent)} s={{ label: "Total emprestado", value: fmtBRL(m.totalLent), tone: "info", icon: HandCoins, delta: m.deltaLent, positiveIsGood: true }} />
              <StatCard onClick={() => setDetail(m.details.totalProfitExpected)} s={{ label: "Lucro total dos contratos", value: fmtBRL(m.totalProfitExpected), tone: "success", icon: PiggyBank, delta: m.deltaProfit, positiveIsGood: true }} />
              <StatCard onClick={() => setDetail(m.details.newContracts)} s={{ label: "Novos contratos", value: fmtNum(m.newContracts), tone: "default", icon: FileSignature, delta: m.deltaContracts, positiveIsGood: true }} />
              <StatCard onClick={() => setDetail(m.details.ticketMedio)} s={{ label: "Ticket médio", value: fmtBRL(m.ticketMedio), tone: "default", icon: Target }} />
              <StatCard onClick={() => setDetail(m.details.novosClientes)} s={{ label: "Novos clientes", value: fmtNum(m.novosClientes), tone: "default", icon: Users }} />
            </div>
          </Section>

          {/* ─── RECEBIMENTOS ─── */}
          <Section title="Recebimentos no período" subtitle="Quanto entrou no caixa">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard onClick={() => setDetail(m.details.totalReceived)} s={{ label: "Total recebido", value: fmtBRL(m.totalReceived), tone: "success", icon: Wallet, delta: m.deltaReceived, positiveIsGood: true }} />
              <StatCard onClick={() => setDetail(m.details.paidCount)} s={{ label: "Parcelas pagas", value: fmtNum(m.paidCount), tone: "success", icon: CheckCircle2, delta: m.deltaPaidCount, positiveIsGood: true }} />
              <StatCard onClick={() => setDetail(m.details.lucro)} s={{ label: "Lucro (juros)", value: fmtBRL(m.lucroPeriodo), tone: "success", icon: PiggyBank }} />
              <StatCard onClick={() => setDetail(m.details.multas)} s={{ label: "Multas recebidas", value: fmtBRL(m.multas), tone: "default", icon: Receipt }} />
            </div>
          </Section>

          {/* ─── ATRASO (snapshot atual) ─── */}
          <Section title="Inadimplência (saldo atual)" subtitle="Independente do período selecionado">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard onClick={() => setDetail(m.details.overdue)} s={{ label: "Total em atraso", value: fmtBRL(m.overdueAmount), tone: "danger", icon: AlertTriangle, hint: `${m.overdueCount} parcela(s)` }} />
              <StatCard onClick={() => setDetail(m.details.overdueClients)} s={{ label: "Clientes inadimplentes", value: fmtNum(m.overdueClients), tone: "danger", icon: Users }} />
              <StatCard onClick={() => setDetail(m.details.inadRate)} s={{ label: "Taxa de inadimplência", value: fmtPct(m.inadRate), tone: "warning", icon: TrendingDown }} />
              <StatCard onClick={() => setDetail(m.details.taxaCobranca)} s={{ label: "Taxa de cobrança", value: fmtPct(m.taxaCobranca), tone: "info", icon: TrendingUp, hint: "pagas no prazo / vencidas no período" }} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "1-7 dias",   data: m.aging.a, key: "agingA" },
                { label: "8-15 dias",  data: m.aging.b, key: "agingB" },
                { label: "16-30 dias", data: m.aging.c, key: "agingC" },
                { label: "31-60 dias", data: m.aging.d, key: "agingD" },
                { label: "60+ dias",   data: m.aging.e, key: "agingE" },
              ].map((b) => (
                <button
                  type="button"
                  key={b.label}
                  onClick={() => setDetail((m.details as any)[b.key])}
                  className="glass-card rounded-2xl p-3 text-left hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{b.label}</p>
                  <p className="text-lg font-bold text-destructive mt-1 tabular-nums">{fmtBRL(m.sumAmt(b.data))}</p>
                  <p className="text-[11px] text-muted-foreground">{b.data.length} parcela(s)</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ─── CAPITAL EMPRESTADO ─── */}
          <Section title="Capital emprestado" subtitle="Quanto já saiu, quanto ainda está em aberto e o lucro esperado">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard onClick={() => setDetail(m.details.totalLentHistory)} s={{ label: "Total emprestado (desde sempre)", value: fmtBRL(m.totalLentHistory), tone: "info", icon: HandCoins, hint: `${data?.contracts.length ?? 0} contrato(s)` }} />
              <StatCard onClick={() => setDetail(m.details.totalProfitExpectedAll)} s={{ label: "Lucro total esperado", value: fmtBRL(m.totalProfitExpectedAll), tone: "success", icon: PiggyBank, hint: "soma do lucro previsto de todos os contratos" }} />
              <StatCard onClick={() => setDetail(m.details.outstandingCapital)} s={{ label: "Ainda tenho emprestado", value: fmtBRL(m.outstandingCapital), tone: "warning", icon: Wallet, hint: "saldo de capital não recuperado" }} />
            </div>
          </Section>

          {/* ─── CARTEIRA ─── */}
          <Section title="Carteira atual" subtitle="Visão geral do negócio agora">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard onClick={() => setDetail(m.details.capitalAtivo)} s={{ label: "Capital ativo na rua", value: fmtBRL(m.capitalAtivo), tone: "info", icon: Wallet }} />
              <StatCard onClick={() => setDetail(m.details.aReceber)} s={{ label: "A receber (total)", value: fmtBRL(m.aReceberTotal), tone: "default", icon: HandCoins }} />
              <StatCard onClick={() => setDetail(m.details.activeContracts)} s={{ label: "Contratos ativos", value: fmtNum(m.activeCount), tone: "default", icon: FileSignature }} />
              <StatCard onClick={() => setDetail(m.details.totalClients)} s={{ label: "Total de clientes", value: fmtNum(m.totalClients), tone: "default", icon: Users }} />
              <StatCard onClick={() => setDetail(m.details.quitados)} s={{ label: "Contratos quitados (total)", value: fmtNum(m.quitados), tone: "success", icon: CheckCircle2 }} />
              <StatCard onClick={() => setDetail(m.details.quitadosPeriodo)} s={{ label: "Quitados no período", value: fmtNum(m.quitadosNoPeriodo), tone: "success", icon: CheckCircle2 }} />
              <StatCard onClick={() => setDetail(m.details.dueToday)} s={{ label: "Vence hoje", value: fmtBRL(m.dueTodayAmount), tone: "warning", icon: Clock, hint: `${m.dueTodayCount} parcela(s)` }} />
              <StatCard onClick={() => setDetail(m.details.dueTomorrow)} s={{ label: "Vence amanhã", value: fmtBRL(m.dueTomorrowAmount), tone: "warning", icon: Clock, hint: `${m.dueTomorrowCount} parcela(s)` }} />
            </div>
          </Section>

          {/* ─── PREVISÃO ─── */}
          <Section title="Previsão de recebimento" subtitle="Parcelas pendentes que ainda vão vencer">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard onClick={() => setDetail(m.details.forecast7)} s={{ label: "Próximos 7 dias", value: fmtBRL(m.forecast7Amount), tone: "info", icon: Clock, hint: `${m.upcoming7Count} parcela(s)` }} />
              <StatCard onClick={() => setDetail(m.details.forecast30)} s={{ label: "Próximos 30 dias", value: fmtBRL(m.forecastAmount), tone: "info", icon: Clock, hint: `${m.upcomingCount} parcela(s)` }} />
            </div>
          </Section>

          {/* ─── FREQUÊNCIA DOS CONTRATOS NO PERÍODO ─── */}
          <Section title="Frequência dos novos contratos" subtitle="Apenas dentro do período selecionado">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(m.freqLabels).map(([key, label]) => (
                <StatCard key={key} onClick={() => setDetail(m.freqDetails[key])} s={{ label, value: fmtNum(m.freqCount[key] || 0), tone: "default" }} />
              ))}
            </div>
          </Section>

          {/* ─── TOP PIORES PAGADORES ─── */}
          <Section title="Top 10 piores pagadores" subtitle="Ordenado por valor total em atraso">
            {m.worstPayers.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
                Sem inadimplentes 🎉
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-3 divide-y divide-border/50">
                {m.worstPayers.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-2 first:pt-2 last:pb-2">
                    <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.count} parcela{p.count > 1 ? "s" : ""} · {p.maxDays}d em atraso
                      </p>
                    </div>
                    <p className="text-sm font-bold text-destructive shrink-0 tabular-nums">{fmtBRL(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <DetailModal payload={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default Analises;
