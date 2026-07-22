import { Sparkles, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

type Props = {
  userName?: string;
  capitalOnStreet: number;
  totalReceived: number;
  totalProfit: number;
  roi: number;
  overdueAmount: number;
  overdueCount: number;
  paidTodayAmount: number;
  vencendoHoje: number;
  deltaReceived?: number;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Storytelling em linguagem simples — resumo executivo do momento do negócio.
 * Substitui o "número solto" por uma frase que o dono entende de bate-pronto.
 */
export default function NarrativeHero({
  userName,
  capitalOnStreet,
  totalReceived,
  totalProfit,
  roi,
  overdueAmount,
  overdueCount,
  paidTodayAmount,
  vencendoHoje,
  deltaReceived,
}: Props) {
  const primeiroNome = (userName || "").split(" ")[0] || "você";
  const healthy = overdueAmount === 0 || overdueAmount < capitalOnStreet * 0.05;
  const deltaTxt =
    typeof deltaReceived === "number" && isFinite(deltaReceived)
      ? `${deltaReceived >= 0 ? "▲" : "▼"} ${Math.abs(deltaReceived).toFixed(1)}% vs período anterior`
      : null;

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card/60 to-card/30 backdrop-blur-xl p-6 md:p-8 shadow-2xl animate-fade-in">
      {/* orb decorativo */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl opacity-40" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-success/10 blur-3xl opacity-30" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
        {/* Coluna narrativa */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles size={12} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Resumo executivo
            </span>
          </div>

          <p className="text-headline text-2xl md:text-3xl leading-tight text-foreground">
            {primeiroNome}, você tem{" "}
            <span className="text-primary">R$ {fmt(capitalOnStreet)}</span> circulando na rua
            {roi > 0 && (
              <>
                , rendendo{" "}
                <span className="text-success">{roi.toFixed(1)}% de retorno</span>
              </>
            )}
            .
          </p>

          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Já recebeu <strong className="text-foreground">R$ {fmt(totalReceived)}</strong> em
            pagamentos e acumulou{" "}
            <strong className="text-success">R$ {fmt(totalProfit)} de lucro</strong>.{" "}
            {overdueAmount > 0 ? (
              <>
                Há <strong className="text-destructive">R$ {fmt(overdueAmount)}</strong> em atraso
                ({overdueCount} parcela{overdueCount === 1 ? "" : "s"}) — vale priorizar cobrança hoje.
              </>
            ) : (
              <>Sua carteira está <strong className="text-success">100% em dia</strong>. Excelente sinal.</>
            )}
          </p>

          {/* mini highlights */}
          <div className="flex flex-wrap gap-2 pt-1">
            {paidTodayAmount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-[11px] font-semibold text-success">
                <TrendingUp size={11} /> Hoje: +R$ {fmt(paidTodayAmount)}
              </span>
            )}
            {vencendoHoje > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 text-[11px] font-semibold text-warning">
                {vencendoHoje} vencendo hoje
              </span>
            )}
            {deltaTxt && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${
                  (deltaReceived ?? 0) >= 0
                    ? "bg-success/10 border-success/20 text-success"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                {(deltaReceived ?? 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {deltaTxt}
              </span>
            )}
          </div>
        </div>

        {/* Coluna saúde */}
        <div className="rounded-3xl border border-border/40 bg-card/50 backdrop-blur p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-label">Saúde da carteira</span>
            <div
              className={`w-2 h-2 rounded-full ${healthy ? "bg-success animate-pulse" : "bg-destructive animate-pulse"}`}
            />
          </div>

          {/* barra */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs text-muted-foreground">Em dia</span>
              <span className={`text-2xl font-black ${healthy ? "text-success" : "text-destructive"}`}>
                {capitalOnStreet > 0
                  ? Math.max(0, 100 - (overdueAmount / capitalOnStreet) * 100).toFixed(0)
                  : "100"}
                %
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  healthy
                    ? "bg-gradient-to-r from-success/70 to-success"
                    : "bg-gradient-to-r from-destructive/70 to-destructive"
                }`}
                style={{
                  width: `${
                    capitalOnStreet > 0
                      ? Math.max(4, 100 - (overdueAmount / capitalOnStreet) * 100)
                      : 100
                  }%`,
                }}
              />
            </div>
          </div>

          {overdueAmount > 0 && (
            <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground">
              <AlertCircle size={12} className="text-destructive shrink-0 mt-0.5" />
              <span>
                {((overdueAmount / capitalOnStreet) * 100).toFixed(1)}% da carteira precisa de
                cobrança
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
