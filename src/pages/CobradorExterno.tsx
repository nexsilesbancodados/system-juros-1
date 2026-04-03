import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock, Users, DollarSign, Phone, Mail, MapPin, Calendar,
  AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp,
  LogOut, User, FileText, TrendingUp, Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CobradorExterno = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [collectorData, setCollectorData] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [collectorId, setCollectorId] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab] = useState<"pendentes" | "atrasadas" | "pagas">("pendentes");

  const { data: assignments = [] } = useQuery({
    queryKey: ["ext-assignments", collectorId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collector_assignments")
        .select("*, clients(id, name, phone, whatsapp, cpf_cnpj, email, status, address)")
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
        .select("*, contracts(capital, interest_rate, frequency, num_installments)")
        .in("client_id", clientIds)
        .order("due_date");
      return data || [];
    },
    enabled: assignments.length > 0,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ["ext-owner-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, pix_key, pix_key_type, billing_message")
        .eq("id", userId!)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: tokenData } = await supabase
      .from("collector_tokens")
      .select("*, collectors(id, name, phone, email, city, state, created_at, is_active)")
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
      toast({ title: "✓ Pagamento registrado!" });
      queryClient.invalidateQueries({ queryKey: ["ext-installments"] });
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const now = new Date();
  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all";

  if (!collectorData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <form onSubmit={handleAccess} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield size={28} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Portal do Cobrador</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse com seu token de acesso</p>
          </div>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Insira seu token" required className={inputCls} />
          <button type="submit" disabled={loading}
            className="action-btn-primary w-full">
            {loading ? "Verificando..." : "Acessar Portal"}
          </button>
        </form>
      </div>
    );
  }

  const allPending = installments.filter((i: any) => i.status === "pending");
  const allOverdue = allPending.filter((i: any) => new Date(i.due_date) < now);
  const allPaid = installments.filter((i: any) => i.status === "paid");
  const totalPending = allPending.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalOverdue = allOverdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalPaid = allPaid.reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-md px-4 md:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary border border-primary/10">
              {collectorData.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{collectorData.name}</p>
              <p className="text-[11px] text-muted-foreground">{collectorData.city}/{collectorData.state}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowProfile(!showProfile)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
              <User size={18} />
            </button>
            <button onClick={() => { setCollectorData(null); setCollectorId(null); setUserId(null); }}
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Profile Card */}
        {showProfile && (
          <div className="rounded-2xl border border-primary/20 bg-card p-6 space-y-4 animate-fade-in shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl font-bold text-primary border border-primary/10">
                {collectorData.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{collectorData.name}</h2>
                <Badge variant="outline" className={`text-xs mt-1 ${collectorData.is_active !== false ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                  {collectorData.is_active !== false ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-accent/20 border border-border/50">
                <Phone size={14} className="text-primary" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Telefone</p>
                  <p className="text-sm font-medium text-foreground">{collectorData.phone}</p>
                </div>
              </div>
              {collectorData.email && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-accent/20 border border-border/50">
                  <Mail size={14} className="text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">E-mail</p>
                    <p className="text-sm font-medium text-foreground truncate">{collectorData.email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-accent/20 border border-border/50">
                <MapPin size={14} className="text-primary" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Localização</p>
                  <p className="text-sm font-medium text-foreground">{collectorData.city}/{collectorData.state}</p>
                </div>
              </div>
            </div>
            {ownerProfile?.pix_key && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Chave PIX para Pagamentos</p>
                <p className="text-sm font-medium text-primary">{ownerProfile.pix_key}</p>
                <p className="text-[10px] text-muted-foreground">Tipo: {ownerProfile.pix_key_type || "—"}</p>
              </div>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-primary" />
              <p className="text-[10px] text-muted-foreground uppercase">Clientes</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{assignments.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-amber-500/30 transition-colors"
            onClick={() => setTab("pendentes")}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-amber-500" />
              <p className="text-[10px] text-muted-foreground uppercase">Pendentes</p>
            </div>
            <p className="text-2xl font-bold text-amber-500">{allPending.length}</p>
            <p className="text-[10px] text-muted-foreground">R$ {fmt(totalPending)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-destructive/30 transition-colors"
            onClick={() => setTab("atrasadas")}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-destructive" />
              <p className="text-[10px] text-muted-foreground uppercase">Atrasadas</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{allOverdue.length}</p>
            <p className="text-[10px] text-muted-foreground">R$ {fmt(totalOverdue)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-success/30 transition-colors"
            onClick={() => setTab("pagas")}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={14} className="text-success" />
              <p className="text-[10px] text-muted-foreground uppercase">Recebidas</p>
            </div>
            <p className="text-2xl font-bold text-success">{allPaid.length}</p>
            <p className="text-[10px] text-muted-foreground">R$ {fmt(totalPaid)}</p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center gap-2 border-b border-border pb-1">
          {[
            { key: "pendentes" as const, label: "Pendentes", count: allPending.length, color: "text-amber-500" },
            { key: "atrasadas" as const, label: "Atrasadas", count: allOverdue.length, color: "text-destructive" },
            { key: "pagas" as const, label: "Recebidas", count: allPaid.length, color: "text-success" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-card border border-b-0 border-border text-foreground -mb-[1px]"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
              <span className={`text-xs font-bold ${tab === t.key ? t.color : ""}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Client list */}
        {assignments.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-card/50">
            <Users size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-semibold">Nenhum cliente atribuído</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde o administrador atribuir clientes a você.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a: any) => {
              const clientAll = installments.filter((i: any) => i.client_id === a.client_id);
              let clientFiltered: any[] = [];
              if (tab === "pendentes") {
                clientFiltered = clientAll.filter((i: any) => i.status === "pending");
              } else if (tab === "atrasadas") {
                clientFiltered = clientAll.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now);
              } else {
                clientFiltered = clientAll.filter((i: any) => i.status === "paid");
              }

              if (clientFiltered.length === 0) return null;

              const isExpanded = expandedClient === a.client_id;
              const clientTotalPending = clientAll.filter((i: any) => i.status === "pending");
              const clientTotalOverdue = clientTotalPending.filter((i: any) => new Date(i.due_date) < now);
              const clientPendingAmount = clientTotalPending.reduce((s: number, i: any) => s + Number(i.amount), 0);

              return (
                <div key={a.id} className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:shadow-md">
                  {/* Client Header */}
                  <button
                    onClick={() => setExpandedClient(isExpanded ? null : a.client_id)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/20 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary border border-primary/10 shrink-0">
                      {a.clients?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{a.clients?.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone size={10} /> {a.clients?.phone || a.clients?.whatsapp || "—"}
                        </span>
                        {a.clients?.cpf_cnpj && (
                          <span className="text-[11px] text-muted-foreground">· {a.clients.cpf_cnpj}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <p className="text-sm font-bold text-foreground">R$ {fmt(clientPendingAmount)}</p>
                      <div className="flex items-center gap-1.5">
                        {clientTotalOverdue.length > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                            {clientTotalOverdue.length} atrasada(s)
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{clientFiltered.length} itens</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                  </button>

                  {/* Expanded: Client details + installments */}
                  {isExpanded && (
                    <div className="animate-fade-in">
                      {/* Client contact info */}
                      <div className="px-5 py-3 border-t border-border/50 bg-accent/10 flex flex-wrap gap-4">
                        {a.clients?.phone && (
                          <a href={`tel:${a.clients.phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Phone size={12} /> {a.clients.phone}
                          </a>
                        )}
                        {a.clients?.whatsapp && (
                          <a href={`https://wa.me/55${a.clients.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-success hover:underline">
                            <Phone size={12} /> WhatsApp
                          </a>
                        )}
                        {a.clients?.email && (
                          <a href={`mailto:${a.clients.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:underline">
                            <Mail size={12} /> {a.clients.email}
                          </a>
                        )}
                      </div>

                      {/* Installments */}
                      <div className="divide-y divide-border/30">
                        {clientFiltered.map((inst: any) => {
                          const isOverdue = inst.status === "pending" && new Date(inst.due_date) < now;
                          const daysLate = isOverdue ? Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / 86400000) : 0;
                          const isPaid = inst.status === "paid";

                          return (
                            <div key={inst.id} className={`flex items-center gap-3 px-5 py-3 ${isOverdue ? "bg-destructive/5" : ""}`}>
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isPaid
                                  ? "bg-success/10 text-success"
                                  : isOverdue
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-amber-500/10 text-amber-500"
                              }`}>
                                {inst.installment_number}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    R$ {fmt(Number(isPaid ? (inst.paid_amount || inst.amount) : inst.amount))}
                                  </p>
                                  {inst.contracts?.frequency && (
                                    <span className="text-[10px] text-muted-foreground bg-accent/30 px-1.5 py-0.5 rounded">
                                      {inst.contracts.frequency === "monthly" ? "Mensal" :
                                       inst.contracts.frequency === "weekly" ? "Semanal" :
                                       inst.contracts.frequency === "biweekly" ? "Quinzenal" : inst.contracts.frequency}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Calendar size={10} />
                                  {isPaid ? "Pago em " : "Vence: "}
                                  {new Date(isPaid ? inst.paid_at : inst.due_date).toLocaleDateString("pt-BR")}
                                  {isOverdue && (
                                    <span className="text-destructive font-medium ml-1">
                                      · {daysLate} dia(s) de atraso
                                    </span>
                                  )}
                                </p>
                                {inst.contracts?.capital && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Capital: R$ {fmt(Number(inst.contracts.capital))} · {inst.contracts.num_installments}x
                                  </p>
                                )}
                              </div>
                              {!isPaid && (
                                <button
                                  onClick={() => handleRegisterPayment(inst.id, Number(inst.amount))}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-success/10 text-success hover:bg-success/20 transition-all shrink-0"
                                >
                                  <DollarSign size={12} /> Pagar
                                </button>
                              )}
                              {isPaid && (
                                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 shrink-0">
                                  <CheckCircle size={10} className="mr-1" /> Pago
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* No results for current tab */}
            {assignments.every((a: any) => {
              const clientAll = installments.filter((i: any) => i.client_id === a.client_id);
              let filtered: any[];
              if (tab === "pendentes") filtered = clientAll.filter((i: any) => i.status === "pending");
              else if (tab === "atrasadas") filtered = clientAll.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now);
              else filtered = clientAll.filter((i: any) => i.status === "paid");
              return filtered.length === 0;
            }) && (
              <div className="text-center py-12 text-muted-foreground">
                {tab === "pendentes" && "Nenhuma cobrança pendente 🎉"}
                {tab === "atrasadas" && "Nenhuma cobrança atrasada 🎉"}
                {tab === "pagas" && "Nenhum pagamento registrado ainda"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CobradorExterno;
