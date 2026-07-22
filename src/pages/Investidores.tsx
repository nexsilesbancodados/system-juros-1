import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Landmark, Plus, Link as LinkIcon, RefreshCw, Wallet, TrendingUp,
  CheckCircle2, Clock, ExternalLink, Trash2, Copy, DollarSign,
} from "lucide-react";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "-");

type Investor = {
  id: string; name: string; cpf_cnpj: string | null; email: string | null;
  phone: string | null; whatsapp: string | null; pix_key: string | null;
  pix_key_type: string | null; notes: string | null; access_token: string;
  status: string; created_at: string;
};
type Loan = {
  id: string; investor_id: string; principal: number; interest_rate: number;
  total_due: number; paid_amount: number; start_date: string; due_date: string;
  frequency: string; status: string; payment_method: string | null;
  paid_at: string | null; notes: string | null; created_at: string;
};

export default function Investidores() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newLoanOpen, setNewLoanOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [{ data: inv }, { data: ln }] = await Promise.all([
      supabase.from("investors" as never).select("*").order("created_at", { ascending: false }),
      supabase.from("investor_loans" as never).select("*").order("due_date", { ascending: true }),
    ]);
    setInvestors((inv as any) || []);
    setLoans((ln as any) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  const selected = investors.find((i) => i.id === selectedId) || null;
  const selectedLoans = useMemo(
    () => loans.filter((l) => l.investor_id === (selectedId || "")),
    [loans, selectedId],
  );

  const totals = useMemo(() => {
    const active = loans.filter((l) => l.status !== "paid");
    return {
      captado: active.reduce((s, l) => s + Number(l.principal), 0),
      devido: active.reduce((s, l) => s + Number(l.total_due), 0),
      pago: loans.reduce((s, l) => s + Number(l.paid_amount), 0),
      contagem: investors.filter((i) => i.status === "active").length,
    };
  }, [loans, investors]);

  const perInvestor = (id: string) => {
    const rows = loans.filter((l) => l.investor_id === id && l.status !== "paid");
    return {
      total: rows.reduce((s, l) => s + Number(l.total_due), 0),
      capital: rows.reduce((s, l) => s + Number(l.principal), 0),
      prox: rows.map((r) => r.due_date).sort()[0] || null,
      count: rows.length,
    };
  };

  const copyPortal = (token: string) => {
    const url = `${window.location.origin}/investidor/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  };

  const regenerateToken = async (id: string) => {
    const { data, error } = await supabase.rpc("investor_regenerate_token" as never, { _investor_id: id } as never);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Novo link gerado" });
    void load();
    if (data) copyPortal(data as string);
  };

  const deleteInvestor = async (id: string) => {
    if (!confirm("Excluir este investidor e todos os empréstimos vinculados?")) return;
    const { error } = await supabase.from("investors" as never).delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Investidor excluído" });
    setSelectedId(null);
    void load();
  };

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 font-heading text-3xl font-bold text-foreground">
              <Landmark className="h-8 w-8 text-primary" /> Carteira de Investidores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie o capital captado de investidores e envie o portal exclusivo para acompanhamento.
            </p>
          </div>
          <Button size="lg" onClick={() => setNewOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo investidor
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={Wallet} label="Investidores ativos" value={String(totals.contagem)} tone="primary" />
          <KpiCard icon={DollarSign} label="Capital captado" value={brl(totals.captado)} tone="emerald" />
          <KpiCard icon={TrendingUp} label="Total a pagar" value={brl(totals.devido)} tone="amber" />
          <KpiCard icon={CheckCircle2} label="Já pago" value={brl(totals.pago)} tone="violet" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Lista */}
          <div className="glass-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Investidores</h2>
              <Badge variant="secondary">{investors.length}</Badge>
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : investors.length === 0 ? (
              <div className="py-10 text-center">
                <Landmark className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Nenhum investidor cadastrado.</p>
                <Button className="mt-4" onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" /> Cadastrar primeiro</Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {investors.map((inv) => {
                  const p = perInvestor(inv.id);
                  const active = selectedId === inv.id;
                  return (
                    <li key={inv.id}>
                      <button
                        onClick={() => setSelectedId(inv.id)}
                        onDoubleClick={() => nav(`/investidores/${inv.id}`)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          active ? "border-primary bg-primary/10" : "border-white/5 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{inv.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.count} contrato(s) • Próx: {fmtDate(p.prox)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-bold text-foreground">{brl(p.total)}</p>
                            <p className="text-[10px] uppercase text-muted-foreground">a pagar</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Detalhe */}
          <div className="glass-card rounded-2xl p-5">
            {!selected ? (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                <Landmark className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">Selecione um investidor para ver os detalhes.</p>
              </div>
            ) : (
              <>
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-4">
                  <div>
                    <h2 className="font-heading text-2xl font-bold text-foreground">{selected.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selected.cpf_cnpj || "Sem documento"} • {selected.whatsapp || selected.phone || "Sem contato"}
                    </p>
                    {selected.email && <p className="text-xs text-muted-foreground">{selected.email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => nav(`/investidores/${selected.id}`)} className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir perfil
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => copyPortal(selected.access_token)} className="gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copiar link
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/investidor/${selected.access_token}`, "_blank")} className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir portal
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => regenerateToken(selected.id)} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Novo link
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteInvestor(selected.id)} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </header>

                <div className="mt-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Empréstimos captados</h3>
                  <Button size="sm" onClick={() => setNewLoanOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Novo empréstimo
                  </Button>
                </div>

                {selectedLoans.length === 0 ? (
                  <p className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
                    Nenhum empréstimo registrado. Clique em "Novo empréstimo" para começar.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {selectedLoans.map((l) => {
                      const saldo = Number(l.total_due) - Number(l.paid_amount);
                      const pct = Math.min(100, (Number(l.paid_amount) / Number(l.total_due)) * 100);
                      const overdue = l.status !== "paid" && new Date(l.due_date) < new Date();
                      return (
                        <li key={l.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-lg font-bold text-foreground">{brl(Number(l.total_due))}</p>
                                {l.status === "paid" ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-300">Pago</Badge>
                                ) : overdue ? (
                                  <Badge className="bg-red-500/20 text-red-300">Atrasado</Badge>
                                ) : (
                                  <Badge className="bg-primary/20 text-primary">Ativo</Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Capital {brl(Number(l.principal))} • Juros {l.interest_rate}% • Venc. {fmtDate(l.due_date)}
                              </p>
                            </div>
                            {l.status !== "paid" && (
                              <Button size="sm" variant="secondary" onClick={() => setPayOpen(l.id)} className="gap-1.5">
                                <DollarSign className="h-4 w-4" /> Registrar pagamento
                              </Button>
                            )}
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                            <span>Pago: {brl(Number(l.paid_amount))}</span>
                            <span>Saldo: {brl(saldo)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <NewInvestorDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => { setSelectedId(id); void load(); }} />
      {selected && (
        <NewLoanDialog
          open={newLoanOpen}
          onOpenChange={setNewLoanOpen}
          investor={selected}
          onCreated={() => void load()}
        />
      )}
      {payOpen && (
        <PayLoanDialog
          loanId={payOpen}
          loan={loans.find((l) => l.id === payOpen)!}
          onClose={() => setPayOpen(null)}
          onPaid={() => { setPayOpen(null); void load(); }}
        />
      )}
    </>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-300",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-300",
  };
  return (
    <div className={`glass-card rounded-2xl bg-gradient-to-br ${tones[tone]} p-4`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function NewInvestorDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", cpf_cnpj: "", email: "", whatsapp: "", phone: "", pix_key: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("investors" as never)
      .insert({ ...form, user_id: user.id } as never).select("id, access_token").single();
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Investidor cadastrado!" });
    onCreated((data as any).id);
    setForm({ name: "", cpf_cnpj: "", email: "", whatsapp: "", phone: "", pix_key: "", notes: "" });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo investidor</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Chave PIX</Label><Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
          <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Salvando…" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLoanDialog({ open, onOpenChange, investor, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; investor: Investor; onCreated: () => void }) {
  const { user } = useAuth();
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("20");
  const [dueDate, setDueDate] = useState("");
  const [freq, setFreq] = useState("bullet");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const totalDue = useMemo(() => {
    const p = parseFloat(principal.replace(",", ".")) || 0;
    const r = parseFloat(rate.replace(",", ".")) || 0;
    return p * (1 + r / 100);
  }, [principal, rate]);

  const submit = async () => {
    const p = parseFloat(principal.replace(",", ".")) || 0;
    const r = parseFloat(rate.replace(",", ".")) || 0;
    if (p <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    if (!dueDate) { toast({ title: "Informe o vencimento", variant: "destructive" }); return; }
    if (!user?.id) return;
    setLoading(true);
    const { error } = await supabase.from("investor_loans" as never).insert({
      investor_id: investor.id, user_id: user.id, principal: p, interest_rate: r,
      total_due: totalDue, due_date: dueDate, frequency: freq, notes,
    } as never);
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Empréstimo registrado!" });
    setPrincipal(""); setRate("20"); setDueDate(""); setNotes("");
    onCreated();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo empréstimo — {investor.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor recebido (R$) *</Label><Input inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="10000" /></div>
            <div><Label>Juros (%) *</Label><Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div>
              <Label>Modalidade</Label>
              <select value={freq} onChange={(e) => setFreq(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="bullet">Pagamento único</option>
                <option value="monthly">Juros mensais</option>
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Total a pagar</p>
            <p className="mt-1 font-mono text-2xl font-bold text-primary">{brl(totalDue)}</p>
          </div>
          <div><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Salvando…" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayLoanDialog({ loanId, loan, onClose, onPaid }: { loanId: string; loan: Loan; onClose: () => void; onPaid: () => void }) {
  const { user } = useAuth();
  const saldo = Number(loan.total_due) - Number(loan.paid_amount);
  const [amount, setAmount] = useState(String(saldo.toFixed(2)));
  const [method, setMethod] = useState("pix");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    const a = parseFloat(amount.replace(",", ".")) || 0;
    if (a <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    if (!user?.id) return;
    setLoading(true);
    const { error } = await supabase.from("investor_payments" as never).insert({
      loan_id: loanId, investor_id: loan.investor_id, user_id: user.id,
      amount: a, method,
    } as never);
    if (!error) {
      const newPaid = Number(loan.paid_amount) + a;
      const paidInFull = newPaid >= Number(loan.total_due) - 0.01;
      await supabase.from("investor_loans" as never).update({
        paid_amount: newPaid,
        status: paidInFull ? "paid" : loan.status,
        paid_at: paidInFull ? new Date().toISOString() : loan.paid_at,
        payment_method: method,
      } as never).eq("id", loanId);
    }
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Pagamento registrado!" });
    onPaid();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Saldo devedor</p>
            <p className="font-mono text-2xl font-bold">{brl(saldo)}</p>
          </div>
          <div><Label>Valor pago (R$)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div>
            <Label>Método</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option><option value="outros">Outros</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Salvando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
