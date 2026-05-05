import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, TrendingUp, Shield, Scale, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Scenario = { name: string; taxa: number; parcelas: number; reason: string };
type Analysis = {
  risk_level: "baixo" | "moderado" | "alto";
  risk_reason: string;
  summary: string;
  recommendations: string[];
  scenarios: Scenario[];
};

type Props = {
  payload: Record<string, any> | null;
  onApplyScenario: (s: Scenario) => void;
};

const RISK_STYLE = {
  baixo: { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: Shield },
  moderado: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: Scale },
  alto: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", icon: AlertTriangle },
};

const SCENARIO_ICON: Record<string, any> = {
  Conservador: Shield,
  Equilibrado: Scale,
  Lucrativo: TrendingUp,
};

export default function AISimulatorInsights({ payload, onApplyScenario }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const run = async () => {
    if (!payload) {
      toast.error("Preencha os valores antes de pedir análise da IA");
      return;
    }
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("simulator-ai", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis(data as Analysis);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível obter a análise");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden card-shine animate-fade-in">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Análise Inteligente</h2>
        </div>
        <button
          onClick={run}
          disabled={loading || !payload}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-foreground micro-press disabled:opacity-50"
          style={{ background: "var(--gradient-button)" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {loading ? "Analisando..." : analysis ? "Reanalisar" : "Analisar com IA"}
        </button>
      </div>

      {!analysis && !loading && (
        <div className="p-6 text-center">
          <Sparkles size={28} className="text-primary/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Receba sugestões inteligentes de prazo e taxa, análise de risco e cenários alternativos.
          </p>
        </div>
      )}

      {loading && (
        <div className="p-8 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Analisando viabilidade e gerando cenários…</p>
        </div>
      )}

      {analysis && (
        <div className="p-6 space-y-5">
          {/* Risk badge */}
          {(() => {
            const r = RISK_STYLE[analysis.risk_level];
            const Icon = r.icon;
            return (
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${r.border} ${r.bg}`}>
                <Icon size={18} className={`${r.color} mt-0.5 shrink-0`} />
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${r.color}`}>
                    Risco {analysis.risk_level}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{analysis.risk_reason}</p>
                </div>
              </div>
            );
          })()}

          {/* Summary */}
          <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>

          {/* Recommendations */}
          <div className="space-y-2">
            <p className="text-label">Recomendações</p>
            <ul className="space-y-1.5">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Scenarios */}
          <div className="space-y-2">
            <p className="text-label">Cenários Alternativos</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.scenarios.map((s) => {
                const Icon = SCENARIO_ICON[s.name] || Scale;
                return (
                  <button
                    key={s.name}
                    onClick={() => onApplyScenario(s)}
                    className="text-left p-3 rounded-xl border border-border hover:border-primary/50 bg-background/50 transition-all micro-press"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className="text-primary" />
                      <span className="text-xs font-bold text-foreground">{s.name}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-lg font-bold text-primary">{s.taxa}%</span>
                      <span className="text-[10px] text-muted-foreground">× {s.parcelas}x</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{s.reason}</p>
                    <p className="text-[10px] text-primary font-semibold mt-2 uppercase tracking-wider">Aplicar →</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
