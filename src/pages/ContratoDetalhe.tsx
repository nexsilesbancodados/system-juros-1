import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, DollarSign, FileText, User, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statusLabels: Record<string, string> = { pending: "Pendente", paid: "Pago", overdue: "Atrasado" };
const statusIcons: Record<string, any> = { pending: <Clock size={14} />, paid: <CheckCircle size={14} />, overdue: <AlertTriangle size={14} /> };
const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
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
      const now = new Date();
      return (data || []).map((inst: any) => {
        if (inst.status === "pending" && new Date(inst.due_date) < now) return { ...inst, status: "overdue" };
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

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );

  if (!contract) return (
    <div className="text-center py-16">
      <FileText size={48} className="mx-auto text-muted-foreground/20 mb-4" />
      <p className="text-muted-foreground">Contrato não encontrado</p>
    </div>
  );

  const paid = installments.filter((i: any) => i.status === "paid").length;
  const overdue = installments.filter((i: any) => i.status === "overdue").length;
  const pending = installments.filter((i: any) => i.status === "pending").length;
  const paidPct = Math.round((paid / (contract.num_installments || 1)) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in">
        <button onClick={() => navigate("/contratos")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <User size={20} className="text-primary" /> {contract.clients?.name}
          </h1>
          <p className="text-sm text-muted-foreground">{contract.clients?.cpf_cnpj || "—"}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: "Capital", value: `R$ ${fmt(Number(contract.capital))}`, color: "text-foreground", bg: "bg-primary/10" },
          { icon: CheckCircle, label: "Pagas", value: `${paid}/${contract.num_installments}`, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { icon: AlertTriangle, label: "Atrasadas", value: String(overdue), color: "text-destructive", bg: "bg-destructive/10" },
          { icon: Clock, label: "Pendentes", value: String(pending), color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((s, idx) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 animate-fade-in card-hover" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar size={16} className="text-primary" /> Progresso do Contrato
          </span>
          <span className="text-xs text-muted-foreground">{paidPct}% concluído</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${paidPct}%` }} />
        </div>
      </div>

      {/* Installments */}
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <FileText size={18} className="text-primary" /> Parcelas
          </h2>
          <span className="text-xs text-muted-foreground">{installments.length} parcelas</span>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {installments.map((inst: any) => (
            <div key={inst.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${statusColors[inst.status]?.split(" ").slice(0, 2).join(" ") || "bg-muted text-muted-foreground"}`}>
                {inst.installment_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  R$ {fmt(Number(inst.amount))}
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
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
