import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Brain, AlertTriangle, Lightbulb } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fallbackInsights = {
  predictive_cashflow: [
    { month: "Atual", expected: 0, likely: 0 },
    { month: "+1 mês", expected: 0, likely: 0 },
    { month: "+2 meses", expected: 0, likely: 0 },
    { month: "+3 meses", expected: 0, likely: 0 },
  ],
  risk_assessment: "Indisponível",
  risk_reason: "A análise de IA não respondeu agora. Os demais indicadores da página continuam disponíveis.",
  strategic_advice: [
    "Tente gerar a análise novamente em alguns instantes.",
    "Use os gráficos operacionais abaixo para acompanhar atrasos e recebimentos.",
    "Confira se a sessão está ativa antes de chamar recursos de IA.",
  ],
  top_client_segments: ["Sem dados da IA"],
};

export const PredictiveAnalytics = () => {
  const { user } = useAuth();

  const { data: aiInsights, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["business-intelligence-ai", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase.functions.invoke("business-intelligence-ai", {
        body: { user_id: user.id },
      });
      if (error) throw new Error(error.message || "Falha ao carregar análise preditiva");
      return data || fallbackInsights;
    },
    enabled: !!user,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[150px] rounded-2xl" />
          <Skeleton className="h-[150px] rounded-2xl" />
          <Skeleton className="h-[150px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const insights = aiInsights || fallbackInsights;

  if (isError) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-destructive/30 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Inteligência Preditiva indisponível</h2>
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message || "Não foi possível carregar a análise de IA agora."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="text-primary w-5 h-5" />
        <h2 className="text-lg font-bold">Inteligência Preditiva (IA)</h2>
        <Badge variant="outline" className="ml-2 bg-primary/5 text-primary border-primary/20">Alpha</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fluxo de Caixa Preditivo */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Projeção de Recebimento vs. Realidade</h3>
              <p className="text-xs text-muted-foreground">Baseado em padrões históricos de atraso</p>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Esperado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span>Provável (Ajustado pela IA)</span>
              </div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={insights.predictive_cashflow}>
              <defs>
                <linearGradient id="colorEsperado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProvavel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
              />
              <Area type="monotone" dataKey="expected" name="Esperado" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorEsperado)" strokeWidth={2} />
              <Area type="monotone" dataKey="likely" name="Provável" stroke="#fb923c" fillOpacity={1} fill="url(#colorProvavel)" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status de Risco Global */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold mb-1">Risco Geral da Carteira</h3>
            <p className="text-xs text-muted-foreground mb-6">Classificação algorítmica</p>
            
            <div className="flex flex-col items-center justify-center py-4">
              <div className={`text-3xl font-bold mb-2 ${
                insights.risk_assessment?.toLowerCase().includes('baixo') || insights.risk_assessment?.toLowerCase().includes('low') ? 'text-success' :
                insights.risk_assessment?.toLowerCase().includes('médio') || insights.risk_assessment?.toLowerCase().includes('medio') || insights.risk_assessment?.toLowerCase().includes('medium') ? 'text-warning' :
                'text-destructive'
              }`}>
                {insights.risk_assessment}
              </div>
              <p className="text-center text-xs text-muted-foreground px-4">
                {insights.risk_reason || "O risco é calculado com base na concentração de contratos, taxa de renegociação e histórico de atrasos."}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Segmentos Críticos</h4>
            <div className="flex flex-wrap gap-2">
              {insights.top_client_segments?.map((s: string) => (
                <Badge key={s} variant="secondary" className="text-[9px] py-0 px-2">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Insights e Recomendações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.strategic_advice?.map((advice: string, i: number) => (
          <div key={i} className="glass-card rounded-2xl p-5 border-l-4 border-primary/40 relative overflow-hidden group">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Lightbulb className="w-8 h-8" />
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{i + 1}</span>
              </div>
              <p className="text-xs font-medium text-foreground leading-relaxed">
                {advice}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
