import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserCheck, UserX, Key, Trash2, Users, X, Phone, Mail, MapPin, Copy, Search, Shield } from "lucide-react";
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
  const [search, setSearch] = useState("");

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

  const inv = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("collectors").insert({ user_id: user.id, name, phone, email, city, state });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "✓ Cobrador adicionado!" });
      setShowForm(false); setName(""); setPhone(""); setEmail(""); setCity(""); setState("");
      inv("collectors");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("collectors").update({ is_active: !isActive }).eq("id", id);
    inv("collectors");
    toast({ title: isActive ? "Cobrador desativado" : "Cobrador ativado" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cobrador?")) return;
    await supabase.from("collector_assignments").delete().eq("collector_id", id);
    await supabase.from("collector_tokens").delete().eq("collector_id", id);
    await supabase.from("collectors").delete().eq("id", id);
    inv("collectors"); inv("collector-assignments"); inv("collector-tokens");
    toast({ title: "Cobrador excluído" });
  };

  const handleGenerateToken = async (collectorId: string) => {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
    const { error } = await supabase.from("collector_tokens").insert({ user_id: user.id, collector_id: collectorId, token });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      navigator.clipboard.writeText(token);
      toast({ title: "Token gerado e copiado!", description: token });
      inv("collector-tokens");
    }
  };

  const handleAssign = async (collectorId: string, clientId: string) => {
    if (!user) return;
    const { error } = await supabase.from("collector_assignments").insert({ user_id: user.id, collector_id: collectorId, client_id: clientId });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✓ Cliente atribuído!" }); inv("collector-assignments"); }
  };

  const handleRemoveAssignment = async (id: string) => {
    await supabase.from("collector_assignments").delete().eq("id", id);
    inv("collector-assignments");
  };

  const filteredCollectors = collectors.filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const stats = {
    total: collectors.length,
    active: collectors.filter((c: any) => c.is_active !== false).length,
    assigned: new Set(assignments.map((a: any) => a.collector_id)).size,
  };

  const inputCls = "w-full px-4 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground input-enhanced";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={24} className="text-primary" /> Cobradores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de cobradores externos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Cobrador
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 stagger-fade-in">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Ativos", value: stats.active, color: "text-success" },
          { label: "Com Clientes", value: stats.assigned, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 card-shine">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      {collectors.length > 2 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar cobrador..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} pl-10`} />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-border bg-card p-6 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Cadastrar Cobrador</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade *</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" required className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">UF *</label>
                <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="SP" maxLength={2} required className={inputCls} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-button)" }}>
            <Plus size={14} /> {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </form>
      )}

      {filteredCollectors.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Users size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-medium">{search ? "Nenhum cobrador encontrado" : "Nenhum cobrador cadastrado"}</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre um cobrador para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-fade-in">
          {filteredCollectors.map((c: any) => {
            const cTokens = tokens.filter((t: any) => t.collector_id === c.id);
            const cAssignments = assignments.filter((a: any) => a.collector_id === c.id);
            const isActive = c.is_active !== false;
            return (
              <div key={c.id} className={`rounded-2xl border bg-card p-5 space-y-3 card-hover ${isActive ? "border-border" : "border-border/50 opacity-70"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Phone size={10} /> {c.phone}
                        <span className="text-muted-foreground/30">·</span>
                        <MapPin size={10} /> {c.city}/{c.state}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={isActive ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {cTokens.length > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                    <Key size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-foreground flex-1">{cTokens[0].token}</span>
                    <button onClick={() => { navigator.clipboard.writeText(cTokens[0].token); toast({ title: "Token copiado!" }); }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground"><Copy size={12} /></button>
                  </div>
                )}

                {cAssignments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cAssignments.map((a: any) => (
                      <Badge key={a.id} variant="outline" className="text-[10px] gap-1 bg-accent/30">
                        {a.clients?.name}
                        <button onClick={() => handleRemoveAssignment(a.id)} className="hover:text-destructive ml-0.5"><X size={10} /></button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <button onClick={() => handleToggleActive(c.id, isActive)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/50 text-foreground hover:bg-accent transition-all">
                    {isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                    {isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleGenerateToken(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/50 text-foreground hover:bg-accent transition-all">
                    <Key size={12} /> Token
                  </button>
                  <button onClick={() => setAssignModal(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                    <Users size={12} /> Atribuir
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-all ml-auto">
                    <Trash2 size={12} />
                  </button>
                </div>

                {assignModal === c.id && (
                  <div className="border-t border-border pt-3 space-y-2 animate-fade-in">
                    <p className="text-xs font-semibold text-foreground">Selecione um cliente:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {clients.filter((cl: any) => !cAssignments.some((a: any) => a.client_id === cl.id)).map((cl: any) => (
                        <button key={cl.id} onClick={() => { handleAssign(c.id, cl.id); setAssignModal(null); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-accent/50 text-foreground transition-colors">
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
