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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
      setPortalSettings(settingsRes.data);
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
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
        {/* Background Image/Video with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80" 
            alt="Atendimento humanizado" 
            className="w-full h-full object-cover opacity-60 scale-105 animate-pulse-slow"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/70 to-primary/30 backdrop-blur-[2px]" />
        </div>

        {/* Animated Background Blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-40 z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/30 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="w-full max-w-sm animate-fade-in relative z-20 px-4">
          <form onSubmit={handleAccess} className="space-y-6 rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-2xl p-8 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            <div className="text-center">
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/5 border border-white/10 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20">
                <Shield size={32} className="text-primary" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-success/20 border-4 border-[#121212] flex items-center justify-center">
                  <Lock size={12} className="text-success" />
                </div>
              </div>
              <h1 className="text-3xl font-display font-bold text-white tracking-tight">Portal do Cliente</h1>
              <p className="text-sm text-slate-400 mt-2 px-4">Acesse seus contratos e realize pagamentos de forma segura</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                  Identificação (CPF/CNPJ)
                </label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-center text-xl tracking-widest font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-slate-600"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-center text-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all [color-scheme:dark]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-7 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-transform bg-primary hover:bg-primary/90 text-white border-none"
              >
                {loading ? <Clock className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                {loading ? "Verificando..." : "Entrar no Portal"}
              </Button>
            </div>
            <p className="text-[10px] text-center text-slate-500 leading-relaxed font-medium">
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
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50 px-4 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {portalSettings?.company_logo_url || portalSettings?.portal_logo_url ? (
                <img 
                  src={portalSettings?.portal_logo_url || portalSettings?.company_logo_url} 
                  alt="Logo" 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-contain bg-white p-1 border border-border/50 shadow-md transition-transform hover:scale-105"
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-foreground border border-primary/10 flex items-center justify-center shadow-lg shadow-primary/20 transition-transform hover:scale-105">
                  <User size={22} className="text-white" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-white dark:border-slate-900" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-foreground leading-none flex items-center gap-2">
                {clientData.name}
                <Badge variant="secondary" className="text-[8px] h-4 py-0 uppercase font-bold tracking-tighter">Premium</Badge>
              </h2>
              <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-70">{clientData.cpf_cnpj}</p>
            </div>
            <div className="sm:hidden">
              <p className="text-xs font-bold text-foreground truncate max-w-[100px]">{clientData.name.split(" ")[0]}</p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden md:flex items-center gap-2 mr-4 px-3 py-1.5 rounded-xl bg-success/5 border border-success/10">
              <Shield size={12} className="text-success" />
              <span className="text-[10px] font-bold text-success uppercase tracking-wider">Conexão Segura</span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl bg-card border border-border sm:hidden h-9 w-9">
              <Settings size={16} className="text-muted-foreground" />
            </Button>
            <Button variant="ghost" className="rounded-xl h-9 sm:h-10 px-2 sm:px-4 gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" onClick={handleLogout}>
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
              <Card className={`overflow-hidden border-none shadow-2xl relative group ${nextDue.status === 'overdue' ? 'bg-destructive/5' : 'bg-primary/5'}`}>
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-1 h-full ${nextDue.status === 'overdue' ? 'bg-destructive' : 'bg-primary'}`} />
                
                <CardContent className="p-0">
                  <div className={`p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-border/10 ${nextDue.status === 'overdue' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                         <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${nextDue.status === 'overdue' ? 'bg-destructive text-white animate-pulse' : 'bg-primary text-white'}`}>
                           {nextDue.status === 'overdue' ? '🔴 Em Atraso' : '🔵 Próxima Fatura'}
                         </div>
                         {nextDue.status === 'overdue' && (
                           <span className="text-[10px] font-bold text-destructive flex items-center gap-1">
                             <AlertTriangle size={10} /> {nextDue.daysLate} dias
                           </span>
                         )}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Valor Total da Parcela</p>
                        <h3 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                          <span className="text-xl sm:text-2xl font-medium opacity-50 mr-1">R$</span>
                          {fmt(Number(nextDue.amount))}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                         <span className="flex items-center gap-1.5 font-medium"><Calendar size={14} className="text-primary"/> Vence {new Date(nextDue.due_date).toLocaleDateString("pt-BR", {day:'2-digit', month:'long'})}</span>
                         <span className="flex items-center gap-1.5 font-medium"><CreditCard size={14} className="text-primary"/> Parcela {nextDue.installment_number} de {installments.length}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <Button 
                        className="rounded-2xl py-8 px-10 text-lg font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all bg-primary hover:bg-primary/90 text-white group" 
                        onClick={() => { setSelectedInstallment(nextDue); setIsPaymentModalOpen(true); }}
                      >
                        Pagar Agora
                        <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground font-medium italic">Pague via PIX para liberação instantânea</p>
                    </div>
                  </div>
                  
                  {nextDue.status === 'overdue' && (
                    <div className="px-6 py-3 bg-destructive/20 border-t border-destructive/10 flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-destructive animate-ping" />
                       <p className="text-[11px] font-bold text-destructive uppercase tracking-tight">
                         Atenção: Evite o bloqueio de novos créditos regularizando hoje mesmo.
                       </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Grid de Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Valor do Empréstimo" value={`R$ ${fmt(totalAmount)}`} icon={FileText} color="text-primary" bg="bg-primary/10" />
              <StatCard title="Valor Pago" value={`R$ ${fmt(totalPaid)}`} icon={TrendingUp} color="text-success" bg="bg-success/10" />
              <StatCard title="O que falta pagar" value={`R$ ${fmt(totalAmount - totalPaid)}`} icon={TrendingDown} color="text-destructive" bg="bg-destructive/10" />
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
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ArrowRight size={16} className="text-primary" /> Ações Rápidas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <QuickActionButton 
                  icon={MessageSquare} 
                  label="Iniciar Negociação" 
                  desc="Fale com nosso robô" 
                  onClick={() => setActiveTab('negociar')} 
                />
                <QuickActionButton 
                  icon={Download} 
                  label="Baixar Contratos" 
                  desc="Documentos assinados" 
                  onClick={() => toast({ title: "Preparando documentos", description: "Seus contratos estão sendo gerados e o download iniciará em instantes." })}
                />
                <QuickActionButton 
                  icon={Phone} 
                  label="Suporte via WhatsApp" 
                  desc="Falar com um consultor" 
                  onClick={() => {
                    const phone = ownerProfile?.phone || "";
                    if (phone) window.open(`https://wa.me/55${phone.replace(/\D/g, "")}`, "_blank");
                    else toast({ title: "Suporte indisponível", description: "O consultor não cadastrou um telefone de contato." });
                  }}
                />
                <QuickActionButton 
                  icon={HelpCircle} 
                  label="Central de Ajuda" 
                  desc="Dúvidas comuns" 
                  onClick={() => {
                    const faqSection = document.getElementById('faq-section');
                    faqSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              </div>
            </div>

            {/* FAQ Section */}
            <div className="pt-4">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <HelpCircle size={16} className="text-primary" /> Dúvidas Frequentes
              </h3>
              <Card className="border-border/50 shadow-sm overflow-hidden bg-card">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1" className="border-border/50 px-4">
                    <AccordionTrigger className="text-sm font-bold hover:no-underline py-4">Como funcionam os juros?</AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                      Os juros são calculados diariamente sobre o saldo devedor. Ao antecipar parcelas, você recebe um desconto proporcional nos juros aplicados.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2" className="border-border/50 px-4">
                    <AccordionTrigger className="text-sm font-bold hover:no-underline py-4">Posso alterar a data de vencimento?</AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                      Sim, é possível solicitar a alteração da data de vencimento uma vez a cada 6 meses, desde que não haja parcelas em atraso no momento da solicitação.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3" className="border-border/50 px-4">
                    <AccordionTrigger className="text-sm font-bold hover:no-underline py-4">Como gerar a segunda via?</AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                      Basta clicar na aba "Parcelas", selecionar a parcela desejada e clicar em "Pagar Agora". Você terá acesso ao código PIX ou boleto atualizado.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
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
                          inst.status === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
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

      {/* Security Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4 border-t border-border/10 mt-8 mb-20 sm:mb-8">
        <div className="flex items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all">
          <Shield size={24} />
          <Lock size={24} />
          <CreditCard size={24} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Ambiente 100% Seguro</p>
          <p className="text-[9px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Seus dados estão protegidos por criptografia de nível bancário. Todas as transações são processadas com segurança.
          </p>
        </div>
      </footer>

      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onOpenChange={setIsPaymentModalOpen} 
        installment={selectedInstallment}
        ownerProfile={ownerProfile}
        clientData={clientData}
      />

      {/* Footer Mobile Nav */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-t border-border/60 p-2 sm:hidden safe-area-bottom shadow-[0_-8px_20px_rgba(0,0,0,0.1)]">
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