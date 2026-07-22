import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bot, Zap, MessageCircle, Sparkles, Activity, BarChart3,
  CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight, Inbox, CalendarClock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

const WhatsAppConfig = lazy(() => import("./WhatsAppConfig"));
const AgenteIA = lazy(() => import("./AgenteIA"));
const Automacoes = lazy(() => import("./Automacoes"));
const BotPerformance = lazy(() => import("./BotPerformance"));
const CobrancasReguas = lazy(() => import("./CobrancasReguas"));

const VALID_TABS = ["overview", "bot", "reguas", "automacoes", "agente", "performance"] as const;
type TabKey = (typeof VALID_TABS)[number];

const Fallback = () => (
  <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
    <Loader2 className="animate-spin mr-3" size={16} /> Carregando...
  </div>
);

const HealthRow = ({
  label, ok, warn, detail,
}: { label: string; ok: boolean; warn?: boolean; detail?: string }) => (
  <div className="flex items-start justify-between gap-3 py-3 border-b border-border/40 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
    </div>
    <div className="shrink-0">
      {ok ? (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
          <CheckCircle2 size={12} /> OK
        </Badge>
      ) : warn ? (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
          <AlertTriangle size={12} /> Atenção
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
          <XCircle size={12} /> Falha
        </Badge>
      )}
    </div>
  </div>
);

const Overview = () => {
  const { user } = useAuth();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["central-bot-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("bot_enabled, bot_auto_send, whatsapp_api_url, whatsapp_instance, whatsapp_api_key, company_name, bot_tone")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: instances } = useQuery({
    queryKey: ["central-bot-instances", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, is_active, is_default")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["central-bot-stats", user?.id],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [msgs, actions] = await Promise.all([
        supabase.from("whatsapp_messages").select("id", { count: "exact", head: true })
          .eq("user_id", user!.id).gte("created_at", sinceIso),
        supabase.from("bot_actions_log").select("id, action, success", { count: "exact" })
          .eq("user_id", user!.id).gte("created_at", sinceIso).limit(200),
      ]);
      const total = actions.data?.length || 0;
      const ok = actions.data?.filter((a: any) => a.success !== false).length || 0;
      return {
        messages24h: msgs.count || 0,
        actions24h: total,
        successRate: total ? Math.round((ok / total) * 100) : 100,
      };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const hasInstance = !!(settings?.whatsapp_instance && settings?.whatsapp_api_url && settings?.whatsapp_api_key)
    || (instances && instances.some((i: any) => i.is_active));
  const botEnabled = !!settings?.bot_enabled;
  const autoSend = !!settings?.bot_auto_send;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-5 border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.messages24h ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Mensagens (24h)</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 border-border/50 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Bot size={18} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.actions24h ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Ações do bot (24h)</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Activity size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.successRate ?? 100}%</p>
              <p className="text-xs text-muted-foreground">Taxa de sucesso (24h)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Health check */}
      <Card className="p-6 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-primary" />
          <h3 className="font-bold">Diagnóstico do Bot</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="animate-spin" size={14} /> Verificando...
          </div>
        ) : (
          <div>
            <HealthRow
              label="Bot habilitado"
              ok={botEnabled}
              detail={botEnabled ? "O bot responderá mensagens recebidas via webhook." : "Ative o bot em Configurações → Comunicação para começar a atender."}
            />
            <HealthRow
              label="Instância WhatsApp conectada"
              ok={!!hasInstance}
              detail={hasInstance ? "Evolution API configurada. Pronta para enviar/receber." : "Configure ao menos uma instância na aba WhatsApp."}
            />
            <HealthRow
              label="Envio automático"
              ok={autoSend}
              warn={!autoSend && botEnabled}
              detail={autoSend ? "Respostas da IA são enviadas automaticamente ao cliente." : "Modo revisão: bot sugere, operador aprova."}
            />
            <HealthRow
              label="Identidade da empresa"
              ok={!!settings?.company_name}
              warn={!settings?.company_name}
              detail={settings?.company_name ? `Bot se identifica como “${settings.company_name}”.` : "Defina o nome da empresa em Configurações para o bot se apresentar corretamente."}
            />
            <HealthRow
              label="Régua de cobrança (cron diário)"
              ok={true}
              detail="Multa/juros diários rodam automaticamente às 03:00 UTC. Cobranças D-3, D0, D+1, D+7 no cron matinal."
            />
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link to="/comunicacao/inbox">
          <Card className="p-5 border-border/50 hover:border-primary/40 transition-colors cursor-pointer h-full">
            <Inbox size={18} className="text-primary mb-2" />
            <p className="font-semibold text-sm">Abrir Inbox WhatsApp</p>
            <p className="text-xs text-muted-foreground mt-1">Ver e responder conversas em tempo real</p>
            <div className="flex items-center gap-1 text-xs text-primary mt-3">Acessar <ArrowRight size={12} /></div>
          </Card>
        </Link>
        <Link to="/chat">
          <Card className="p-5 border-border/50 hover:border-primary/40 transition-colors cursor-pointer h-full">
            <MessageCircle size={18} className="text-primary mb-2" />
            <p className="font-semibold text-sm">Chat interno</p>
            <p className="text-xs text-muted-foreground mt-1">Fale com sua equipe</p>
            <div className="flex items-center gap-1 text-xs text-primary mt-3">Acessar <ArrowRight size={12} /></div>
          </Card>
        </Link>
        <Card className="p-5 border-border/50 bg-gradient-to-br from-primary/5 to-transparent h-full">
          <Sparkles size={18} className="text-primary mb-2" />
          <p className="font-semibold text-sm">Precisão nas cobranças</p>
          <p className="text-xs text-muted-foreground mt-1">
            O bot valida valores contra o banco (subset-sum), nunca inventa parcelas e escala pra humano quando em dúvida.
          </p>
        </Card>
      </div>
    </div>
  );
};

const CentralBot = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const initial: TabKey = raw && (VALID_TABS as readonly string[]).includes(raw) ? (raw as TabKey) : "overview";
  const [tab, setTab] = useState<TabKey>(initial);

  useEffect(() => {
    const current = params.get("tab");
    if (current !== tab) {
      const next = new URLSearchParams(params);
      next.set("tab", tab);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-hero">
        <div className="page-hero-content flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon">
              <Bot size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-shimmer">Central de Bot & Automações</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Tudo do atendimento IA, cobrança automática e integrações em um só lugar
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/comunicacao/inbox">
              <Inbox size={14} className="mr-2" /> Inbox
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-12 rounded-2xl bg-card border border-border p-1">
          <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5">
            <Activity size={14} /><span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="bot" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5">
            <MessageCircle size={14} /><span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="reguas" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5">
            <CalendarClock size={14} /><span className="hidden sm:inline">Réguas</span>
          </TabsTrigger>
          <TabsTrigger value="automacoes" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5">
            <Zap size={14} /><span className="hidden sm:inline">Automações</span>
          </TabsTrigger>
          <TabsTrigger value="agente" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5">
            <Sparkles size={14} /><span className="hidden sm:inline">Agente IA</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5">
            <BarChart3 size={14} /><span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 focus-visible:outline-none">
          <Overview />
        </TabsContent>
        <TabsContent value="bot" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}><WhatsAppConfig /></Suspense>
        </TabsContent>
        <TabsContent value="reguas" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}><CobrancasReguas /></Suspense>
        </TabsContent>
        <TabsContent value="automacoes" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}><Automacoes /></Suspense>
        </TabsContent>
        <TabsContent value="agente" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}><AgenteIA /></Suspense>
        </TabsContent>
        <TabsContent value="performance" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}><BotPerformance /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CentralBot;
