import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CalendarDays, Clock, CreditCard, FileText, Lock, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type PortalInstallment = {
  id: string;
  installment_number: number;
  amount: number | string;
  due_date: string;
  paid_at?: string | null;
  paid_amount?: number | string | null;
  late_fee?: number | string | null;
  status: string;
};

type PortalContract = {
  id: string;
  capital: number | string;
  interest_rate: number | string;
  num_installments: number;
  installment_amount: number | string;
  frequency: string;
  start_date: string;
  status: string;
  total_amount: number | string;
  total_interest: number | string;
  payment_method?: string | null;
  installments: PortalInstallment[];
};

type PortalData = {
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    cpf_cnpj?: string | null;
    status?: string | null;
    birth_date?: string | null;
  };
  contracts: PortalContract[];
};

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const date = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const statusLabel = (status: string) => {
  if (status === "paid") return "Pago";
  if (status === "active") return "Ativo";
  if (status === "overdue") return "Vencido";
  if (status === "completed") return "Concluído";
  if (status === "cancelled") return "Cancelado";
  return "Pendente";
};

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalData, setPortalData] = useState<PortalData | null>(null);

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    return nums.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
      [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
    );
  };

  const summary = useMemo(() => {
    const contracts = portalData?.contracts || [];
    const installments = contracts.flatMap((contract) => contract.installments || []);
    const paid = installments.filter((installment) => installment.status === "paid");
    const open = installments.filter((installment) => installment.status !== "paid");
    const overdue = open.filter((installment) => new Date(installment.due_date) < new Date());

    return {
      activeContracts: contracts.filter((contract) => contract.status === "active").length,
      openAmount: open.reduce((sum, installment) => sum + Number(installment.amount || 0) + Number(installment.late_fee || 0), 0),
      paidAmount: paid.reduce((sum, installment) => sum + Number(installment.paid_amount || installment.amount || 0), 0),
      overdueCount: overdue.length,
    };
  }, [portalData]);

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");

    if (cleanCpf.length !== 11 || !birthDate) {
      toast({ title: "Informe CPF e data de nascimento válidos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("portal_client_login" as never, {
        _cpf: cleanCpf,
        _birth_date: birthDate,
      } as never);

      if (error) {
        console.error("Erro no login do portal:", error);
        toast({ title: "Erro ao acessar o portal", description: "Tente novamente em instantes.", variant: "destructive" });
        return;
      }

      if (!data) {
        toast({ title: "Acesso negado", description: "CPF ou data de nascimento não conferem.", variant: "destructive" });
        return;
      }

      setPortalData(data as unknown as PortalData);
      toast({ title: "Acesso autorizado!" });
    } catch (err) {
      console.error("Falha inesperada no portal do cliente:", err);
      toast({ title: "Erro no acesso", description: "Não foi possível carregar seus dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const firstName = portalData?.client?.name?.split(" ")?.[0] || "Cliente";

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center md:min-h-[calc(100vh-4rem)]">
        {!portalData ? (
          <section className="glass-card relative w-full max-w-md overflow-hidden p-8 shadow-elevated">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <Shield size={40} className="text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-normal">Portal <span className="text-primary">VIP</span></h1>
                <p className="mt-3 text-sm text-muted-foreground">Acesse seus dados financeiros com segurança</p>
              </div>
            </div>

            <form onSubmit={handleAccess} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CPF</label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  inputMode="numeric"
                  className="w-full rounded-xl border border-border bg-input px-4 py-4 text-center font-mono text-xl text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data de Nascimento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-input px-4 py-4 text-center text-lg text-foreground outline-none transition-colors [color-scheme:dark] focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full rounded-xl py-7 text-lg font-bold shadow-premium">
                {loading ? <Clock className="mr-2 animate-spin" /> : <ArrowRight className="mr-2" />}
                {loading ? "Verificando..." : "Entrar no Portal"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCpf("100.200.300-10");
                  setBirthDate("1990-01-01");
                }}
                className="w-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Usar Credenciais de Teste
              </Button>
            </form>

            <div className="pt-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Criptografia de Ponta a Ponta</p>
            </div>
          </section>
        ) : (
          <section className="w-full space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-success/20 bg-success/10">
                  <User className="text-success" size={28} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-normal md:text-4xl">Olá, {firstName}</h1>
                  <p className="text-sm text-muted-foreground">Contratos e parcelas vinculados ao seu CPF.</p>
                </div>
              </div>
              <Button onClick={() => setPortalData(null)} variant="outline" className="border-border">
                <Lock className="mr-2" size={16} />
                Sair
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contratos ativos</p>
                <p className="mt-2 text-2xl font-bold">{summary.activeContracts}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saldo em aberto</p>
                <p className="mt-2 text-2xl font-bold">{money(summary.openAmount)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total pago</p>
                <p className="mt-2 text-2xl font-bold text-success">{money(summary.paidAmount)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Parcelas vencidas</p>
                <p className="mt-2 text-2xl font-bold text-warning">{summary.overdueCount}</p>
              </div>
            </div>

            <div className="space-y-4">
              {portalData.contracts.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground">Nenhum contrato encontrado para este cliente.</div>
              ) : portalData.contracts.map((contract) => (
                <article key={contract.id} className="glass-card overflow-hidden">
                  <div className="grid gap-4 border-b border-border/60 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="text-primary" size={20} />
                        <h2 className="text-xl font-bold tracking-normal">Contrato {contract.id.slice(0, 8).toUpperCase()}</h2>
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {statusLabel(contract.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Início em {date(contract.start_date)} • {contract.num_installments} parcelas</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Valor total</p>
                      <p className="text-2xl font-bold">{money(contract.total_amount)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 p-5 md:grid-cols-3">
                    <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                      <CreditCard className="mb-2 text-primary" size={18} />
                      <p className="text-xs text-muted-foreground">Capital</p>
                      <p className="font-bold">{money(contract.capital)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                      <CalendarDays className="mb-2 text-primary" size={18} />
                      <p className="text-xs text-muted-foreground">Parcela</p>
                      <p className="font-bold">{money(contract.installment_amount)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                      <Shield className="mb-2 text-primary" size={18} />
                      <p className="text-xs text-muted-foreground">Juros</p>
                      <p className="font-bold">{Number(contract.interest_rate || 0)}%</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto px-5 pb-5">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                        <tr className="border-b border-border/60">
                          <th className="py-3">Parcela</th>
                          <th className="py-3">Vencimento</th>
                          <th className="py-3">Valor</th>
                          <th className="py-3">Multa</th>
                          <th className="py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(contract.installments || []).map((installment) => {
                          const isOverdue = installment.status !== "paid" && new Date(installment.due_date) < new Date();
                          return (
                            <tr key={installment.id} className="border-b border-border/40 last:border-0">
                              <td className="py-3 font-semibold">#{installment.installment_number}</td>
                              <td className="py-3">{date(installment.due_date)}</td>
                              <td className="py-3">{money(installment.amount)}</td>
                              <td className="py-3">{money(installment.late_fee)}</td>
                              <td className="py-3 text-right">
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${installment.status === "paid" ? "bg-success/10 text-success" : isOverdue ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                                  {installment.status === "paid" ? "Pago" : isOverdue ? "Vencido" : "Em aberto"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default PortalCliente;
