import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
};

const statusIcons: Record<string, any> = {
  pending: <Clock size={14} />,
  paid: <CheckCircle size={14} />,
  overdue: <AlertTriangle size={14} />,
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  overdue: "bg-red-500/10 text-red-500 border-red-500/20",
};

const ContratoDetalhe = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, clients(name, cpf_cnpj, phone, whatsapp)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["contract-installments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_installments")
        .select("*")
        .eq("contract_id", id!)
        .order("installment_number");
      if (error) throw error;

      // Mark overdue installments
      const now = new Date();
      return (data || []).map((inst: any) => {
        if (inst.status === "pending" && new Date(inst.due_date) < now) {
          return { ...inst, status: "overdue" };
        }
        return inst;
      });
    },
    enabled: !!id && !!user,
  });

  const handlePayInstallment = async (instId: string) => {
    const { error } = await supabase
      .from("contract_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: installments.find((i: any) => i.id === instId)?.amount })
      .eq("id", instId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Parcela paga!" });
      queryClient.invalidateQueries({ queryKey: ["contract-installments", id] });
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  if (!contract) return <div className="text-center py-12 text-muted-foreground">Contrato não encontrado</div>;

  const paid = installments.filter((i: any) => i.status === "paid").length;
  const overdue = installments.filter((i: any) => i.status === "overdue").length;
  const pending = installments.filter((i: any) => i.status === "pending").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/contratos")} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{contract.clients?.name}</h1>
          <p className="text-sm text-muted-foreground">{contract.clients?.cpf_cnpj || "—"}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Capital", value: `R$ ${Number(contract.capital).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-foreground" },
          { label: "Pagas", value: `${paid}/${contract.num_installments}`, color: "text-emerald-500" },
          { label: "Atrasadas", value: overdue, color: "text-red-500" },
          { label: "Pendentes", value: pending, color: "text-amber-500" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Installments */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Parcelas</h2>
        </div>
        <div className="divide-y divide-border">
          {installments.map((inst: any) => (
            <div key={inst.id} className="flex items-center gap-4 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                {inst.installment_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  R$ {Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vence: {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                  {inst.paid_at && ` · Pago: ${new Date(inst.paid_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <Badge variant="outline" className={`gap-1 ${statusColors[inst.status]}`}>
                {statusIcons[inst.status]}
                {statusLabels[inst.status]}
              </Badge>
              {inst.status !== "paid" && (
                <button
                  onClick={() => handlePayInstallment(inst.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                >
                  Registrar Pgto
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContratoDetalhe;
