import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Trash2, RefreshCw, Database, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export const MaintenanceTools = () => {
  const { toast } = useToast();
  const [running, setRunning] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; desc: string; fn: () => Promise<void> } | null>(null);

  const runEdge = async (fn: string, label: string) => {
    setRunning(fn);
    try {
      const { error } = await supabase.functions.invoke(fn);
      if (error) throw error;
      toast({ title: `${label} executado com sucesso` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const cleanOldNotifications = async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .lt("created_at", cutoff.toISOString())
      .eq("is_read", true);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: `${count || 0} notificações antigas removidas` });
  };

  const cleanOldAuditLogs = async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const { error, count } = await supabase
      .from("audit_logs")
      .delete({ count: "exact" })
      .lt("created_at", cutoff.toISOString());
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: `${count || 0} logs antigos removidos` });
  };

  const tools = [
    {
      group: "Tarefas Automáticas",
      items: [
        {
          icon: Play, label: "Verificar parcelas vencidas",
          desc: "Roda check-overdue para marcar parcelas em atraso.",
          action: () => runEdge("check-overdue", "Verificação de vencidos"),
          danger: false,
        },
        {
          icon: Play, label: "Aplicar multas automáticas",
          desc: "Roda auto-late-fees para calcular juros e multas.",
          action: () => runEdge("auto-late-fees", "Cálculo de multas"),
          danger: false,
        },
        {
          icon: Play, label: "Cobrança automática",
          desc: "Roda auto-collection para enviar mensagens de cobrança.",
          action: () => runEdge("auto-collection", "Cobrança automática"),
          danger: false,
        },
        {
          icon: Play, label: "Notificações automáticas",
          desc: "Roda auto-notifications para gerar lembretes.",
          action: () => runEdge("auto-notifications", "Notificações"),
          danger: false,
        },
      ],
    },
    {
      group: "Limpeza de Dados",
      items: [
        {
          icon: Trash2, label: "Limpar notificações lidas (>30 dias)",
          desc: "Remove notificações lidas há mais de 30 dias.",
          action: cleanOldNotifications,
          danger: true,
        },
        {
          icon: Trash2, label: "Limpar logs de auditoria (>6 meses)",
          desc: "Remove logs antigos para liberar espaço.",
          action: cleanOldAuditLogs,
          danger: true,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Wrench size={18} /> Manutenção do Sistema
        </h2>
        <p className="text-sm text-muted-foreground">
          Ferramentas para administradores: executar jobs e limpar dados antigos.
        </p>
      </div>

      {tools.map((group) => (
        <div key={group.group} className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {group.group}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map((t) => (
              <div key={t.label} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    t.danger
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}>
                    <t.icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={t.danger ? "destructive" : "outline"}
                    disabled={running === t.label}
                    onClick={() => {
                      if (t.danger) {
                        setConfirm({
                          title: t.label,
                          desc: t.desc + " Esta ação não pode ser desfeita.",
                          fn: t.action,
                        });
                      } else {
                        t.action();
                      }
                    }}
                  >
                    {running === t.label ? (
                      <><RefreshCw size={12} className="mr-1.5 animate-spin" /> Executando</>
                    ) : (
                      <>{t.danger ? <Trash2 size={12} className="mr-1.5" /> : <Play size={12} className="mr-1.5" />}
                      Executar</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              {confirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirm?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await confirm?.fn();
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
