import { useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Analysis {
  score: number;
  risk_level: "baixo" | "medio" | "alto" | "critico";
  risk_label: string;
  recommended_limit: number;
  recommended_max_installments: number;
  reasoning: string;
  positive_points: string[];
  red_flags: string[];
  recommendations: string[];
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const riskColors: Record<Analysis["risk_level"], { bg: string; text: string; ring: string; bar: string }> = {
  baixo: { bg: "bg-success/10", text: "text-success", ring: "ring-success/30", bar: "bg-success" },
  medio: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/30", bar: "bg-warning" },
  alto: { bg: "bg-orange-500/10", text: "text-orange-500", ring: "ring-orange-500/30", bar: "bg-orange-500" },
  critico: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/30", bar: "bg-destructive" },
};

const AICreditScore = ({ clientId, currentScore, onApplyScore }: { clientId: string; currentScore: number; onApplyScore?: (score: number) => void }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [open, setOpen] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("credit-score-ai", { body: { client_id: clientId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar crédito");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const applyScore = async () => {
    if (!analysis) return;
    const { error } = await supabase.from("clients").update({ credit_score: analysis.score }).eq("id", clientId);
    if (error) return toast.error(error.message);
    toast.success(`Score atualizado para ${analysis.score}`);
    onApplyScore?.(analysis.score);
    setOpen(false);
  };

  const colors = analysis ? riskColors[analysis.risk_level] : null;
  const scorePct = analysis ? Math.min(100, (analysis.score / 1000) * 100) : 0;

  return (
    <>
      <button
        onClick={analyze}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 disabled:opacity-50 focus-ring"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        Análise IA
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => !loading && setOpen(false)}>
          <div className="modal-content max-w-2xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Sparkles size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Análise de Crédito por IA</h3>
                  <p className="text-xs text-muted-foreground">Score, risco e recomendações personalizadas</p>
                </div>
              </div>
              <button onClick={() => !loading && setOpen(false)} className="p-1.5 rounded-lg hover:bg-accent">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
              {loading || !analysis ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Analisando histórico de crédito...</p>
                </div>
              ) : (
                <>
                  {/* Score gauge */}
                  <div className={`rounded-2xl p-5 ${colors!.bg} ring-1 ${colors!.ring}`}>
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Score</p>
                        <p className={`text-4xl font-bold ${colors!.text}`}>{analysis.score}<span className="text-base text-muted-foreground">/1000</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Risco</p>
                        <p className={`text-base font-bold ${colors!.text}`}>{analysis.risk_label}</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                      <div className={`h-full ${colors!.bar} transition-all`} style={{ width: `${scorePct}%` }} />
                    </div>
                    <p className="text-xs text-foreground/80 mt-3 leading-relaxed">{analysis.reasoning}</p>
                  </div>

                  {/* Recommended limits */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Limite recomendado</p>
                      <p className="text-lg font-bold text-foreground mt-1">R$ {fmt(analysis.recommended_limit)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Máx. parcelas</p>
                      <p className="text-lg font-bold text-foreground mt-1">{analysis.recommended_max_installments}x</p>
                    </div>
                  </div>

                  {/* Positive */}
                  {analysis.positive_points.length > 0 && (
                    <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-success" />
                        <p className="text-xs font-semibold text-success uppercase tracking-wider">Pontos positivos</p>
                      </div>
                      <ul className="space-y-1">
                        {analysis.positive_points.map((p, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex gap-2"><span className="text-success">+</span>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Red flags */}
                  {analysis.red_flags.length > 0 && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-destructive" />
                        <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Sinais de alerta</p>
                      </div>
                      <ul className="space-y-1">
                        {analysis.red_flags.map((p, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex gap-2"><span className="text-destructive">!</span>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={14} className="text-primary" />
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Recomendações</p>
                      </div>
                      <ul className="space-y-1.5">
                        {analysis.recommendations.map((p, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex gap-2"><TrendingUp size={11} className="text-primary mt-0.5 shrink-0" />{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <button onClick={analyze} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg hover:bg-accent text-muted-foreground focus-ring">
                      <RefreshCw size={12} /> Analisar novamente
                    </button>
                    <button
                      onClick={applyScore}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 focus-ring"
                    >
                      Aplicar score ({currentScore} → {analysis.score})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AICreditScore;
