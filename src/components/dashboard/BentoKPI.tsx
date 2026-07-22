import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type BentoTone = "primary" | "success" | "danger" | "warning" | "info" | "muted";

const toneMap: Record<BentoTone, { text: string; bg: string; border: string; grad: string }> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    grad: "from-primary/25 via-primary/5 to-transparent",
  },
  success: {
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    grad: "from-success/25 via-success/5 to-transparent",
  },
  danger: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    grad: "from-destructive/25 via-destructive/5 to-transparent",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    grad: "from-warning/25 via-warning/5 to-transparent",
  },
  info: {
    text: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
    grad: "from-info/25 via-info/5 to-transparent",
  },
  muted: {
    text: "text-foreground",
    bg: "bg-muted/40",
    border: "border-border/40",
    grad: "from-muted/40 via-muted/10 to-transparent",
  },
};

type Props = {
  label: string;
  value: string | number;
  /** Explicação em linguagem simples — abre em tooltip no ícone (?). */
  explanation?: string;
  /** Frase curta em linguagem simples logo abaixo do valor. */
  hint?: string;
  /** Variação % vs período anterior. */
  delta?: number;
  positiveIsGood?: boolean;
  tone?: BentoTone;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
  /** Ocupa mais espaço no grid (Bento). */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Card KPI financeiro Bento — número grande + explicação em linguagem simples + comparativo.
 * Pensado para o dono/credor entender rapidamente o que o número significa.
 */
export default function BentoKPI({
  label,
  value,
  explanation,
  hint,
  delta,
  positiveIsGood = true,
  tone = "muted",
  icon: Icon,
  onClick,
  size = "md",
  className,
}: Props) {
  const t = toneMap[tone];
  const showDelta = typeof delta === "number" && isFinite(delta);
  const up = showDelta && (delta as number) >= 0;
  const good = showDelta && (positiveIsGood ? up : !up);
  const clickable = !!onClick;

  const sizeCls = {
    sm: "min-h-[120px] p-4",
    md: "min-h-[150px] p-5",
    lg: "min-h-[190px] p-6 md:col-span-2",
  }[size];

  const valueCls = {
    sm: "text-xl md:text-2xl",
    md: "text-2xl md:text-3xl",
    lg: "text-3xl md:text-5xl",
  }[size];

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[28px] border bg-card/40 backdrop-blur-xl text-left w-full transition-all duration-300",
        t.border,
        sizeCls,
        clickable && "hover:bg-card/60 hover:border-primary/30 hover:shadow-xl cursor-pointer",
        !clickable && "cursor-default",
        className
      )}
    >
      {/* faixa gradient */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity",
          t.grad
        )}
      />
      {/* orb sutil */}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -bottom-10 w-32 h-32 rounded-full blur-3xl opacity-[0.08] group-hover:opacity-[0.15] transition-opacity bg-gradient-to-br",
          t.grad
        )}
      />

      <div className="relative z-10 flex flex-col justify-between h-full gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
              {label}
            </span>
            {explanation && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0"
                    >
                      <Info size={11} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                    {explanation}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                t.bg
              )}
            >
              <Icon size={16} className={t.text} />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className={cn("font-black tabular-nums leading-none", valueCls, t.text)}>{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>

        {showDelta && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-bold self-start px-2 py-0.5 rounded-full",
              good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}
          >
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta as number).toFixed(1)}%
            <span className="opacity-60 font-medium">vs anterior</span>
          </div>
        )}
      </div>
    </button>
  );
}
