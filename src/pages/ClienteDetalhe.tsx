import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, User, Phone, Mail, MapPin, CreditCard, FileText, DollarSign,
  CheckCircle, AlertTriangle, Clock, Edit, Trash2, Plus, Send, Copy,
  MessageSquare, Star, Ban, RotateCcw, Download, Eye, TrendingUp,
  Calendar, Shield, Hash, Wallet, Receipt, Activity
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const ClienteDetalhe = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"resumo" | "contratos" | "parcelas" | "historico">("resumo");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // Fetch client
  const { data: client, isLoading } = useQuery({
    queryKey: ["client-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!user,
  });

  // Fetch all installments
  const { data: installments = [] } = useQuery({
    queryKey: ["client-installments", id],
    queryFn: async () => {
      const { data } = await supabase.from("contract_installments").select("*, contracts(capital, frequency)").eq("client_id", id!).order("due_date", { ascending: true });
      const now = new Date();
      return (data || []).map((inst: any) => {
        if (inst.status === "pending" && new Date(inst.due_date) < now) return { ...inst, status: "overdue" };
        return inst;
      });
    },
    enabled: !!id && !!user,
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["client-transactions", id],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("client_id", id!).order("date", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!id && !!user,
  });

  // Fetch profits
  const { data: profits = [] } = useQuery({
    queryKey: ["client-profits", id],
    queryFn: async () => {
      const { data } = await supabase.from("profits").select("*").eq("client_id", id!).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!user,
  });

  // Financial calculations
  const totalCapital = contracts.reduce((s: number, c: any) => s + Number(c.capital || 0), 0);
  const totalAmount = contracts.reduce((s: number, c: any) => s + Number(c.total_amount || 0), 0);
  const totalInterest = contracts.reduce((s: number, c: any) => s + Number(c.total_interest || 0), 0);
  const paidInstallments = installments.filter((i: any) => i.status === "paid");
  const overdueInstallments = installments.filter((i: any) => i.status === "overdue");
  const pendingInstallments = installments.filter((i: any) => i.status === "pending");
  const totalPaid = paidInstallments.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
  const totalOverdue = overdueInstallments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const totalPending = pendingInstallments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const totalProfit = profits.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  // ===== TOOL FUNCTIONS =====

  // 1. Edit client
  const startEdit = () => {
    setEditData({
      name: client?.name || "",
      phone: client?.phone || "",
      email: client?.email || "",
      cpf_cnpj: client?.cpf_cnpj || "",
      whatsapp: client?.whatsapp || "",
      status: client?.status || "Ativo",
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    const { error } = await supabase.from("clients").update(editData).eq("id", id!);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente atualizado!" });
    setEditMode(false);
    queryClient.invalidateQueries({ queryKey: ["client-detail", id] });
  };

  // 2. Delete client
  const handleDelete = async () => {
    if (!confirm("Excluir este cliente e todos os dados relacionados?")) return;
    await supabase.from("contract_installments").delete().eq("client_id", id!);
    await supabase.from("contracts").delete().eq("client_id", id!);
    await supabase.from("installments").delete().eq("client_id", id!);
    await supabase.from("transactions").delete().eq("client_id", id!);
    const { error } = await supabase.from("clients").delete().eq("id", id!);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente excluído!" });
    navigate("/clientes");
  };

  // 3. Pay installment
  const handlePayInstallment = async (instId: string, amount: number) => {
    const { error } = await supabase.from("contract_installments").update({
      status: "paid", paid_at: new Date().toISOString(), paid_amount: amount,
    }).eq("id", instId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Parcela paga!" });
    queryClient.invalidateQueries({ queryKey: ["client-installments", id] });
  };

  // 4. Send billing via WhatsApp
  const handleSendBilling = (inst: any) => {
    const phone = client?.whatsapp || client?.phone;
    if (!phone) { toast({ title: "Sem telefone", description: "Cliente não possui telefone cadastrado.", variant: "destructive" }); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${client?.name}, sua parcela #${inst.installment_number} no valor de R$ ${fmt(Number(inst.amount))} venceu em ${new Date(inst.due_date).toLocaleDateString("pt-BR")}. Por favor, regularize o pagamento.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    toast({ title: "WhatsApp aberto!" });
  };

  // 5. Send all overdue billings
  const handleSendAllOverdue = () => {
    if (overdueInstallments.length === 0) { toast({ title: "Sem parcelas atrasadas" }); return; }
    const phone = client?.whatsapp || client?.phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    const cleanPhone = phone.replace(/\D/g, "");
    const total = overdueInstallments.reduce((s: number, i: any) => s + Number(i.amount), 0);
    const msg = encodeURIComponent(
      `Olá ${client?.name}, você possui ${overdueInstallments.length} parcela(s) em atraso totalizando R$ ${fmt(total)}. Entre em contato para regularizar.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
  };

  // 6. Copy client info
  const copyClientInfo = () => {
    const text = `Nome: ${client?.name}\nCPF/CNPJ: ${client?.cpf_cnpj || "—"}\nTelefone: ${client?.phone || "—"}\nEmail: ${client?.email || "—"}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Dados copiados!" });
  };

  // 7. Toggle status (Ativo/Inativo)
  const toggleStatus = async () => {
    const newStatus = client?.status === "Ativo" ? "Inativo" : "Ativo";
    await supabase.from("clients").update({ status: newStatus }).eq("id", id!);
    toast({ title: `Status: ${newStatus}` });
    queryClient.invalidateQueries({ queryKey: ["client-detail", id] });
  };

  // 8. Update credit score
  const updateCreditScore = async (delta: number) => {
    const newScore = Math.max(0, Math.min(1000, (client?.credit_score || 100) + delta));
    await supabase.from("clients").update({ credit_score: newScore }).eq("id", id!);
    toast({ title: `Score atualizado: ${newScore}` });
    queryClient.invalidateQueries({ queryKey: ["client-detail", id] });
  };

  // 9. New contract for this client
  const newContract = () => navigate("/novo-contrato", { state: { clientId: id } });

  // 10. Call client
  const callClient = () => {
    const phone = client?.phone;
    if (!phone) { toast({ title: "Sem telefone", variant: "destructive" }); return; }
    window.open(`tel:${phone.replace(/\D/g, "")}`, "_self");
  };

  // 11. Email client
  const emailClient = () => {
    if (!client?.email) { toast({ title: "Sem e-mail", variant: "destructive" }); return; }
    window.open(`mailto:${client.email}`, "_blank");
  };

  // 12. Reverse payment
  const reversePayment = async (instId: string) => {
    if (!confirm("Estornar pagamento desta parcela?")) return;
    await supabase.from("contract_installments").update({ status: "pending", paid_at: null, paid_amount: null }).eq("id", instId);
    toast({ title: "Pagamento estornado!" });
    queryClient.invalidateQueries({ queryKey: ["client-installments", id] });
  };

  // 13. Generate financial summary text
  const exportSummary = () => {
    const text = [
      `=== FICHA DO CLIENTE ===`,
      `Nome: ${client?.name}`,
      `CPF/CNPJ: ${client?.cpf_cnpj || "—"}`,
      `Telefone: ${client?.phone || "—"}`,
      `Score: ${client?.credit_score || 0}`,
      ``,
      `=== FINANCEIRO ===`,
      `Capital emprestado: R$ ${fmt(totalCapital)}`,
      `Total a receber: R$ ${fmt(totalAmount)}`,
      `Total pago: R$ ${fmt(totalPaid)}`,
      `Total em atraso: R$ ${fmt(totalOverdue)}`,
      `Contratos: ${contracts.length}`,
      `Parcelas pagas: ${paidInstallments.length}`,
      `Parcelas atrasadas: ${overdueInstallments.length}`,
      `Parcelas pendentes: ${pendingInstallments.length}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Resumo copiado!" });
  };

  // 14. View contract detail
  const viewContract = (contractId: string) => navigate(`/contratos/${contractId}`);

  const inputCls = "w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );

  if (!client) return (
    <div className="text-center py-16">
      <User size={48} className="mx-auto text-muted-foreground/20 mb-4" />
      <p className="text-muted-foreground">Cliente não encontrado</p>
    </div>
  );

  const address = client.address as any;
  const scoreColor = (client.credit_score || 0) >= 700 ? "text-success" : (client.credit_score || 0) >= 400 ? "text-warning" : "text-destructive";

  const tabs = [
    { key: "resumo", label: "Resumo", icon: Activity },
    { key: "contratos", label: "Contratos", icon: FileText },
    { key: "parcelas", label: "Parcelas", icon: Receipt },
    { key: "historico", label: "Histórico", icon: Clock },
  ] as const;

  // 17 tool buttons
  const toolButtons = [
    { icon: Edit, label: "Editar Ficha", action: startEdit, color: "text-primary" },
    { icon: Plus, label: "Novo Contrato", action: newContract, color: "text-success" },
    { icon: Send, label: "Cobrar Atrasadas", action: handleSendAllOverdue, color: "text-destructive" },
    { icon: Phone, label: "Ligar", action: callClient, color: "text-info" },
    { icon: MessageSquare, label: "WhatsApp", action: () => { const p = (client?.whatsapp || client?.phone || "").replace(/\D/g, ""); if (p) window.open(`https://wa.me/${p}`, "_blank"); }, color: "text-success" },
    { icon: Mail, label: "E-mail", action: emailClient, color: "text-info" },
    { icon: Copy, label: "Copiar Dados", action: copyClientInfo, color: "text-muted-foreground" },
    { icon: Download, label: "Exportar Resumo", action: exportSummary, color: "text-primary" },
    { icon: Star, label: "Score +50", action: () => updateCreditScore(50), color: "text-warning" },
    { icon: TrendingUp, label: "Score -50", action: () => updateCreditScore(-50), color: "text-destructive" },
    { icon: Ban, label: client?.status === "Ativo" ? "Inativar" : "Reativar", action: toggleStatus, color: client?.status === "Ativo" ? "text-warning" : "text-success" },
    { icon: Shield, label: "Portal Cliente", action: () => navigate("/portal-cliente"), color: "text-primary" },
    { icon: Eye, label: "Auditoria", action: () => navigate("/auditoria"), color: "text-muted-foreground" },
    { icon: Calendar, label: "Histórico", action: () => setActiveTab("historico"), color: "text-info" },
    { icon: Wallet, label: "Tesouraria", action: () => navigate("/carteira"), color: "text-primary" },
    { icon: Hash, label: "QR Code", action: () => navigate("/qrcode"), color: "text-success" },
    { icon: Trash2, label: "Excluir", action: handleDelete, color: "text-destructive" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in">
        <button onClick={() => navigate("/clientes")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {client.avatar_url ? <img src={client.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover" /> : client.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{client.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{client.cpf_cnpj || "Sem CPF"}</span>
                <Badge variant="outline" className={client.status === "Ativo" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                  {client.status}
                </Badge>
                <span className={`text-xs font-bold ${scoreColor}`}>Score: {client.credit_score || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
            <h2 className="text-lg font-bold text-foreground">Editar Cliente</h2>
            {[
              { key: "name", label: "Nome", type: "text" },
              { key: "phone", label: "Telefone", type: "tel" },
              { key: "email", label: "E-mail", type: "email" },
              { key: "cpf_cnpj", label: "CPF/CNPJ", type: "text" },
              { key: "whatsapp", label: "WhatsApp", type: "tel" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type} value={editData[f.key] || ""} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })} className={inputCls} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditMode(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={saveEdit} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button)" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Card */}
      <div className="bg-card border border-border rounded-xl p-4 animate-fade-in" style={{ animationDelay: "80ms" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Phone, label: "Telefone", value: client.phone },
            { icon: Mail, label: "E-mail", value: client.email },
            { icon: MessageSquare, label: "WhatsApp", value: client.whatsapp },
            { icon: MapPin, label: "Cidade", value: address?.city ? `${address.city}/${address.state}` : null },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <item.icon size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <p className="text-xs text-foreground font-medium truncate">{item.value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
        {address?.street && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <MapPin size={12} className="inline mr-1" />
            {address.street}{address.number ? `, ${address.number}` : ""} - {address.neighborhood} · {address.city}/{address.state} · CEP {address.cep}
          </p>
        )}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: "120ms" }}>
        {[
          { icon: DollarSign, label: "Capital na Rua", value: `R$ ${fmt(totalCapital)}`, color: "text-foreground", bg: "bg-primary/10" },
          { icon: CheckCircle, label: "Total Recebido", value: `R$ ${fmt(totalPaid)}`, color: "text-success", bg: "bg-success/10" },
          { icon: AlertTriangle, label: "Em Atraso", value: `R$ ${fmt(totalOverdue)}`, color: "text-destructive", bg: "bg-destructive/10" },
          { icon: TrendingUp, label: "Lucro Total", value: `R$ ${fmt(totalProfit)}`, color: "text-primary", bg: "bg-primary/10" },
        ].map((s, idx) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 card-hover" style={{ animationDelay: `${120 + idx * 60}ms` }}>
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 17 Tool Buttons */}
      <div className="animate-fade-in" style={{ animationDelay: "160ms" }}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ferramentas ({toolButtons.length})</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-2">
          {toolButtons.map((tool, idx) => (
            <button
              key={idx}
              onClick={tool.action}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-all text-center card-hover"
              title={tool.label}
            >
              <tool.icon size={18} className={tool.color} />
              <span className="text-[10px] font-medium text-muted-foreground leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 animate-fade-in" style={{ animationDelay: "200ms" }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumo */}
      {activeTab === "resumo" && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary stats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity size={16} className="text-primary" /> Visão Geral
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{contracts.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Contratos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{paidInstallments.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pagas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{overdueInstallments.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Atrasadas</p>
              </div>
            </div>
          </div>

          {/* Progress bars per contract */}
          {contracts.map((c: any) => {
            const cInst = installments.filter((i: any) => i.contract_id === c.id);
            const cPaid = cInst.filter((i: any) => i.status === "paid").length;
            const pct = Math.round((cPaid / (c.num_installments || 1)) * 100);
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => viewContract(c.id)}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">R$ {fmt(Number(c.capital))} · {c.num_installments}x</p>
                  <Badge variant="outline" className={c.status === "active" ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                    {c.status === "active" ? "Ativo" : c.status}
                  </Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{cPaid}/{c.num_installments} pagas · {pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Contratos */}
      {activeTab === "contratos" && (
        <div className="space-y-3 animate-fade-in">
          {contracts.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={32} className="mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum contrato</p>
              <button onClick={newContract} className="mt-3 text-sm text-primary hover:underline">+ Novo Contrato</button>
            </div>
          ) : contracts.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => viewContract(c.id)}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">R$ {fmt(Number(c.capital))}</p>
                  <p className="text-xs text-muted-foreground">{c.num_installments}x R$ {fmt(Number(c.installment_amount))} · {c.frequency === "monthly" ? "Mensal" : c.frequency === "weekly" ? "Semanal" : c.frequency === "daily" ? "Diário" : "Quinzenal"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{new Date(c.start_date).toLocaleDateString("pt-BR")}</p>
                  <p className="text-xs font-medium text-primary">Lucro: R$ {fmt(Number(c.total_interest))}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Parcelas */}
      {activeTab === "parcelas" && (
        <div className="space-y-2 animate-fade-in">
          {installments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma parcela</p>
          ) : installments.map((inst: any) => {
            const isOverdue = inst.status === "overdue";
            const isPaid = inst.status === "paid";
            return (
              <div key={inst.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                isOverdue ? "bg-destructive/5 border-destructive/15" : isPaid ? "bg-success/5 border-success/15" : "bg-card border-border"
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isOverdue ? "bg-destructive/10 text-destructive" : isPaid ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
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
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPaid ? (
                    <button onClick={(e) => { e.stopPropagation(); reversePayment(inst.id); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Estornar">
                      <RotateCcw size={14} />
                    </button>
                  ) : (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleSendBilling(inst); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground" title="Enviar cobrança">
                        <Send size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePayInstallment(inst.id, Number(inst.amount)); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-success/10 text-success hover:bg-success/20 transition-all"
                      >
                        Pagar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === "historico" && (
        <div className="space-y-2 animate-fade-in">
          {transactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhuma transação</p>
          ) : transactions.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}>
                {t.type === "income" ? <TrendingUp size={14} className="text-success" /> : <DollarSign size={14} className="text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString("pt-BR")}</p>
              </div>
              <p className={`text-sm font-bold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                {t.type === "income" ? "+" : "-"}R$ {fmt(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClienteDetalhe;
