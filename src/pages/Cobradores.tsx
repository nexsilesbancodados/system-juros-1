import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserCheck, UserX, Key, Trash2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Cobradores = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignModal, setAssignModal] = useState<string | null>(null);

  const { data: collectors = [] } = useQuery({
    queryKey: ["collectors", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("collectors").select("*").eq("user_id", user!.id).order("name");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["collector-assignments", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("collector_assignments").select("*, clients(name)").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: tokens = [] } = useQuery({
    queryKey: ["collector-tokens", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("collector_tokens").select("*").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("user_id", user!.id).order("name");
      return data || [];
    },
    enabled: !!user,
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("collectors").insert({ user_id: user.id, name, phone, email, city, state });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Cobrador adicionado!" });
      setShowForm(false);
      setName(""); setPhone(""); setEmail(""); setCity(""); setState("");
      queryClient.invalidateQueries({ queryKey: ["collectors"] });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("collectors").update({ is_active: !isActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["collectors"] });
  };

  const handleGenerateToken = async (collectorId: string) => {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
    const { error } = await supabase.from("collector_tokens").insert({ user_id: user.id, collector_id: collectorId, token });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Token gerado!", description: token });
      queryClient.invalidateQueries({ queryKey: ["collector-tokens"] });
    }
  };

  const handleAssign = async (collectorId: string, clientId: string) => {
    if (!user) return;
    const { error } = await supabase.from("collector_assignments").insert({ user_id: user.id, collector_id: collectorId, client_id: clientId });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Cliente atribuído!" });
      queryClient.invalidateQueries({ queryKey: ["collector-assignments"] });
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    await supabase.from("collector_assignments").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["collector-assignments"] });
  };

  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cobradores</h1>
          <p className="text-sm text-muted-foreground">Gestão de cobradores externos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground" style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}>
          <Plus size={16} /> Novo Cobrador
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Cadastrar Cobrador</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" required className={inputCls} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={inputCls} />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" required className={inputCls} />
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Estado (UF)" required className={inputCls} />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </form>
      )}

      {collectors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum cobrador cadastrado</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collectors.map((c: any) => {
            const cTokens = tokens.filter((t: any) => t.collector_id === c.id);
            const cAssignments = assignments.filter((a: any) => a.collector_id === c.id);
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone} · {c.city}/{c.state}</p>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </div>
                  <Badge variant="outline" className={c.is_active !== false ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                    {c.is_active !== false ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {cTokens.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Token: <span className="font-mono text-foreground">{cTokens[0].token}</span>
                  </div>
                )}

                {cAssignments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cAssignments.map((a: any) => (
                      <Badge key={a.id} variant="outline" className="text-[10px] gap-1">
                        {a.clients?.name}
                        <button onClick={() => handleRemoveAssignment(a.id)} className="hover:text-red-500"><X size={10} /></button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <button onClick={() => handleToggleActive(c.id, c.is_active !== false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-foreground hover:bg-accent/70">
                    {c.is_active !== false ? <UserX size={12} /> : <UserCheck size={12} />}
                    {c.is_active !== false ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleGenerateToken(c.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-foreground hover:bg-accent/70">
                    <Key size={12} /> Gerar Token
                  </button>
                  <button onClick={() => setAssignModal(c.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-foreground hover:bg-accent/70">
                    <Users size={12} /> Atribuir
                  </button>
                </div>

                {assignModal === c.id && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Selecione um cliente:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {clients.filter((cl: any) => !cAssignments.some((a: any) => a.client_id === cl.id)).map((cl: any) => (
                        <button key={cl.id} onClick={() => { handleAssign(c.id, cl.id); setAssignModal(null); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent/50 text-foreground">
                          {cl.name}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setAssignModal(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cobradores;
