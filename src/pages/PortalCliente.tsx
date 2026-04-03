import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, FileText, LogOut, User, Calendar, AlertTriangle, CheckCircle, DollarSign, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);

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

    // Search client by cpf_cnpj (try with and without formatting)
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

    // Fetch contracts
    const { data: contractsData } = await supabase
      .from("contracts")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    // Fetch all installments
    const { data: instsData } = await supabase
      .from("contract_installments")
      .select("*")
      .eq("client_id", client.id)
      .order("due_date");

    const now = new Date();
    const processedInsts = (instsData || []).map((inst: any) => {
      if (inst.status === "pending" && new Date(inst.due_date) < now) return { ...inst, status: "overdue" };
      return inst;
    });

    setClientData(client);
    setContracts(contractsData || []);
    setInstallments(processedInsts);
    setLoading(false);
    toast({ title: `Bem-vindo, ${client.name}!` });
  };

  const inputCls = "w-full px-4 py-3 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  // ===== LOGIN SCREEN =====
  if (!clientData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <form onSubmit={handleAccess} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-lg animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User size={28} className="text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground tracking-wide">Portal do Cliente</h1>
            <p className="text-sm text-muted-foreground mt-1">Consulte suas parcelas e contratos</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">CPF / CNPJ</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              required
              className={inputCls}
              inputMode="numeric"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-button)" }}
          >
            {loading ? "Verificando..." : "Acessar Portal"}
          </button>
          <p className="text-[10px] text-center text-muted-foreground">
            Acesse com o CPF cadastrado pelo seu credor
          </p>
        </form>
      </div>
    );
  }

  // ===== PORTAL CONTENT =====
  const now = new Date();
  const pending = installments.filter((i: any) => i.status === "pending");
  const overdue = installments.filter((i: any) => i.status === "overdue");
  const paid = installments.filter((i: any) => i.status === "paid");
  const totalPending = [...pending, ...overdue].reduce((a: number, i: any) => a + Number(i.amount), 0);
  const totalPaid = paid.reduce((a: number, i: any) => a + Number(i.paid_amount || i.amount), 0);
  const totalCapital = contracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{clientData.name}</p>
              <p className="text-[10px] text-muted-foreground">CPF: {clientData.cpf_cnpj}</p>
            </div>
          </div>
          <button onClick={() => { setClientData(null); setInstallments([]); setContracts([]); setCpf(""); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-accent transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5 pb-20 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: DollarSign, label: "Capital", value: `R$ ${fmt(totalCapital)}`, color: "text-foreground", bg: "bg-primary/10" },
            { icon: AlertTriangle, label: "A Pagar", value: `R$ ${fmt(totalPending)}`, color: "text-destructive", bg: "bg-destructive/10" },
            { icon: CheckCircle, label: "Pago", value: `R$ ${fmt(totalPaid)}`, color: "text-success", bg: "bg-success/10" },
            { icon: FileText, label: "Contratos", value: String(contracts.length), color: "text-primary", bg: "bg-primary/10" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-3 text-center">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mx-auto mb-1.5`}>
                <s.icon size={16} className={s.color} />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Overdue Alert */}
        {overdue.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/15 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">
                {overdue.length} parcela(s) em atraso
              </p>
              <p className="text-xs text-muted-foreground">
                Total: R$ {fmt(overdue.reduce((s: number, i: any) => s + Number(i.amount), 0))}
              </p>
            </div>
          </div>
        )}

        {/* Contracts */}
        {contracts.map((c: any) => {
          const cInst = installments.filter((i: any) => i.contract_id === c.id);
          const cPaid = cInst.filter((i: any) => i.status === "paid").length;
          const pct = Math.round((cPaid / (c.num_installments || 1)) * 100);
          const freqLabel = c.frequency === "monthly" ? "Mensal" : c.frequency === "weekly" ? "Semanal" : c.frequency === "daily" ? "Diário" : "Quinzenal";

          return (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Empréstimo R$ {fmt(Number(c.capital))}</p>
                  <p className="text-xs text-muted-foreground">{c.num_installments}x R$ {fmt(Number(c.installment_amount))} · {freqLabel}</p>
                </div>
                <Badge variant="outline" className={c.status === "active" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                  {c.status === "active" ? "Ativo" : c.status}
                </Badge>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">{cPaid}/{c.num_installments} pagas · {pct}% concluído</p>
            </div>
          );
        })}

        {/* Overdue + Pending Installments */}
        {[...overdue, ...pending].length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Parcelas a Pagar</h2>
              <span className="text-xs text-muted-foreground ml-auto">{overdue.length + pending.length}</span>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {[...overdue, ...pending].map((i: any) => {
                const isOd = i.status === "overdue";
                return (
                  <div key={i.id} className={`flex items-center gap-3 px-4 py-3 ${isOd ? "bg-destructive/3" : ""}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isOd ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {i.installment_number}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">R$ {fmt(Number(i.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">Vence: {new Date(i.due_date).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${isOd ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}>
                      {isOd && <AlertTriangle size={10} />}
                      {isOd ? "Atrasada" : "Pendente"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Paid History */}
        {paid.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <CheckCircle size={16} className="text-success" />
              <h2 className="font-semibold text-foreground text-sm">Pagamentos Realizados</h2>
              <span className="text-xs text-muted-foreground ml-auto">{paid.length}</span>
            </div>
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {paid.map((i: any) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-xs font-bold text-success">{i.installment_number}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">R$ {fmt(Number(i.paid_amount || i.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">Pago: {i.paid_at ? new Date(i.paid_at).toLocaleDateString("pt-BR") : "—"}</p>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">Pago</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No installments */}
        {installments.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle size={40} className="mx-auto text-success/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma parcela registrada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalCliente;
