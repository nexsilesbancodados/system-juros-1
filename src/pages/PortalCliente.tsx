import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, FileText, LogOut, User, Calendar, AlertTriangle, CheckCircle,
  DollarSign, CreditCard, ChevronDown, ChevronUp, Clock, Shield,
  TrendingDown, TrendingUp, Receipt, Eye, EyeOff, Wallet, Phone,
  BarChart3, ArrowRight, Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"pendentes" | "pagas">("pendentes");
  const [ownerProfile, setOwnerProfile] = useState<any>(null);

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 14);
    if (nums.length <= 11) {
      return nums.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
        [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
      );
    }
    return nums.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) =>
      a + (b ? `.${b}` : "") + (c ? `.${c}` : "") + (d ? `/${d}` : "") + (e ? `-${e}` : "")
    );
  };

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length < 11) {
      toast({ title: "CPF inválido", description: "Digite um CPF válido com 11 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data: clients } = await supabase
      .from("clients")
      .select("*")
      .or(`cpf_cnpj.eq.${cleanCpf},cpf_cnpj.eq.${cpf}`);

    if (!clients || clients.length === 0) {
      toast({ title: "CPF não encontrado", description: "Nenhum cliente cadastrado com este CPF.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const client = clients[0];

    const [contractsRes, instsRes, profileRes] = await Promise.all([
      supabase.from("contracts").select("*").eq("client_id", client.id).order("created_at", { ascending: false }),
      supabase.from("contract_installments").select("*").eq("client_id", client.id).order("due_date"),
      supabase.from("profiles").select("name, pix_key, pix_key_type, billing_message, avatar_url").eq("id", client.user_id).single(),
    ]);

    const now = new Date();
    const processedInsts = (instsRes.data || []).map((inst: any) => {
      if (inst.status === "pending" && new Date(inst.due_date) < now) {
        const daysLate = Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24));
        return { ...inst, status: "overdue", daysLate };
      }
      return inst;
    });

    setClientData(client);
    setContracts(contractsRes.data || []);
    setInstallments(processedInsts);
    setOwnerProfile(profileRes.data);
    setLoading(false);
    if (contractsRes.data && contractsRes.data.length > 0) {
      setExpandedContract(contractsRes.data[0].id);
    }
    toast({ title: `Bem-vindo(a), ${client.name.split(" ")[0]}!` });
  };

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  // Computed values
  const now = new Date();
  const pending = installments.filter((i: any) => i.status === "pending");
  const overdue = installments.filter((i: any) => i.status === "overdue");
  const paid = installments.filter((i: any) => i.status === "paid");
  const totalPending = [...pending, ...overdue].reduce((a: number, i: any) => a + Number(i.amount), 0);
  const totalPaid = paid.reduce((a: number, i: any) => a + Number(i.paid_amount || i.amount), 0);
  const totalCapital = contracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
  const totalAmount = contracts.reduce((s: number, c: any) => s + Number(c.total_amount || 0), 0);

  const nextDue = useMemo(() => {
    const upcoming = [...pending, ...overdue].sort((a: any, b: any) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    return upcoming[0] || null;
  }, [pending, overdue]);

  // ===== LOGIN SCREEN =====
  if (!clientData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Mesh gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[140px]" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-success/10 blur-[100px]" />
        </div>
        <div className="w-full max-w-sm animate-fade-in relative">
          <form onSubmit={handleAccess} className="space-y-5 rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-2xl">
            {/* Logo / branding area */}
            <div className="text-center">
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-5 shadow-lg">
                <Shield size={32} className="text-primary" />
                <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-xl -z-10" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success/20 border-2 border-card flex items-center justify-center">
                  <Lock size={10} className="text-success" />
                </div>
              </div>
              <h1 className="text-2xl font-display font-bold text-shimmer tracking-wide">Portal do Cliente</h1>
              <p className="text-sm text-muted-foreground mt-2">Consulte suas parcelas, contratos e histórico de pagamentos</p>
            </div>

            <div className="h-px bg-border" />

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                CPF / CNPJ
              </label>
              <input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                required
                className={`${inputCls} text-center text-lg tracking-widest font-mono`}
                inputMode="numeric"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-premium w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  Acessar Portal
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
              Acesso seguro · Digite o CPF cadastrado pelo seu credor
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ===== PORTAL CONTENT =====
  const progressTotal = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {clientData.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{clientData.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{clientData.cpf_cnpj}</p>
            </div>
          </div>
          <button onClick={() => { setClientData(null); setInstallments([]); setContracts([]); setCpf(""); setOwnerProfile(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5 pb-24 animate-fade-in">

        {/* Hero card - Next payment */}
        {nextDue && (
          <div className={`rounded-2xl border p-5 ${
            nextDue.status === "overdue"
              ? "border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent"
              : "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {nextDue.status === "overdue" ? "Parcela em Atraso" : "Próximo Vencimento"}
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  nextDue.status === "overdue" ? "text-destructive" : "text-foreground"
                }`}>
                  R$ {fmt(Number(nextDue.amount))}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                nextDue.status === "overdue" ? "bg-destructive/10" : "bg-primary/10"
              }`}>
                {nextDue.status === "overdue" ? (
                  <AlertTriangle size={22} className="text-destructive" />
                ) : (
                  <Calendar size={22} className="text-primary" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar size={11} />
                {new Date(nextDue.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              {nextDue.status === "overdue" && nextDue.daysLate && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                  {nextDue.daysLate} {nextDue.daysLate === 1 ? "dia" : "dias"} em atraso
                </Badge>
              )}
              <span className="text-muted-foreground">Parcela #{nextDue.installment_number}</span>
            </div>
          </div>
        )}

        {/* Overdue Alert */}
        {overdue.length > 1 && (
          <div className="bg-destructive/5 border border-destructive/15 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">
                Você tem {overdue.length} parcelas em atraso
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total em atraso: <span className="font-semibold text-destructive">R$ {fmt(overdue.reduce((s: number, i: any) => s + Number(i.amount), 0))}</span>
              </p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet size={13} className="text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Emprestado</span>
            </div>
            <p className="text-lg font-bold text-foreground">R$ {fmt(totalCapital)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown size={13} className="text-destructive" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Devedor</span>
            </div>
            <p className="text-lg font-bold text-destructive">R$ {fmt(totalPending)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp size={13} className="text-success" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pago</span>
            </div>
            <p className="text-lg font-bold text-success">R$ {fmt(totalPaid)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 size={13} className="text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Progresso</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-lg font-bold text-foreground">{progressTotal}%</p>
              <span className="text-[10px] text-muted-foreground mb-0.5">{paid.length}/{installments.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-700" style={{ width: `${progressTotal}%` }} />
            </div>
          </div>
        </div>

        {/* Contracts */}
        {contracts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText size={15} className="text-primary" />
              Seus Contratos
            </h2>
            {contracts.map((c: any) => {
              const cInst = installments.filter((i: any) => i.contract_id === c.id);
              const cPaid = cInst.filter((i: any) => i.status === "paid").length;
              const cOverdue = cInst.filter((i: any) => i.status === "overdue").length;
              const pct = Math.round((cPaid / (c.num_installments || 1)) * 100);
              const freqLabel = c.frequency === "monthly" ? "Mensal" : c.frequency === "weekly" ? "Semanal" : c.frequency === "daily" ? "Diário" : "Quinzenal";
              const isExpanded = expandedContract === c.id;

              return (
                <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
                  <button
                    onClick={() => setExpandedContract(isExpanded ? null : c.id)}
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/20 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      c.status === "active" ? "bg-success/10 border border-success/20" : "bg-muted"
                    }`}>
                      <DollarSign size={16} className={c.status === "active" ? "text-success" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.capital))}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          c.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"
                        }`}>
                          {c.status === "active" ? "Ativo" : c.status === "completed" ? "Quitado" : c.status}
                        </Badge>
                        {cOverdue > 0 && (
                          <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                            {cOverdue} atrasada{cOverdue > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.num_installments}x R$ {fmt(Number(c.installment_amount))} · {freqLabel} · {pct}% pago
                      </p>
                    </div>
                    <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border animate-fade-in">
                      {/* Contract progress */}
                      <div className="px-4 py-3 bg-accent/10">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                          <span>{cPaid} de {c.num_installments} pagas</span>
                          <span className="font-semibold text-foreground">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Contract details */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Capital</p>
                          <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.capital))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Total c/ Juros</p>
                          <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.total_amount))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Juros</p>
                          <p className="text-sm font-semibold text-foreground">{Number(c.interest_rate)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Início</p>
                          <p className="text-sm font-semibold text-foreground">
                            {new Date(c.start_date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>

                      {/* Contract installments */}
                      <div className="border-t border-border">
                        {cInst.length > 0 && (
                          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                            {cInst.map((i: any) => {
                              const isOd = i.status === "overdue";
                              const isPaid = i.status === "paid";
                              return (
                                <div key={i.id} className={`flex items-center gap-3 px-4 py-2.5 ${
                                  isOd ? "bg-destructive/3" : isPaid ? "bg-success/3" : ""
                                }`}>
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                    isPaid ? "bg-success/10 text-success" :
                                    isOd ? "bg-destructive/10 text-destructive" :
                                    "bg-muted text-muted-foreground"
                                  }`}>
                                    {i.installment_number}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground">
                                      R$ {fmt(Number(isPaid ? (i.paid_amount || i.amount) : i.amount))}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {isPaid && i.paid_at ? `Pago em ${new Date(i.paid_at).toLocaleDateString("pt-BR")}` :
                                       `Vence ${new Date(i.due_date).toLocaleDateString("pt-BR")}`}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={`text-[9px] ${
                                    isPaid ? "bg-success/10 text-success border-success/20" :
                                    isOd ? "bg-destructive/10 text-destructive border-destructive/20" :
                                    "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  }`}>
                                    {isPaid ? "✓ Pago" : isOd ? "Atrasada" : "Pendente"}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Parcelas Tab View */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {[
              { key: "pendentes" as const, label: "A Pagar", count: overdue.length + pending.length, icon: Clock },
              { key: "pagas" as const, label: "Pagas", count: paid.length, icon: CheckCircle },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {activeTab === "pendentes" ? (
              [...overdue, ...pending].length > 0 ? (
                [...overdue, ...pending].map((i: any) => {
                  const isOd = i.status === "overdue";
                  return (
                    <div key={i.id} className={`flex items-center gap-3 px-4 py-3.5 ${isOd ? "bg-destructive/3" : ""}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                        isOd ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}>
                        {i.installment_number}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(i.amount))}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar size={9} />
                          {new Date(i.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                          {isOd && i.daysLate && (
                            <span className="text-destructive font-medium ml-1">· {i.daysLate}d atraso</span>
                          )}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] gap-1 ${
                        isOd ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}>
                        {isOd && <AlertTriangle size={9} />}
                        {isOd ? "Atrasada" : "Pendente"}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                  <CheckCircle size={32} className="mx-auto text-success/40 mb-2" />
                  <p className="text-sm font-medium text-foreground">Nenhuma parcela pendente!</p>
                  <p className="text-xs text-muted-foreground mt-1">Parabéns, você está em dia</p>
                </div>
              )
            ) : (
              paid.length > 0 ? (
                [...paid].reverse().map((i: any) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-xs font-bold text-success">
                      {i.installment_number}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(i.paid_amount || i.amount))}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle size={9} className="text-success" />
                        {i.paid_at ? `Pago em ${new Date(i.paid_at).toLocaleDateString("pt-BR")}` : "Pago"}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
                      ✓ Pago
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Receipt size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* PIX info from owner */}
        {ownerProfile?.pix_key && (
          <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Dados para Pagamento</p>
                <p className="text-[10px] text-muted-foreground">Chave PIX do credor</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/20 border border-border">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {ownerProfile.pix_key_type === "cpf" ? "CPF" :
                   ownerProfile.pix_key_type === "cnpj" ? "CNPJ" :
                   ownerProfile.pix_key_type === "email" ? "E-mail" :
                   ownerProfile.pix_key_type === "phone" ? "Telefone" : "Chave Aleatória"}
                </p>
                <p className="text-sm font-mono font-semibold text-foreground mt-0.5">{ownerProfile.pix_key}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(ownerProfile.pix_key); toast({ title: "Chave PIX copiada!" }); }}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                Copiar
              </button>
            </div>
            {ownerProfile.name && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info size={10} /> Credor: {ownerProfile.name}
              </p>
            )}
          </div>
        )}

        {/* No contracts */}
        {contracts.length === 0 && installments.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-card/50">
            <FileText size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-foreground font-semibold">Nenhum contrato encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Não há registros de empréstimos vinculados ao seu CPF</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalCliente;
