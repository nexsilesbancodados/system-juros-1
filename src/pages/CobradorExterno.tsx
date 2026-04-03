import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Users, AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CobradorExterno = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [collectorData, setCollectorData] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [collectorId, setCollectorId] = useState<string | null>(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ["ext-assignments", collectorId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collector_assignments")
        .select("*, clients(id, name, phone, whatsapp, cpf_cnpj)")
        .eq("collector_id", collectorId!)
        .eq("user_id", userId!);
      return data || [];
    },
    enabled: !!collectorId && !!userId,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["ext-installments", assignments.map((a: any) => a.client_id)],
    queryFn: async () => {
      const clientIds = assignments.map((a: any) => a.client_id);
      if (clientIds.length === 0) return [];
      const { data } = await supabase
        .from("contract_installments")
        .select("*, contracts(capital, interest_rate)")
        .in("client_id", clientIds)
        .order("due_date");
      return data || [];
    },
    enabled: assignments.length > 0,
  });

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: tokenData } = await supabase
      .from("collector_tokens")
      .select("*, collectors(id, name, phone, city, state)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!tokenData) {
      toast({ title: "Acesso negado", description: "Token inválido ou desativado.", variant: "destructive" });
      setLoading(false);
      return;
    }

    setCollectorData(tokenData.collectors);
    setCollectorId(tokenData.collector_id);
    setUserId(tokenData.user_id);
    setLoading(false);
  };

  const handleRegisterPayment = async (installmentId: string, amount: number) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("contract_installments")
      .update({ status: "paid", paid_amount: amount, paid_at: now })
      .eq("id", installmentId);

    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Pagamento registrado!" });
      queryClient.invalidateQueries({ queryKey: ["ext-installments"] });
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const now = new Date();
  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  if (!collectorData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <form onSubmit={handleAccess} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8">
          <div className="text-center">
            <Lock size={32} className="mx-auto text-primary mb-3" />
            <h1 className="text-xl font-bold text-foreground">Portal do Cobrador</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse com seu token</p>
          </div>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de acesso" required className={inputCls} />
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
            {loading ? "Verificando..." : "Acessar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{collectorData.name}</h1>
            <p className="text-sm text-muted-foreground">{collectorData.city}/{collectorData.state} · {collectorData.phone}</p>
          </div>
          <button onClick={() => { setCollectorData(null); setCollectorId(null); setUserId(null); }} className="text-sm text-muted-foreground hover:text-foreground">
            Sair
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-2xl font-bold text-foreground">{assignments.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-amber-500">
              {installments.filter((i: any) => i.status === "pending").length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Atrasadas</p>
            <p className="text-2xl font-bold text-red-500">
              {installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now).length}
            </p>
          </div>
        </div>

        {/* Client list with installments */}
        {assignments.map((a: any) => {
          const clientInstallments = installments.filter((i: any) => i.client_id === a.client_id && i.status === "pending");
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{a.clients?.name}</p>
                  <p className="text-xs text-muted-foreground">{a.clients?.phone || a.clients?.whatsapp || "Sem telefone"}</p>
                </div>
                <Badge variant="outline" className={clientInstallments.length > 0 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}>
                  {clientInstallments.length > 0 ? `${clientInstallments.length} pendente(s)` : "Em dia"}
                </Badge>
              </div>
              {clientInstallments.length > 0 && (
                <div className="divide-y divide-border">
                  {clientInstallments.map((inst: any) => {
                    const isOverdue = new Date(inst.due_date) < now;
                    return (
                      <div key={inst.id} className="flex items-center gap-3 px-5 py-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isOverdue ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                          {inst.installment_number}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">R$ {fmt(Number(inst.amount))}</p>
                          <p className="text-xs text-muted-foreground">
                            Vence: {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                            {isOverdue && <span className="text-red-500 ml-2">({Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / 86400000)} dias atrás)</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRegisterPayment(inst.id, Number(inst.amount))}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                        >
                          <DollarSign size={12} /> Pagar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {assignments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nenhum cliente atribuído a você.</div>
        )}
      </div>
    </div>
  );
};

export default CobradorExterno;
