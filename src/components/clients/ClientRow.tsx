import { memo } from "react";
import { Eye, Trash2, FileText } from "lucide-react";
import RiskBadge from "./RiskBadge";

const scoreColor = (s: number) =>
  s >= 700 ? "text-success bg-success/10 ring-success/20"
  : s >= 400 ? "text-warning bg-warning/10 ring-warning/20"
  : "text-destructive bg-destructive/10 ring-destructive/20";

const PALETTES = [
  "from-violet-500/25 to-fuchsia-500/10 text-violet-300 ring-violet-400/20",
  "from-sky-500/25 to-cyan-500/10 text-sky-300 ring-sky-400/20",
  "from-emerald-500/25 to-teal-500/10 text-emerald-300 ring-emerald-400/20",
  "from-amber-500/25 to-orange-500/10 text-amber-300 ring-amber-400/20",
  "from-rose-500/25 to-pink-500/10 text-rose-300 ring-rose-400/20",
  "from-indigo-500/25 to-blue-500/10 text-indigo-300 ring-indigo-400/20",
];

export type ClientSummary = { contracts: number; active: number; overdue: number };

type Props = {
  client: any;
  summary: ClientSummary;
  isSel: boolean;
  striped: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
};

function ClientRowImpl({ client: c, summary, isSel, striped, onToggle, onOpen, onDelete }: Props) {
  const sc = Number(c.credit_score || 0);
  const initial = (c.name?.charAt(0) || "?").toUpperCase();
  const pal = PALETTES[(initial.charCodeAt(0) || 0) % PALETTES.length];
  return (
    <tr
      onClick={() => onOpen(c.id)}
      className={`group border-t border-border/30 hover:bg-primary/[0.04] cursor-pointer transition-colors ${isSel ? "bg-primary/[0.06]" : striped ? "bg-muted/[0.04]" : ""}`}
    >
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSel}
          onChange={() => onToggle(c.id)}
          aria-label={`Selecionar ${c.name || "cliente"}`}
          className="check-premium"
        />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${pal} ring-1 flex items-center justify-center text-[13px] font-bold shrink-0 transition-transform group-hover:scale-105`}>
            {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-2xl object-cover" /> : initial}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate text-[13.5px] leading-tight">{c.name}</p>
            {c.cpf_cnpj && <p className="text-[11px] text-muted-foreground/70 font-mono mt-0.5">{c.cpf_cnpj}</p>}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-muted-foreground">
        <div className="space-y-0.5">
          {(c.phone || c.whatsapp) && <p className="text-[12.5px] text-foreground/85">{c.phone || c.whatsapp}</p>}
          {c.email && <p className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">{c.email}</p>}
          {!c.phone && !c.whatsapp && !c.email && <span className="text-xs text-muted-foreground/40">—</span>}
        </div>
      </td>
      <td className="px-5 py-3.5">
        {summary.contracts === 0 ? (
          <span className="text-xs text-muted-foreground/50">—</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-[11px] font-bold text-primary ring-1 ring-primary/20">
              <FileText size={10} /> {summary.contracts}
            </span>
            {summary.overdue > 0 && (
              <span className="inline-flex items-center px-1.5 py-1 rounded-lg bg-destructive/15 text-destructive text-[10px] font-bold ring-1 ring-destructive/30 animate-pulse" title="Parcelas em atraso">
                {summary.overdue} atras.
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1 min-w-[54px]">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md text-center ring-1 ${scoreColor(sc)}`}>{sc}</span>
            <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${sc >= 80 ? "bg-emerald-400" : sc >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                style={{ width: `${Math.min(100, Math.max(4, sc))}%` }}
              />
            </div>
          </div>
          <RiskBadge score={c.credit_score} compact />
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${c.status === "Ativo" ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25" : "bg-muted/40 text-muted-foreground ring-border/40"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${c.status === "Ativo" ? "bg-emerald-400 shadow-[0_0_6px_hsl(152_76%_50%/0.8)]" : "bg-muted-foreground/50"}`} />
          {c.status}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}
            className="p-2 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
            title="Ver"
            aria-label={`Abrir ${c.name || "cliente"}`}
          >
            <Eye size={15} />
          </button>
          <button
            onClick={(e) => onDelete(c.id, e)}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Excluir"
            aria-label={`Excluir ${c.name || "cliente"}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export const ClientRow = memo(ClientRowImpl, (a, b) =>
  a.client === b.client &&
  a.summary.contracts === b.summary.contracts &&
  a.summary.overdue === b.summary.overdue &&
  a.summary.active === b.summary.active &&
  a.isSel === b.isSel &&
  a.striped === b.striped &&
  a.onToggle === b.onToggle &&
  a.onOpen === b.onOpen &&
  a.onDelete === b.onDelete
);
