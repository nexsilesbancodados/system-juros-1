import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageCircle, Bot } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const WhatsAppConfig = lazy(() => import("./WhatsAppConfig"));
const AgenteIA = lazy(() => import("./AgenteIA"));

const VALID_TABS = ["whatsapp", "agente"] as const;
type TabKey = (typeof VALID_TABS)[number];

const Fallback = () => (
  <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
    <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin mr-3" />
    Carregando...
  </div>
);

const Comunicacao = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | "automacoes" | null;
  const initial: TabKey =
    raw && (VALID_TABS as readonly string[]).includes(raw) ? (raw as TabKey) : "whatsapp";
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
        <div className="page-hero-content flex items-center gap-3">
          <div className="page-hero-icon">
            <MessageCircle size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-shimmer">Comunicação & IA</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              WhatsApp e Agente IA em um só lugar
            </p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-card border border-border p-1">
          <TabsTrigger
            value="whatsapp"
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-2"
          >
            <MessageCircle size={15} />
            <span>WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger
            value="agente"
            className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-2"
          >
            <Bot size={15} />
            <span>Agente IA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}>
            <WhatsAppConfig />
          </Suspense>
        </TabsContent>
        <TabsContent value="agente" className="mt-5 focus-visible:outline-none">
          <Suspense fallback={<Fallback />}>
            <AgenteIA />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Comunicacao;
