import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, DollarSign, FileText, User, Calendar,
  Send, RotateCcw, Copy, Edit, Trash2, Ban, Download, MessageSquare, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statusLabels: Record<string, string> = { pending: "Pendente", paid: "Pago", overdue: "Atrasado" };
const statusIcons: Record<string, any> = { pending: <Clock size={14} />, paid: <CheckCircle size={14} />, overdue: <AlertTriangle size={14} /> };
const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
};
const freqLabels: Record<string, string> = { daily: "Diário", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };

const ContratoDetalhe = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, clients(name, cpf_cnpj, phone, whatsapp, email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      setNotes(data.notes || "");
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
    const inst = installments.find((i: any) => i.id === instId);
    const { error } = await supabase
      .from("contract_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: inst?.amount })
      .eq("id", instId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Parcela paga!" });
    queryClient.invalidateQueries({ queryKey: ["contract-installments", id] });
  };

  const reversePayment = async (instId: string) => {
    if (!confirm("Estornar pagamento?")) return;
    await supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", instId);
    toast({ title: "Estornado!" });
    queryClient.invalidateQueries({ queryKey: ["contract-installments", id] });
  };

  const sendBilling = (inst: any) => {
    const phone = contract?.clients?.whatsapp || contract?.clients?.phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const msg = encodeURIComponent(`Olá ${contract?.clients?.name}, sua parcela #${inst.installment_number} de R$ ${fmt(Number(inst.amount))} venceu em ${new Date(inst.due_date).toLocaleDateString("pt-BR")}. Regularize o pagamento.`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  const sendAllOverdue = () => {
    const overdue = installments.filter((i: any) => i.status === "overdue");
    if (!overdue.length) { toast({ title: "Sem parcelas atrasadas" }); return; }
    const phone = contract?.clients?.whatsapp || contract?.clients?.phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const total = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const msg = encodeURIComponent(`Olá ${contract?.clients?.name}, você possui ${overdue.length} parcela(s) em atraso, total R$ ${fmt(total)}. Entre em contato para regularizar.`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  const copyContractInfo = () => {
    if (!contract) return;
    const text = `Contrato: ${contract.clients?.name}\nCapital: R$ ${fmt(Number(contract.capital))}\nParcelas: ${contract.num_installments}x R$ ${fmt(Number(contract.installment_amount))}\nFrequência: ${freqLabels[contract.frequency] || contract.frequency}\nTotal: R$ ${fmt(Number(contract.total_amount))}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  const saveNotes = async () => {
    await supabase.from("contracts").update({ notes }).eq("id", id!);
    toast({ title: "Notas salvas!" });
    setEditNotes(false);
    queryClient.invalidateQueries({ queryKey: ["contract", id] });
  };

  const cancelContract = async () => {
    if (!confirm("Cancelar este contrato?")) return;
    await supabase.from("contracts").update({ status: "cancelled" }).eq("id", id!);
    toast({ title: "Contrato cancelado" });
    queryClient.invalidateQueries({ queryKey: ["contract", id] });
  };

  const deleteContract = async () => {
    if (!confirm("Excluir contrato e todas as parcelas?")) return;
    await supabase.from("contract_installments").delete().eq("contract_id", id!);
    await supabase.from("contracts").delete().eq("id", id!);
    toast({ title: "Contrato excluído!" });
    navigate("/contratos");
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
  const totalPaid = installments.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);

  const tools = [
    { icon: Send, label: "Cobrar Atrasadas", action: sendAllOverdue, color: "text-destructive" },
    { icon: Copy, label: "Copiar Info", action: copyContractInfo, color: "text-muted-foreground" },
    { icon: Edit, label: "Notas", action: () => setEditNotes(true), color: "text-primary" },
    { icon: MessageSquare, label: "WhatsApp", action: () => { const p = (contract?.clients?.whatsapp || contract?.clients?.phone || "").replace(/\D/g, ""); if (p) window.open(`https://wa.me/${p}`, "_blank"); }, color: "text-success" },
    { icon: User, label: "Ver Cliente", action: () => navigate(`/clientes/${contract.client_id}`), color: "text-info" },
    { icon: Ban, label: "Cancelar", action: cancelContract, color: "text-warning" },
    { icon: Trash2, label: "Excluir", action: deleteContract, color: "text-destructive" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in">
        <button onClick={() => navigate("/contratos")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <User size={18} className="text-primary" /> {contract.clients?.name}
          </h1>
          <p className="text-xs text-muted-foreground">{contract.clients?.cpf_cnpj || "—"} · {freqLabels[contract.frequency] || contract.frequency}</p>
        </div>
        <Badge variant="outline" className={contract.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
          {contract.status === "active" ? "Ativo" : contract.status === "cancelled" ? "Cancelado" : contract.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: "Capital", value: `R$ ${fmt(Number(contract.capital))}`, color: "text-foreground", bg: "bg-primary/10" },
          { icon: CheckCircle, label: "Recebido", value: `R$ ${fmt(totalPaid)}`, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { icon: AlertTriangle, label: "Atrasadas", value: String(overdue), color: "text-destructive", bg: "bg-destructive/10" },
          { icon: TrendingUp, label: "Lucro", value: `R$ ${fmt(Number(contract.total_interest))}`, color: "text-primary", bg: "bg-primary/10" },
        ].map((s, idx) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 animate-fade-in card-hover" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tools */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 animate-fade-in">
        {tools.map((tool, idx) => (
          <button key={idx} onClick={tool.action} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border bg-card hover:bg-accent/50 transition-all card-hover" title={tool.label}>
            <tool.icon size={16} className={tool.color} />
            <span className="text-[9px] font-medium text-muted-foreground leading-tight text-center">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar size={16} className="text-primary" /> Progresso
          </span>
          <span className="text-xs text-muted-foreground">{paid}/{contract.num_installments} · {paidPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${paidPct}%` }} />
        </div>
      </div>

      {/* Contract details */}
      <div className="bg-card border border-border rounded-xl p-4 animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-3">Detalhes do Contrato</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Capital", value: `R$ ${fmt(Number(contract.capital))}` },
            { label: "Total a Receber", value: `R$ ${fmt(Number(contract.total_amount))}` },
            { label: "Valor Parcela", value: `R$ ${fmt(Number(contract.installment_amount))}` },
            { label: "Multa Diária", value: `${contract.daily_interest_percent}%` },
            { label: "Multa Mensal", value: `${contract.late_fee_percent}%` },
            { label: "Início", value: new Date(contract.start_date).toLocaleDateString("pt-BR") },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {editNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Notas do Contrato</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" placeholder="Adicione observações..." />
            <div className="flex gap-2">
              <button onClick={() => setEditNotes(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">Cancelar</button>
              <button onClick={saveNotes} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Installments */}
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <FileText size={16} className="text-primary" /> Parcelas
          </h2>
          <span className="text-xs text-muted-foreground">{installments.length} parcelas</span>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {installments.map((inst: any) => (
            <div key={inst.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                inst.status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
                inst.status === "overdue" ? "bg-destructive/10 text-destructive" :
                "bg-amber-500/10 text-amber-500"
              }`}>
                {inst.installment_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">R$ {fmt(Number(inst.amount))}</p>
                <p className="text-[10px] text-muted-foreground">
                  Vence: {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                  {inst.paid_at && ` · Pago: ${new Date(inst.paid_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <Badge variant="outline" className={`gap-1 text-[10px] ${statusColors[inst.status]}`}>
                {statusIcons[inst.status]}
                {statusLabels[inst.status]}
              </Badge>
              <div className="flex items-center gap-1 shrink-0">
                {inst.status === "paid" ? (
                  <button onClick={() => reversePayment(inst.id)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Estornar">
                    <RotateCcw size={14} />
                  </button>
                ) : (
                  <>
                    <button onClick={() => sendBilling(inst)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Enviar cobrança">
                      <Send size={14} />
                    </button>
                    <button
                      onClick={() => handlePayInstallment(inst.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                    >
                      Pagar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes display */}
      {contract.notes && (
        <div className="bg-card border border-border rounded-xl p-4 animate-fade-in">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notas</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{contract.notes}</p>
        </div>
      )}
    </div>
  );
};

export default ContratoDetalhe;
