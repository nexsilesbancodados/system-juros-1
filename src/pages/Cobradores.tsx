import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, UserCheck, UserX, Key, Trash2, Users, X, Phone, Mail, MapPin,
  Copy, Search, Shield, Edit2, Check, MoreVertical, ChevronDown, Eye, EyeOff,
  Star, TrendingUp, Clock, AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const Cobradores = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [tokenVisibility, setTokenVisibility] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

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

  const resetForm = () => {
    setName(""); setPhone(""); setEmail(""); setCity(""); setState("");
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (c: any) => {
    setName(c.name); setPhone(c.phone); setEmail(c.email || "");
    setCity(c.city); setState(c.state);
    setEditingId(c.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("collectors")
        .update({ name, phone, email, city, state })
        .eq("id", editingId);
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        toast({ title: "✓ Cobrador atualizado!" });
        resetForm(); inv("collectors");
      }
    } else {
      const { error } = await supabase.from("collectors")
        .insert({ user_id: user.id, name, phone, email, city, state });
      setSaving(false);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        toast({ title: "✓ Cobrador adicionado!" });
        resetForm(); inv("collectors");
      }
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("collectors").update({ is_active: !isActive }).eq("id", id);
    inv("collectors");
    toast({ title: isActive ? "Cobrador desativado" : "Cobrador ativado" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("collector_assignments").delete().eq("collector_id", id);
    await supabase.from("collector_tokens").delete().eq("collector_id", id);
    await supabase.from("collectors").delete().eq("id", id);
    inv("collectors"); inv("collector-assignments"); inv("collector-tokens");
    toast({ title: "Cobrador excluído" });
    setDeleteConfirm(null);
  };

  const handleGenerateToken = async (collectorId: string) => {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
    const { error } = await supabase.from("collector_tokens")
      .insert({ user_id: user.id, collector_id: collectorId, token });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      navigator.clipboard.writeText(token);
      toast({ title: "Token gerado e copiado!", description: token });
      inv("collector-tokens");
      setTokenVisibility(prev => ({ ...prev, [collectorId]: true }));
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    await supabase.from("collector_tokens").delete().eq("id", tokenId);
    inv("collector-tokens");
    toast({ title: "Token revogado" });
  };

  const handleAssign = async (collectorId: string, clientId: string) => {
    if (!user) return;
    const { error } = await supabase.from("collector_assignments")
      .insert({ user_id: user.id, collector_id: collectorId, client_id: clientId });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "✓ Cliente atribuído!" }); inv("collector-assignments"); }
  };

  const handleRemoveAssignment = async (id: string) => {
    await supabase.from("collector_assignments").delete().eq("id", id);
    inv("collector-assignments");
    toast({ title: "Atribuição removida" });
  };

  const filteredCollectors = collectors.filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) || c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: collectors.length,
    active: collectors.filter((c: any) => c.is_active !== false).length,
    inactive: collectors.filter((c: any) => c.is_active === false).length,
    assigned: new Set(assignments.map((a: any) => a.collector_id)).size,
    totalAssignments: assignments.length,
  };

  const inputCls = "w-full px-4 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all";

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            Cobradores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão completa de cobradores externos</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--gradient-button)" }}>
          <Plus size={16} /> Novo Cobrador
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-foreground", bg: "bg-accent/30" },
          { label: "Ativos", value: stats.active, icon: UserCheck, color: "text-success", bg: "bg-success/10" },
          { label: "Inativos", value: stats.inactive, icon: UserX, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Clientes Atribuídos", value: stats.totalAssignments, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 card-shine hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={14} className={s.color} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      {collectors.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-10`}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-primary/20 bg-card p-6 space-y-5 animate-scale-in shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                {editingId ? <Edit2 size={14} className="text-primary" /> : <Plus size={14} className="text-primary" />}
              </div>
              <h2 className="font-semibold text-foreground">{editingId ? "Editar Cobrador" : "Novo Cobrador"}</h2>
            </div>
            <button type="button" onClick={resetForm} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome Completo *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Telefone / WhatsApp *</label>
              <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cidade *</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" required className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">UF *</label>
                <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="SP" maxLength={2} required className={inputCls} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:shadow-lg transition-all"
              style={{ background: "var(--gradient-button)" }}>
              {editingId ? <Check size={14} /> : <Plus size={14} />}
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {/* Empty State */}
      {filteredCollectors.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border bg-card/50">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
            <Users size={32} className="text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-semibold text-lg">
            {search ? "Nenhum cobrador encontrado" : "Nenhum cobrador cadastrado"}
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {search
              ? `Não encontramos resultados para "${search}". Tente outro termo.`
              : "Cadastre cobradores para distribuir a carteira de clientes e gerenciar cobranças externas."}
          </p>
          {!search && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-button)" }}>
              <Plus size={14} /> Cadastrar Primeiro Cobrador
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-fade-in">
          {filteredCollectors.map((c: any) => {
            const cTokens = tokens.filter((t: any) => t.collector_id === c.id);
            const cAssignments = assignments.filter((a: any) => a.collector_id === c.id);
            const isActive = c.is_active !== false;
            const isExpanded = expandedCard === c.id;
            const showToken = tokenVisibility[c.id];

            return (
              <div key={c.id}
                className={`rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  isActive ? "border-border hover:border-primary/20" : "border-border/50 opacity-75"
                }`}>
                {/* Top accent bar */}
                <div className={`h-1 w-full ${isActive ? "bg-gradient-to-r from-primary/60 to-primary/20" : "bg-muted"}`} />

                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm ${
                        isActive
                          ? "bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/10"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {c.name?.charAt(0)?.toUpperCase()}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                          isActive ? "bg-success" : "bg-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-base">{c.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone size={10} /> {c.phone}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={10} /> {c.city}/{c.state}
                          </span>
                        </div>
                        {c.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Mail size={10} /> {c.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${
                        isActive
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}>
                        {isActive ? "Ativo" : "Inativo"}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleEdit(c)} className="gap-2">
                            <Edit2 size={14} /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(c.id, isActive)} className="gap-2">
                            {isActive ? <><UserX size={14} /> Desativar</> : <><UserCheck size={14} /> Ativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerateToken(c.id)} className="gap-2">
                            <Key size={14} /> Gerar Token
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAssignModal(c.id)} className="gap-2">
                            <Users size={14} /> Atribuir Cliente
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteConfirm(c.id)} className="gap-2 text-destructive focus:text-destructive">
                            <Trash2 size={14} /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 p-2.5 rounded-xl bg-accent/20">
                      <Users size={12} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground font-medium">{cAssignments.length}</span>
                      <span className="text-[10px] text-muted-foreground">clientes</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 p-2.5 rounded-xl bg-accent/20">
                      <Key size={12} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground font-medium">{cTokens.length}</span>
                      <span className="text-[10px] text-muted-foreground">{cTokens.length === 1 ? "token" : "tokens"}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 p-2.5 rounded-xl bg-accent/20">
                      <Clock size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  </div>

                  {/* Token section */}
                  {cTokens.length > 0 && (
                    <div className="space-y-1.5">
                      {cTokens.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                          <Key size={12} className="text-muted-foreground shrink-0" />
                          <span className="text-xs font-mono text-foreground flex-1 truncate">
                            {showToken ? t.token : "••••••••••••••••"}
                          </span>
                          <button onClick={() => setTokenVisibility(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="p-1 rounded hover:bg-accent text-muted-foreground" title={showToken ? "Ocultar" : "Mostrar"}>
                            {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button onClick={() => { navigator.clipboard.writeText(t.token); toast({ title: "Token copiado!" }); }}
                            className="p-1 rounded hover:bg-accent text-muted-foreground" title="Copiar">
                            <Copy size={12} />
                          </button>
                          <button onClick={() => handleRevokeToken(t.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Revogar">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assigned clients */}
                  {cAssignments.length > 0 && (
                    <div>
                      <button onClick={() => setExpandedCard(isExpanded ? null : c.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors">
                        <ChevronDown size={12} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {cAssignments.length} {cAssignments.length === 1 ? "cliente atribuído" : "clientes atribuídos"}
                      </button>
                      {isExpanded && (
                        <div className="flex flex-wrap gap-1.5 animate-fade-in">
                          {cAssignments.map((a: any) => (
                            <Badge key={a.id} variant="outline" className="text-[11px] gap-1.5 py-1 px-2.5 bg-accent/30 hover:bg-accent/50 transition-colors">
                              {a.clients?.name}
                              <button onClick={() => handleRemoveAssignment(a.id)}
                                className="hover:text-destructive transition-colors"><X size={10} /></button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => setAssignModal(c.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                      <Users size={12} /> Atribuir Cliente
                    </button>
                    <button onClick={() => handleGenerateToken(c.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-accent/50 text-foreground hover:bg-accent transition-all">
                      <Key size={12} /> Gerar Token
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Client Dialog */}
      <Dialog open={!!assignModal} onOpenChange={() => { setAssignModal(null); setClientSearch(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              Atribuir Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className={`${inputCls} pl-9 text-sm`}
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {clients
                .filter((cl: any) => {
                  const collectorAssigns = assignments.filter((a: any) => a.collector_id === assignModal);
                  return !collectorAssigns.some((a: any) => a.client_id === cl.id) &&
                    (!clientSearch || cl.name.toLowerCase().includes(clientSearch.toLowerCase()));
                })
                .map((cl: any) => (
                  <button key={cl.id}
                    onClick={() => { handleAssign(assignModal!, cl.id); setAssignModal(null); setClientSearch(""); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-accent/50 text-foreground transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {cl.name?.charAt(0)?.toUpperCase()}
                    </div>
                    {cl.name}
                  </button>
                ))}
              {clients.filter((cl: any) => {
                const collectorAssigns = assignments.filter((a: any) => a.collector_id === assignModal);
                return !collectorAssigns.some((a: any) => a.client_id === cl.id) &&
                  (!clientSearch || cl.name.toLowerCase().includes(clientSearch.toLowerCase()));
              }).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  {clientSearch ? "Nenhum cliente encontrado" : "Todos os clientes já foram atribuídos"}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} />
              Excluir Cobrador
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. Todos os tokens e atribuições deste cobrador serão removidos.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 size={14} className="mr-1.5" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cobradores;
