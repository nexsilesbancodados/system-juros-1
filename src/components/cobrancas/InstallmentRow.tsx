import { memo } from "react";
import {
  CheckSquare, Square, CalendarDays, MessageSquare, Copy, Mail, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBR, parseLocalDate } from "@/lib/dateUtils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const relTime = (iso: string) => {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export interface InstallmentRowProps {
  inst: any;
  isSel: boolean;
  hasPixKey: boolean;
  lastAttempt: { channel?: string; created_at?: string } | null;
  onRowClick: (clientId: string) => void;
  onToggleSelect: (id: string) => void;
  onWhatsApp: (inst: any) => void;
  onCopyPix: (inst: any) => void;
  onEmail: (inst: any) => void;
  onMarkPaid: (id: string) => void;
  onShowHistory: (id: string, clientName: string) => void;
}

const InstallmentRowInner = ({
  inst, isSel, hasPixKey, lastAttempt,
  onRowClick, onToggleSelect, onWhatsApp, onCopyPix, onEmail, onMarkPaid, onShowHistory,
}: InstallmentRowProps) => {
  const isOverdue = inst.status === "overdue";
  const isPaid = inst.status === "paid";
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dueDate = parseLocalDate(inst.due_date) ?? new Date(inst.due_date);
  const daysDiff = Math.floor((now.getTime() - new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()) / 86400000);
  const daysText = isOverdue ? `${daysDiff}d atrasada` : !isPaid ? (daysDiff < 0 ? `em ${Math.abs(daysDiff)}d` : "hoje") : "";

  const persistedAt = inst.last_collected_at;
  const persistedCh = inst.last_collected_channel;
  const count = Number(inst.collection_count || 0);
  const channel = lastAttempt?.channel || persistedCh;
  const at = lastAttempt?.created_at || persistedAt;
  const showCollected = !isPaid && (lastAttempt || persistedAt);
  const icon = channel === "whatsapp" ? "💬" : channel === "email" ? "✉️" : channel === "pix_copy" ? "🔑" : channel === "sms" ? "📱" : "✍️";

  return (
    <div
      className={`rounded-2xl border p-4 flex items-center gap-3 transition-all hover:shadow-sm cursor-pointer ${
        isSel ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" :
        isOverdue ? "border-destructive/20 bg-gradient-to-r from-destructive/5 to-transparent danger-glow" :
        isPaid ? "border-success/15 bg-success/3 success-glow" :
        "border-border bg-card"
      }`}
      onClick={() => onRowClick(inst.client_id)}
    >
      {!isPaid && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(inst.id); }}
          className="shrink-0 p-1 rounded hover:bg-accent transition-colors focus-ring"
          title="Selecionar" aria-label="Selecionar parcela"
        >
          {isSel ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-muted-foreground" />}
        </button>
      )}
      <div className={`num-badge w-10 h-10 rounded-xl ${
        isOverdue ? "bg-destructive/10 text-destructive" :
        isPaid ? "bg-success/10 text-success" :
        "bg-muted text-muted-foreground"
      }`}>
        {inst.installment_number}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-foreground truncate">{inst.client_name}</p>
          <Badge variant="outline" className={`text-[9px] shrink-0 ${
            isOverdue ? "bg-destructive/10 text-destructive border-destructive/20 badge-pulse" :
            isPaid ? "bg-success/10 text-success border-success/20" :
            "bg-muted text-muted-foreground"
          }`}>
            {isOverdue ? "Atrasada" : isPaid ? "Paga" : "Pendente"}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="font-semibold text-foreground">R$ {fmt(Number(inst.amount))}</span>
          <span className="flex items-center gap-1"><CalendarDays size={10} /> {formatBR(inst.due_date)}</span>
          {inst.contract_id && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]" title={`Contrato ${inst.client_id}`}>
              #{String(inst.contract_id).slice(0, 6)}
              {inst.contracts?.capital ? ` · R$ ${fmt(Number(inst.contracts.capital))}` : ""}
            </span>
          )}
          {daysText && <span className={isOverdue ? "text-destructive font-semibold" : daysText === "hoje" ? "text-warning font-semibold" : "text-muted-foreground"}>{daysText}</span>}
          {isPaid && inst.paid_at && <span className="text-success">Pago: {formatBR(inst.paid_at)}</span>}
          {showCollected && at && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowHistory(inst.id, inst.client_name); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/15 text-warning hover:bg-warning/25 text-[10px] font-medium border border-warning/20"
              title={`Cobrado via ${channel}${count > 0 ? ` • ${count}x` : ""} — clique para ver histórico`}
              aria-label="Ver histórico de cobrança"
            >
              {icon} cobrado há {relTime(at)}{count > 1 ? ` • ${count}x` : ""}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {!isPaid && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onWhatsApp(inst); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-all active:scale-95 focus-ring"
              title="Cobrar via WhatsApp" aria-label="Cobrar via WhatsApp"
            >
              <MessageSquare size={14} />
              <span className="hidden md:inline">WhatsApp</span>
            </button>
            {hasPixKey && (
              <button
                onClick={(e) => { e.stopPropagation(); onCopyPix(inst); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-all active:scale-95 focus-ring"
                title="Copiar chave PIX" aria-label="Copiar chave PIX"
              >
                <Copy size={14} />
                <span className="hidden lg:inline">PIX</span>
              </button>
            )}
            {inst.client_email && (
              <button
                onClick={(e) => { e.stopPropagation(); onEmail(inst); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-all active:scale-95 focus-ring"
                title="Cobrar via E-mail" aria-label="Cobrar via E-mail"
              >
                <Mail size={14} />
                <span className="hidden lg:inline">E-mail</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onMarkPaid(inst.id); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-accent transition-all active:scale-95 focus-ring"
              title="Marcar como paga" aria-label="Marcar como paga"
            >
              <Check size={14} />
              <span className="hidden sm:inline">Paga</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const InstallmentRow = memo(InstallmentRowInner);
export default InstallmentRow;
