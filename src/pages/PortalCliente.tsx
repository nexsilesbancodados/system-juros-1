import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Lock, FileText } from "lucide-react";
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

    // Verify token
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

    // Fetch installments
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
  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  if (!clientData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={handleAccess} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8">
          <div className="text-center">
            <Lock size={32} className="mx-auto text-primary mb-3" />
            <h1 className="text-xl font-bold text-foreground">Portal do Cliente</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse com seu CPF e token</p>
          </div>
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="CPF (somente números)" required className={inputCls} />
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de acesso" required className={inputCls} />
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            {loading ? "Verificando..." : "Acessar"}
          </button>
        </form>
      </div>
    );
  }

  const pending = installments.filter((i: any) => i.status === "pending");
  const paid = installments.filter((i: any) => i.status === "paid");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{clientData.name}</h1>
        <p className="text-sm text-muted-foreground">CPF: {clientData.cpf_cnpj}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-amber-500">{pending.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pagas</p>
          <p className="text-2xl font-bold text-emerald-500">{paid.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Parcelas Pendentes</h2>
        </div>
        {pending.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma parcela pendente 🎉</div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((i: any) => {
              const isOverdue = new Date(i.due_date) < now;
              return (
                <div key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{i.installment_number}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">R$ {fmt(Number(i.amount))}</p>
                    <p className="text-xs text-muted-foreground">Vence: {new Date(i.due_date).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Badge variant="outline" className={isOverdue ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}>
                    {isOverdue ? "Atrasada" : "Pendente"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {paid.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Histórico de Pagamentos</h2>
          </div>
          <div className="divide-y divide-border">
            {paid.map((i: any) => (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-500">{i.installment_number}</div>
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

      <button onClick={() => { setClientData(null); setInstallments([]); }} className="text-sm text-muted-foreground hover:text-foreground">← Sair do portal</button>
    </div>
  );
};

export default PortalCliente;
