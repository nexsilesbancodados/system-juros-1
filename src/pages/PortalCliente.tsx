import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, FileText, LogOut, User, Calendar, AlertTriangle, CheckCircle,
  DollarSign, CreditCard, ChevronDown, ChevronUp, Clock, Shield,
  TrendingDown, TrendingUp, Receipt, Eye, EyeOff, Wallet, Phone,
  BarChart3, ArrowRight, Info, MessageSquare, Headphones, Settings,
  MapPin, HelpCircle, Download, Share2, Bot
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NegotiationTab } from "@/components/ClientPortal/NegotiationTab";
import { PaymentModal } from "@/components/ClientPortal/PaymentModal";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [portalSettings, setPortalSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

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
    
    if (!birthDate) {
      toast({ title: "Data de nascimento", description: "Informe sua data de nascimento para acessar.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data: clients, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("cpf_cnpj", cleanCpf)
        .eq("birth_date", birthDate);

      if (clientError || !clients || clients.length === 0) {
        toast({ 
          title: "Acesso negado", 
          description: "CPF ou data de nascimento não conferem.", 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      const client = clients[0];

      const [contractsRes, instsRes, profileRes, settingsRes] = await Promise.all([
        supabase.from("contracts").select("*").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("contract_installments").select("*").eq("client_id", client.id).order("due_date"),
        supabase.from("profiles").select("*").eq("id", client.user_id).single(),
        supabase.from("settings").select("*").eq("user_id", client.user_id).single(),
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
      toast({ title: `Bem-vindo(a), ${client.name.split(" ")[0]}!` });
    } catch (err) {
      toast({ title: "Erro no acesso", description: "Tente novamente mais tarde.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setClientData(null);
    setInstallments([]);
    setContracts([]);
    setCpf("");
    setBirthDate("");
    setOwnerProfile(null);
    setActiveTab("resumo");
  };

  // Computed values
  const now = new Date();
  const pending = installments.filter((i: any) => i.status === "pending");
  const overdue = installments.filter((i: any) => i.status === "overdue");
  const paid = installments.filter((i: any) => i.status === "paid");
  const totalPending = [...pending, ...overdue].reduce((a: number, i: any) => a + Number(i.amount), 0);
  const totalPaid = paid.reduce((a: number, i: any) => a + Number(i.paid_amount || i.amount), 0);
  const totalAmount = contracts.reduce((s: number, c: any) => s + Number(c.total_amount || 0), 0);
  const progressTotal = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

  const nextDue = useMemo(() => {
    const upcoming = [...pending, ...overdue].sort((a: any, b: any) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    return upcoming[0] || null;
  }, [pending, overdue]);

  // Render Login
  if (!clientData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[140px]" />
        </div>
        <div className="w-full max-w-sm animate-fade-in relative">
          <form onSubmit={handleAccess} className="space-y-6 rounded-[2.5rem] border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
                <Shield size={32} className="text-primary" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-success/20 border-4 border-card flex items-center justify-center">
                  <Lock size={12} className="text-success" />
                </div>
              </div>
              <h1 className="text-3xl font-display font-bold text-shimmer tracking-tight">Portal do Cliente</h1>
              <p className="text-sm text-muted-foreground mt-2 px-4">Acesse seus contratos e realize pagamentos de forma segura</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">
                  Identificação (CPF/CNPJ)
                </label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="w-full px-4 py-4 rounded-2xl bg-accent/30 border border-border text-center text-xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/30"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full px-4 py-4 rounded-2xl bg-accent/30 border border-border text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-7 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-transform"
              >
                {loading ? <Clock className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                {loading ? "Verificando..." : "Entrar no Portal"}
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground/60 leading-relaxed font-medium">
              Protegido por criptografia de ponta a ponta
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-accent/20 pb-24 lg:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-foreground border border-primary/10 flex items-center justify-center shadow-lg shadow-primary/20">
              <User size={24} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-foreground leading-none">{clientData.name}</h2>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">{clientData.cpf_cnpj}</p>
            </div>
            <div className="sm:hidden">
              <p className="text-xs font-bold text-foreground truncate max-w-[120px]">{clientData.name.split(" ")[0]}</p>
              <Badge variant="outline" className="text-[8px] h-4 py-0 border-primary/20 text-primary">Cliente VIP</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl bg-card border border-border sm:hidden">
              <Settings size={18} className="text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="rounded-xl gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={handleLogout}>
              <LogOut size={16} />
              <span className="hidden sm:inline text-xs font-bold">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 sm:w-[400px] h-14 p-1 rounded-2xl bg-card border border-border/50 mb-6 shadow-sm">
            <TabsTrigger value="resumo" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold transition-all gap-2">
              <BarChart3 size={14} /> Resumo
            </TabsTrigger>
            <TabsTrigger value="parcelas" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold transition-all gap-2">
              <Receipt size={14} /> Parcelas
            </TabsTrigger>
            <TabsTrigger value="negociar" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold transition-all gap-2 relative">
              <MessageSquare size={14} /> Negociar
              {overdue.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-white" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Hero - Próxima Parcela */}
            {nextDue && (
              <Card className={`overflow-hidden border-none shadow-xl ${nextDue.status === 'overdue' ? 'bg-destructive/5' : 'bg-primary/5'}`}>
                <CardContent className="p-0">
                  <div className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-border/10 ${nextDue.status === 'overdue' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                    <div className="space-y-1">
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${nextDue.status === 'overdue' ? 'text-destructive' : 'text-primary'}`}>
                        {nextDue.status === 'overdue' ? '🔴 Parcela em Atraso' : '🔵 Próximo Vencimento'}
                      </p>
                      <h3 className="text-4xl font-bold tracking-tight">R$ {fmt(Number(nextDue.amount))}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                         <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(nextDue.due_date).toLocaleDateString("pt-BR", {day:'2-digit', month:'long'})}</span>
                         <span>• Parcela #{nextDue.installment_number}</span>
                      </div>
                    </div>
                    <Button 
                      className="rounded-2xl py-7 px-8 text-md font-bold shadow-lg active:scale-95 transition-transform" 
                      onClick={() => { setSelectedInstallment(nextDue); setIsPaymentModalOpen(true); }}
                    >
                      Pagar Agora
                    </Button>
                  </div>
                  {nextDue.status === 'overdue' && (
                    <div className="p-4 bg-destructive text-white text-[10px] font-bold uppercase tracking-widest text-center animate-pulse">
                       Atenção: Parcela com {nextDue.daysLate} dias de atraso. Regularize para evitar juros.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Grid de Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Saldo Devedor" value={`R$ ${fmt(totalPending)}`} icon={TrendingDown} color="text-destructive" bg="bg-destructive/10" />
              <StatCard title="Total Pago" value={`R$ ${fmt(totalPaid)}`} icon={TrendingUp} color="text-success" bg="bg-success/10" />
              <StatCard title="Contratos" value={contracts.length} icon={FileText} color="text-primary" bg="bg-primary/10" />
              <StatCard title="Progresso" value={`${progressTotal}%`} icon={BarChart3} color="text-info" bg="bg-info/10" progress={progressTotal} />
            </div>

            {/* Mensagem do Credor */}
            {ownerProfile?.billing_message && (
              <Card className="bg-card border-border/50 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <Info size={14} className="text-primary" /> Recado do seu Credor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground italic leading-relaxed">
                    "{ownerProfile.billing_message.replace('[Nome do Cliente]', clientData.name.split(' ')[0])}"
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Atalhos Rápidos */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Ações Rápidas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <QuickActionButton icon={MessageSquare} label="Iniciar Negociação" desc="Fale com nosso robô" onClick={() => setActiveTab('negociar')} />
                <QuickActionButton icon={Download} label="Baixar Contratos" desc="Documentos assinados" />
                <QuickActionButton icon={Headphones} label="Suporte Técnico" desc="Falar com humano" />
                <QuickActionButton icon={MapPin} label="Endereço da Empresa" desc="Ver localização" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parcelas" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-none shadow-xl overflow-hidden bg-card">
              <div className="divide-y divide-border">
                {installments.length > 0 ? (
                  installments.map((inst) => (
                    <div 
                      key={inst.id} 
                      className={`p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer ${inst.status === 'overdue' ? 'bg-destructive/[0.02]' : ''}`}
                      onClick={() => { setSelectedInstallment(inst); setIsPaymentModalOpen(true); }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                          inst.status === 'paid' ? 'bg-success/10 text-success' : 
                          inst.status === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                        }`}>
                          {inst.installment_number}
                        </div>
                        <div>
                          <p className="text-sm font-bold">R$ {fmt(Number(inst.status === 'paid' ? (inst.paid_amount || inst.amount) : inst.amount))}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {inst.status === 'paid' ? `Pago em ${new Date(inst.paid_at).toLocaleDateString("pt-BR")}` : `Vence em ${new Date(inst.due_date).toLocaleDateString("pt-BR")}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`rounded-lg py-1 px-3 text-[9px] font-bold ${
                        inst.status === 'paid' ? 'bg-success/10 text-success border-success/20' :
                        inst.status === 'overdue' ? 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}>
                        {inst.status === 'paid' ? 'LIQUIDADO' : inst.status === 'overdue' ? 'EM ATRASO' : 'PENDENTE'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <CheckCircle size={48} className="mx-auto text-success/20 mb-4" />
                    <p className="text-sm font-bold">Tudo em dia!</p>
                    <p className="text-xs text-muted-foreground mt-1">Você não possui parcelas pendentes no momento.</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="negociar" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-none shadow-xl bg-card overflow-hidden">
              <CardHeader className="bg-primary p-6 text-white">
                <CardTitle className="text-lg flex items-center gap-2"><Bot size={22}/> Central de Negociação</CardTitle>
                <CardDescription className="text-white/80 text-xs">
                  Proponha acordos, tire dúvidas sobre valores e regularize suas parcelas em atraso de forma automatizada.
                </CardDescription>
              </CardHeader>
              <NegotiationTab clientId={clientData.id} cpf={clientData.cpf_cnpj} />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onOpenChange={setIsPaymentModalOpen} 
        installment={selectedInstallment}
        ownerProfile={ownerProfile}
        clientData={clientData}
      />

      {/* Footer Mobile Nav */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/60 p-2 sm:hidden safe-area-bottom">
        <div className="grid grid-cols-3 gap-2">
           <MobileNavItem active={activeTab === 'resumo'} icon={BarChart3} label="Início" onClick={() => setActiveTab('resumo')} />
           <MobileNavItem active={activeTab === 'parcelas'} icon={Receipt} label="Faturas" onClick={() => setActiveTab('parcelas')} />
           <MobileNavItem active={activeTab === 'negociar'} icon={MessageSquare} label="Negociar" onClick={() => setActiveTab('negociar')} />
        </div>
      </footer>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg, progress }: any) => (
  <Card className="border-border/40 shadow-sm overflow-hidden group">
    <CardContent className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-xl ${bg} ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon size={16} />
        </div>
        {progress !== undefined && <span className="text-[10px] font-bold text-muted-foreground">{progress}%</span>}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{title}</p>
        <p className={`text-lg font-bold tracking-tight ${color}`}>{value}</p>
      </div>
      {progress !== undefined && (
        <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
          <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      )}
    </CardContent>
  </Card>
);

const QuickActionButton = ({ icon: Icon, label, desc, onClick }: any) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left active:scale-95 group shadow-sm"
  >
    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors">
      <Icon size={22} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-foreground leading-tight">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </button>
);

const MobileNavItem = ({ active, icon: Icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
  >
    <Icon size={20} />
    <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

export default PortalCliente;