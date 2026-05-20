import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertTriangle, Clock, Cake, Bell, CheckCheck, ChevronRight,
  X, Sparkles, TrendingDown, FileSignature, Loader2
} from "lucide-react";
import CobrarAgoraModal, { CobrarInstallment } from "./CobrarAgoraModal";

type Alert = {
  id: string;
  group: "critical" | "warning" | "info" | "system";
  icon: any;
  title: string;
  description: string;
  count?: number;
  amount?: number;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  dismissIds?: string[]; // notification ids to mark read
};

const groupStyles = {
  critical: { border: "border-destructive/30", bg: "bg-destructive/5", chip: "bg-destructive/15 text-destructive", icon: "text-destructive" },
  warning:  { border: "border-amber-500/30", bg: "bg-amber-500/5", chip: "bg-amber-500/15 text-amber-400", icon: "text-amber-400" },
  info:     { border: "border-primary/25", bg: "bg-primary/5", chip: "bg-primary/15 text-primary", icon: "text-primary" },
  system:   { border: "border-border/40", bg: "bg-muted/20", chip: "bg-muted/40 text-muted-foreground", icon: "text-muted-foreground" },
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  overdue: any[];
  dueToday: any[];
  notifications: any[];
}

const SmartAlerts = ({ overdue, dueToday, notifications }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [cobrarTitle, setCobrarTitle] = useState("Cobrar agora");
  const [cobrarList, setCobrarList] = useState<CobrarInstallment[]>([]);

  const openCobrar = (title: string, list: any[]) => {
    setCobrarTitle(title);
    setCobrarList(list as CobrarInstallment[]);
    setCobrarOpen(true);
  };

  // Birthdays today
  const { data: birthdays } = useQuery({
    queryKey: ["hoje-birthdays", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("clients")
        .select("id, name, birth_date, phone, whatsapp")
        .eq("user_id", user.id)
        .not("birth_date", "is", null);
      const today = new Date();
      return (data || []).filter((c: any) => {
        if (!c.birth_date) return false;
        const d = new Date(c.birth_date);
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
      });
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Contracts pending signature
  const { data: pendingSigs } = useQuery({
    queryKey: ["hoje-pending-sigs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("contracts")
        .select("id, client_id, capital, clients:client_id(name)")
        .eq("user_id", user.id)
        .eq("signature_status", "pending")
        .eq("status", "active")
        .limit(10);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];

    // 1) Critical: overdue >7 days (high-risk bucket)
    const critOverdue = overdue.filter((i: any) => {
      const days = Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000);
      return days >= 7;
    });
    if (critOverdue.length > 0) {
      const total = critOverdue.reduce((s, i: any) => s + Number(i.amount), 0);
      list.push({
        id: "crit-overdue",
        group: "critical",
        icon: AlertTriangle,
        title: `${critOverdue.length} cobrança${critOverdue.length !== 1 ? "s" : ""} crítica${critOverdue.length !== 1 ? "s" : ""}`,
        description: `Mais de 7 dias em atraso · R$ ${fmtBRL(total)}`,
        count: critOverdue.length,
        amount: total,
        action: { label: "Cobrar agora", onClick: () => openCobrar(`Cobrar ${critOverdue.length} crítica${critOverdue.length !== 1 ? "s" : ""}`, critOverdue) },
        secondaryAction: { label: "Ver lista", onClick: () => navigate("/cobrancas?filter=overdue") },
      });
    }



    // 2) Warning: recent overdue (<7d)
    const lightOverdue = overdue.filter((i: any) => {
      const days = Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000);
      return days < 7;
    });
    if (lightOverdue.length > 0) {
      const total = lightOverdue.reduce((s, i: any) => s + Number(i.amount), 0);
      list.push({
        id: "light-overdue",
        group: "warning",
        icon: TrendingDown,
        title: `${lightOverdue.length} atraso${lightOverdue.length !== 1 ? "s" : ""} recente${lightOverdue.length !== 1 ? "s" : ""}`,
        description: `Atrasados há menos de 7 dias · R$ ${fmtBRL(total)}`,
        count: lightOverdue.length,
        action: { label: "Ver lista", onClick: () => navigate("/cobrancas?filter=overdue") },
      });
    }

    // 3) Info: due today
    if (dueToday.length > 0) {
      const total = dueToday.reduce((s, i: any) => s + Number(i.amount), 0);
      list.push({
        id: "due-today",
        group: "info",
        icon: Clock,
        title: `${dueToday.length} vence${dueToday.length !== 1 ? "m" : ""} hoje`,
        description: `Total previsto · R$ ${fmtBRL(total)}`,
        count: dueToday.length,
        action: { label: "Enviar lembretes", onClick: () => navigate("/cobrancas?filter=today") },
      });
    }

    // 4) Birthdays
    if ((birthdays || []).length > 0) {
      list.push({
        id: "birthdays",
        group: "info",
        icon: Cake,
        title: `${birthdays!.length} aniversariante${birthdays!.length !== 1 ? "s" : ""} hoje`,
        description: birthdays!.slice(0, 3).map((b: any) => b.name).join(", ") + (birthdays!.length > 3 ? "..." : ""),
        count: birthdays!.length,
        action: { label: "Ver clientes", onClick: () => navigate("/clientes") },
      });
    }

    // 5) Pending signatures
    if ((pendingSigs || []).length > 0) {
      list.push({
        id: "pending-sigs",
        group: "warning",
        icon: FileSignature,
        title: `${pendingSigs!.length} contrato${pendingSigs!.length !== 1 ? "s" : ""} sem assinatura`,
        description: "Aguardando assinatura do cliente",
        count: pendingSigs!.length,
        action: { label: "Revisar", onClick: () => navigate("/contratos") },
      });
    }

    // 6) System notifications grouped by type
    const byType: Record<string, any[]> = {};
    (notifications || []).forEach((n: any) => {
      const k = n.type || "system";
      (byType[k] = byType[k] || []).push(n);
    });
    Object.entries(byType).forEach(([type, arr]) => {
      if (arr.length === 1) {
        const n = arr[0];
        list.push({
          id: `notif-${n.id}`,
          group: "system",
          icon: Bell,
          title: n.message.length > 60 ? n.message.slice(0, 60) + "..." : n.message,
          description: new Date(n.sent_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          action: n.link ? { label: "Abrir", onClick: () => navigate(n.link) } : undefined,
          dismissIds: [n.id],
        });
      } else {
        list.push({
          id: `notif-group-${type}`,
          group: "system",
          icon: Bell,
          title: `${arr.length} notificações · ${type}`,
          description: arr[0].message.slice(0, 50) + "...",
          count: arr.length,
          action: { label: "Ver todas", onClick: () => navigate("/notificacoes") },
          dismissIds: arr.map((n: any) => n.id),
        });
      }
    });

    return list.filter(a => !dismissed.has(a.id));
  }, [overdue, dueToday, notifications, birthdays, pendingSigs, dismissed, navigate]);

  const dismissAlert = async (alert: Alert) => {
    setDismissed(prev => new Set(prev).add(alert.id));
    if (alert.dismissIds?.length) {
      await supabase.from("notifications").update({ is_read: true }).in("id", alert.dismissIds);
      qc.invalidateQueries({ queryKey: ["hoje"] });
    }
  };

  const dismissAll = async () => {
    if (alerts.length === 0) return;
    setBusy(true);
    const allNotifIds = alerts.flatMap(a => a.dismissIds || []);
    if (allNotifIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", allNotifIds);
    }
    setDismissed(new Set(alerts.map(a => a.id)));
    qc.invalidateQueries({ queryKey: ["hoje"] });
    setBusy(false);
    toast.success("Alertas limpos");
  };

  // Sort: critical > warning > info > system
  const order = { critical: 0, warning: 1, info: 2, system: 3 };
  const sorted = [...alerts].sort((a, b) => order[a.group] - order[b.group]);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles size={14} className="text-primary" /> Alertas inteligentes
          {sorted.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
              {sorted.length}
            </span>
          )}
        </h2>
        {sorted.length > 1 && (
          <button
            onClick={dismissAll}
            disabled={busy}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />}
            Limpar todos
          </button>
        )}
      </div>
      <div className="divide-y divide-border/20 max-h-[440px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="py-10 text-center">
            <CheckCheck size={28} className="mx-auto text-success/60 mb-2" />
            <p className="text-sm font-semibold text-foreground">Nada urgente</p>
            <p className="text-xs text-muted-foreground mt-1">Você está em dia com tudo</p>
          </div>
        )}
        {sorted.map(a => {
          const s = groupStyles[a.group];
          const Icon = a.icon;
          return (
            <div key={a.id} className={`px-4 py-3 flex items-start gap-3 hover:bg-accent/20 transition-colors group ${s.bg}`}>
              <div className={`w-8 h-8 rounded-lg ${s.chip} flex items-center justify-center shrink-0`}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground leading-tight">{a.title}</p>
                  <button
                    onClick={() => dismissAlert(a)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent/40 shrink-0"
                    title="Dispensar"
                  >
                    <X size={12} className="text-muted-foreground" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.description}</p>
                {a.action && (
                  <button
                    onClick={a.action.onClick}
                    className={`mt-2 text-[11px] font-bold ${s.icon} hover:underline flex items-center gap-0.5`}
                  >
                    {a.action.label} <ChevronRight size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SmartAlerts;
