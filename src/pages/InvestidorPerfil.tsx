import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Landmark, Mail, Phone, MessageCircle, Copy, ExternalLink,
  RefreshCw, DollarSign, CheckCircle2, Clock, AlertTriangle, Wallet,
  TrendingUp, History, KeyRound, User, FileText, Plus, Zap,
} from "lucide-react";

const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "-";
const fmtDT = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "-";
const daysUntil = (d: string) => Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);

type Investor = {
  id: string; name: string; cpf_cnpj: string | null; email: string | null;
  phone: string | null; whatsapp: string | null; pix_key: string | null;
  pix_key_type: string | null; notes: string | null; access_token: string;
  status: string; created_at: string; avatar_url: string | null;
};
type Loan = {
  id: string; investor_id: string; principal: number; interest_rate: number;
  total_due: number; paid_amount: number; start_date: string; due_date: string;
  frequency: string; status: string; payment_method: string | null;
  paid_at: string | null; notes: string | null; created_at: string;
};
type Payment = {
  id: string; loan_id: string; amount: number; paid_at: string;
  method: string | null; notes: string | null;
};

export default function InvestidorPerfil() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoan, setPayLoan] = useState<Loan | null>(null);
  const [tab, setTab] = useState<"pendentes" | "quitados" | "historico">("pendentes");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: inv }, { data: ln }, { data: pm }] = await Promise.all([
      supabase.from("investors" as never).select("*").eq("id", id).maybeSingle(),
      supabase.from("investor_loans" as never).select("*").eq("investor_id", id).order("due_date", { ascending: true }),
      supabase.from("investor_payments" as never).select("*").eq("investor_id", id).order("paid_at", { ascending: false }),
    ]);
    setInvestor((inv as any) || null);
    setLoans((ln as any) || []);
    setPayments((pm as any) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  const kpi = useMemo(() => {
    const active = loans.filter((l) => l.status !== "paid");
    const capital = active.reduce((s, l) => s + Number(l.principal), 0);
    const devido = active.reduce((s, l) => s + Number(l.total_due), 0);
    const saldo = active.reduce((s, l) => s + (Number(l.total_due) - Number(l.paid_amount)), 0);
    const pagoTotal = loans.reduce((s, l) => s + Number(l.paid_amount), 0);
    const juros = loans.reduce((s, l) => s + (Number(l.total_due) - Number(l.principal)), 0);
    const overdue = active.filter((l) => daysUntil(l.due_date) < 0);
    const overdueTotal = overdue.reduce((s, l) => s + (Number(l.total_due) - Number(l.paid_amount)), 0);
    const nextDue = active.map((l) => l.due_date).sort()[0] || null;
    return { capital, devido, saldo, pagoTotal, juros, overdue: overdue.length, overdueTotal, nextDue, count: active.length };
  }, [loans]);

  const copyPortal = () => {
    if (!investor) return;
    const url = `${window.location.origin}/investidor/${investor.access_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link do portal copiado" });
  };

  const regenerateToken = async () => {
    if (!investor) return;
    const { data, error } = await supabase.rpc("investor_regenerate_token" as never, { _investor_id: investor.id } as never);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Novo link gerado" });
    void load();
    if (data) navigator.clipboard.writeText(`${window.location.origin}/investidor/${data}`);
  };

  const markPaidQuick = async (loan: Loan) => {
    if (!user?.id) return;
    if (!confirm(`Marcar contrato de ${brl(loan.total_due)} como pago integralmente?`)) return;
    const saldo = Number(loan.total_due) - Number(loan.paid_amount);
    const { error: e1 } = await supabase.from("investor_payments" as never).insert({
      loan_id: loan.id, investor_id: loan.investor_id, user_id: user.id,
      amount: saldo, method: loan.payment_method || "pix", notes: "Quitação rápida",
    } as never);
    if (e1) return toast({ title: "Erro", description: e1.message, variant: "destructive" });
    const { error: e2 } = await supabase.from("investor_loans" as never).update({
      paid_amount: Number(loan.total_due), status: "paid", paid_at: new Date().toISOString(),
    } as never).eq("id", loan.id);
    if (e2) return toast({ title: "Erro", description: e2.message, variant: "destructive" });
    toast({ title: "Contrato quitado ✓" });
    void load();
  };

  const notifyByWa = () => {
    if (!investor?.whatsapp) return;
    const num = investor.whatsapp.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${investor.name}, atualizei o status dos seus investimentos. Acompanhe pelo portal: ${window.location.origin}/investidor/${investor.access_token}`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando perfil…</div>;
  }
  if (!investor) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Investidor não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => nav("/investidores")}>Voltar</Button>
      </div>
    );
  }

  const activeLoans = loans.filter((l) => l.status !== "paid");
  const paidLoans = loans.filter((l) => l.status === "paid");
  const initial = investor.name.trim().charAt(0).toUpperCase();

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav("/investidores")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Investidores
          </Button>
        </div>

        {/* Hero */}
        <section className="glass-card relative overflow-hidden rounded-3xl border border-white/5 p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-500/5 pointer-events-none" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 font-heading text-3xl font-bold text-white shadow-xl">
                {investor.avatar_url ? (
                  <img src={investor.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                ) : initial}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-3xl font-bold text-foreground">{investor.name}</h1>
                  <Badge className={investor.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20"}>
                    {investor.status === "active" ? "Ativo" : investor.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Investidor desde {fmtDate(investor.created_at.slice(0, 10))}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {investor.cpf_cnpj && <span className="flex items-center gap-1.5 text-muted-foreground"><User className="h-3.5 w-3.5" /> {investor.cpf_cnpj}</span>}
                  {investor.email && <a href={`mailto:${investor.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"><Mail className="h-3.5 w-3.5" /> {investor.email}</a>}
                  {investor.whatsapp && <span className="flex items-center gap-1.5 text-emerald-300"><MessageCircle className="h-3.5 w-3.5" /> {investor.whatsapp}</span>}
                  {investor.phone && <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {investor.phone}</span>}
                </div>
                {investor.pix_key && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                    <KeyRound className="h-3.5 w-3.5" /> PIX ({investor.pix_key_type || "chave"}): <span className="font-mono">{investor.pix_key}</span>
                    <button onClick={() => { navigator.clipboard.writeText(investor.pix_key!); toast({ title: "PIX copiado" }); }} className="opacity-60 hover:opacity-100"><Copy className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {investor.whatsapp && (
                <Button size="sm" onClick={notifyByWa} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={copyPortal} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Link
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`/investidor/${investor.access_token}`, "_blank")} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Portal
              </Button>
              <Button variant="outline" size="sm" onClick={regenerateToken} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Novo token
              </Button>
            </div>
          </div>
        </section>

        {/* Alert overdue */}
        {kpi.overdue > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <AlertTriangle className="h-6 w-6 text-red-300" />
            <div className="flex-1">
              <p className="font-semibold text-red-100">
                {kpi.overdue} contrato(s) vencido(s) — {brl(kpi.overdueTotal)} em atraso
              </p>
              <p className="text-xs text-red-200/70">Regularize o pagamento para manter o relacionamento com o investidor.</p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi icon={Wallet} label="Capital captado" value={brl(kpi.capital)} tone="primary" />
          <Kpi icon={DollarSign} label="Total a pagar" value={brl(kpi.saldo)} tone="amber" hint={kpi.nextDue ? `Próx: ${fmtDate(kpi.nextDue)}` : undefined} />
          <Kpi icon={TrendingUp} label="Juros gerados" value={brl(kpi.juros)} tone="violet" />
          <Kpi icon={CheckCircle2} label="Já pago" value={brl(kpi.pagoTotal)} tone="emerald" />
          <Kpi icon={FileText} label="Contratos ativos" value={String(kpi.count)} tone="slate" hint={`${paidLoans.length} quitados`} />
        </section>

        {/* Tabs */}
        <section className="glass-card rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex flex-wrap gap-1">
              {[
                { k: "pendentes", label: `Pendentes (${activeLoans.length})`, icon: Clock },
                { k: "quitados", label: `Quitados (${paidLoans.length})`, icon: CheckCircle2 },
                { k: "historico", label: `Histórico (${payments.length})`, icon: History },
              ].map((t) => {
                const I = t.icon;
                return (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k as any)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      tab === t.k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    <I className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === "pendentes" && (
            activeLoans.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
                Nenhum contrato pendente com este investidor.
              </p>
            ) : (
              <ul className="space-y-3">
                {activeLoans.map((l) => <LoanCard key={l.id} loan={l} onPay={() => setPayLoan(l)} onMarkPaid={() => markPaidQuick(l)} />)}
              </ul>
            )
          )}

          {tab === "quitados" && (
            paidLoans.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
                Ainda não há contratos quitados.
              </p>
            ) : (
              <ul className="space-y-3">
                {paidLoans.map((l) => <LoanCard key={l.id} loan={l} settled />)}
              </ul>
            )
          )}

          {tab === "historico" && (
            payments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{brl(Number(p.amount))}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtDT(p.paid_at)} • {p.method || "—"}</p>
                      </div>
                    </div>
                    {p.notes && <span className="max-w-[40%] truncate text-[11px] text-muted-foreground">{p.notes}</span>}
                  </li>
                ))}
              </ul>
            )
          )}
        </section>

        {investor.notes && (
          <section className="glass-card rounded-2xl p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</h3>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{investor.notes}</p>
          </section>
        )}
      </div>

      {payLoan && (
        <PayLoanDialog
          loan={payLoan}
          onClose={() => setPayLoan(null)}
          onPaid={() => { setPayLoan(null); void load(); }}
        />
      )}
    </>
  );
}

function LoanCard({ loan, settled, onPay, onMarkPaid }: {
  loan: Loan; settled?: boolean; onPay?: () => void; onMarkPaid?: () => void;
}) {
  const saldo = Number(loan.total_due) - Number(loan.paid_amount);
  const pct = Math.min(100, (Number(loan.paid_amount) / Number(loan.total_due)) * 100);
  const days = daysUntil(loan.due_date);
  const overdue = !settled && days < 0;
  const soon = !settled && days >= 0 && days <= 7;

  return (
    <li className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xl font-bold text-foreground">{brl(Number(loan.total_due))}</p>
            {settled ? (
              <Badge className="bg-emerald-500/20 text-emerald-300">Quitado {loan.paid_at ? `em ${fmtDate(loan.paid_at.slice(0, 10))}` : ""}</Badge>
            ) : overdue ? (
              <Badge className="bg-red-500/20 text-red-300">Atrasado há {Math.abs(days)}d</Badge>
            ) : soon ? (
              <Badge className="bg-amber-500/20 text-amber-300">Vence em {days}d</Badge>
            ) : (
              <Badge className="bg-primary/20 text-primary">Ativo</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Capital {brl(Number(loan.principal))} • Juros {loan.interest_rate}% • Vencimento {fmtDate(loan.due_date)}
          </p>
          {loan.notes && <p className="mt-1 text-[11px] italic text-muted-foreground/80">"{loan.notes}"</p>}
        </div>
        {!settled && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onPay} className="gap-1.5">
              <DollarSign className="h-4 w-4" /> Pagar
            </Button>
            <Button size="sm" onClick={onMarkPaid} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
              <Zap className="h-4 w-4" /> Quitar tudo
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full transition-all ${settled ? "bg-emerald-500" : overdue ? "bg-red-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Pago: {brl(Number(loan.paid_amount))}</span>
        <span className={overdue ? "font-semibold text-red-300" : ""}>Saldo: {brl(saldo)}</span>
      </div>
    </li>
  );
}

function Kpi({ icon: Icon, label, value, tone, hint }: { icon: any; label: string; value: string; tone: string; hint?: string }) {
  const tones: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-300",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-300",
    slate: "from-slate-500/20 to-slate-500/5 text-slate-300",
  };
  return (
    <div className={`glass-card rounded-2xl bg-gradient-to-br ${tones[tone]} p-4`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 font-mono text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PayLoanDialog({ loan, onClose, onPaid }: { loan: Loan; onClose: () => void; onPaid: () => void }) {
  const { user } = useAuth();
  const saldo = Number(loan.total_due) - Number(loan.paid_amount);
  const [amount, setAmount] = useState(String(saldo.toFixed(2)));
  const [method, setMethod] = useState<string>(loan.payment_method || "pix");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const a = parseFloat(amount.replace(",", ".")) || 0;
    if (a <= 0) return toast({ title: "Valor inválido", variant: "destructive" });
    if (!user?.id) return;
    setLoading(true);
    const { error } = await supabase.from("investor_payments" as never).insert({
      loan_id: loan.id, investor_id: loan.investor_id, user_id: user.id,
      amount: a, method, notes: notes || null,
    } as never);
    if (!error) {
      const newPaid = Number(loan.paid_amount) + a;
      const paidInFull = newPaid >= Number(loan.total_due) - 0.01;
      await supabase.from("investor_loans" as never).update({
        paid_amount: newPaid,
        status: paidInFull ? "paid" : loan.status,
        paid_at: paidInFull ? new Date().toISOString() : loan.paid_at,
        payment_method: method,
      } as never).eq("id", loan.id);
    }
    setLoading(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Pagamento registrado ✓" });
    onPaid();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Total do contrato</p>
              <p className="font-mono text-base font-bold">{brl(Number(loan.total_due))}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Saldo devedor</p>
              <p className="font-mono text-base font-bold text-primary">{brl(saldo)}</p>
            </div>
          </div>
          <div>
            <Label>Valor pago (R$)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="mt-1.5 flex gap-1.5">
              <button type="button" onClick={() => setAmount((saldo / 2).toFixed(2))} className="rounded-md bg-white/5 px-2 py-1 text-[10px] hover:bg-white/10">50%</button>
              <button type="button" onClick={() => setAmount(saldo.toFixed(2))} className="rounded-md bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary">Quitar total</button>
            </div>
          </div>
          <div>
            <Label>Método</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: pagamento antecipado" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={loading} className="gap-1.5">
            {loading ? "Salvando…" : <><CheckCircle2 className="h-4 w-4" /> Confirmar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
