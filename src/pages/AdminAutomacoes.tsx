import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, Activity, MessageSquare, FileCheck, 
  AlertCircle, CheckCircle2, Clock, Terminal,
  Settings2, Pause, Play, Trash2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const AdminAutomacoes = () => {
  const { toast } = useToast();
  const [automations, setAutomations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const sub = supabase
      .channel("automation_updates")
      .on("postgres_changes" as any, { event: "*", table: "automation_logs", schema: "public" }, () => fetchLogs())
      .on("postgres_changes" as any, { event: "*", table: "system_automations", schema: "public" }, () => fetchAutomations())
      .subscribe();
    
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAutomations(), fetchLogs()]);
    setLoading(false);
  };

  const fetchAutomations = async () => {
    const { data } = await supabase.from("system_automations").select("*").order("name");
    if (data) setAutomations(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from("automation_logs").select("*").order("created_at", { ascending: false }).limit(20);
    if (data) setLogs(data);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("system_automations")
      .update({ status: newStatus })
      .eq("id", id);
    
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Automação ${newStatus === "active" ? "ativada" : "pausada"}.` });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8 animate-fade-in">
      <div className="page-hero">
        <div className="page-hero-content flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon bg-indigo-500/10 text-indigo-500">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Painel de Automações</h1>
              <p className="text-muted-foreground">Monitoramento global de robôs e processamento de IA.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
              <Clock size={16} className="mr-2" /> Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {automations.map((auto) => (
          <Card key={auto.id} className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${
                  auto.type === 'billing' ? 'bg-orange-500/10 text-orange-500' : 
                  auto.type === 'support' ? 'bg-blue-500/10 text-blue-500' : 
                  'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {auto.type === 'billing' ? <MessageSquare size={20} /> : 
                   auto.type === 'support' ? <Bot size={20} /> : 
                   <FileCheck size={20} />}
                </div>
                <Badge variant={auto.status === 'active' ? 'default' : 'secondary'} className="rounded-full">
                  {auto.status === 'active' ? 'Ativo' : 'Pausado'}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold mb-1">{auto.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Última execução: {auto.last_run ? new Date(auto.last_run).toLocaleString() : 'Nunca'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-muted-foreground uppercase">Execuções</p>
                  <p className="text-xl font-bold">{auto.total_executions}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-muted-foreground uppercase">Sucesso</p>
                  <p className="text-xl font-bold text-emerald-500">{auto.success_rate}%</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant={auto.status === 'active' ? "destructive" : "default"} 
                size="sm" 
                className="w-full rounded-xl"
                onClick={() => toggleStatus(auto.id, auto.status)}
              >
                {auto.status === 'active' ? <Pause size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
                {auto.status === 'active' ? 'Pausar' : 'Ativar'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-indigo-400" />
            <h2 className="text-lg font-semibold">Logs do Sistema (Tempo Real)</h2>
          </div>
        </div>
        <div className="p-4 bg-black/40 font-mono text-sm overflow-y-auto max-h-[400px]">
          {logs.length === 0 ? (
            <p className="text-muted-foreground italic p-4 text-center">Nenhum log registrado ainda...</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="py-1 flex gap-3 border-b border-white/5 last:border-0">
                <span className="text-muted-foreground min-w-[150px]">{new Date(log.created_at).toLocaleTimeString()}</span>
                <span className={
                  log.level === 'error' ? 'text-red-400' : 
                  log.level === 'warning' ? 'text-yellow-400' : 
                  'text-emerald-400'
                }>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-white/90">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminAutomacoes;