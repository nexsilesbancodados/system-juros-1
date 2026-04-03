import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, FileText, LogOut, User, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: tokenData } = await supabase
      .from("client_tokens")
      .select("*, clients(id, name, cpf_cnpj)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!tokenData || tokenData.clients?.cpf_cnpj !== cpf) {
      toast({ title: "Acesso negado", description: "CPF ou token inválido.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: insts } = await supabase
      .from("contract_installments")
      .select("*, contracts(capital, interest_rate, frequency)")
      .eq("client_id", tokenData.client_id)
      .order("due_date");

    setClientData(tokenData.clients);
    setInstallments(insts || []);
    setLoading(false);
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const now = new Date();
  const inputCls = "w-full px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  if (!clientData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <form onSubmit={handleAccess} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock size={28} className="text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground tracking-wide">Portal do Cliente</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse com seu CPF e token de acesso</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">CPF</label>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Token</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Seu token de acesso" required className={inputCls} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90" style={{ background: "var(--gradient-button)" }}>
            {loading ? "Verificando..." : "Acessar Portal"}
          </button>
        </form>
      </div>
    );
  }

  const pending = installments.filter((i: any) => i.status === "pending");
  const paid = installments.filter((i: any) => i.status === "paid");
  const overdue = pending.filter((i: any) => new Date(i.due_date) < now);
  const totalPending = pending.reduce((a: number, i: any) => a + Number(i.amount), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <User size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{clientData.name}</h1>
            <p className="text-sm text-muted-foreground">CPF: {clientData.cpf_cnpj}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pendentes", value: pending.length, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Atrasadas", value: overdue.length, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Pagas", value: paid.length, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {totalPending > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total Pendente</p>
            <p className="text-xl font-bold text-foreground">R$ {fmt(totalPending)}</p>
          </div>
          <FileText size={24} className="text-muted-foreground/30" />
        </div>
      )}

      {/* Pending Installments */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Parcelas Pendentes</h2>
        </div>
        {pending.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-500/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma parcela pendente 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((i: any) => {
              const isOverdue = new Date(i.due_date) < now;
              return (
                <div key={i.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {i.installment_number}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">R$ {fmt(Number(i.amount))}</p>
                    <p className="text-xs text-muted-foreground">Vence: {new Date(i.due_date).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Badge variant="outline" className={isOverdue ? "bg-destructive/10 text-destructive border-destructive/20 gap-1" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}>
                    {isOverdue && <AlertTriangle size={10} />}
                    {isOverdue ? "Atrasada" : "Pendente"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paid */}
      {paid.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-500" />
            <h2 className="font-semibold text-foreground text-sm">Histórico de Pagamentos</h2>
          </div>
          <div className="divide-y divide-border">
            {paid.map((i: any) => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-500">{i.installment_number}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">R$ {fmt(Number(i.paid_amount || i.amount))}</p>
                  <p className="text-xs text-muted-foreground">Pago em: {i.paid_at ? new Date(i.paid_at).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pago</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => { setClientData(null); setInstallments([]); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <LogOut size={14} /> Sair do portal
      </button>
    </div>
  );
};

export default PortalCliente;
