import { useState, useEffect, useMemo } from "react";
import {
  Users, Ban, CheckCircle, Search, Shield, Crown, MessageCircle,
  TrendingUp, UserCheck, UserX, Calendar, Filter, MoreVertical,
  Mail, Trash2, Eye, AlertTriangle, Sparkles, Download,
  Activity, Megaphone, Wrench, Database
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { AuditTrail } from "@/components/admin/AuditTrail";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";
import { MaintenanceTools } from "@/components/admin/MaintenanceTools";
import { GrowthChart } from "@/components/admin/GrowthChart";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_blocked: boolean;
  is_chat_blocked: boolean;
  subscription_type: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  loan_balance: number;
  profit_balance: number;
  expense_balance: number;
};

type FilterTab = "all" | "active" | "blocked" | "expired" | "admins";

const Admin = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<UserRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [section, setSection] = useState<"users" | "system" | "audit" | "broadcast" | "maintenance">("users");

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers((data as UserRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    const ch = supabase
      .channel("realtime-admin-profiles")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "profiles" }, () => fetchUsers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const isExpired = (u: UserRow) =>
    u.subscription_expires_at && new Date(u.subscription_expires_at) < new Date();

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = users.length;
    const blocked = users.filter((u) => u.is_blocked).length;
    const admins = users.filter((u) => u.is_admin).length;
    const monthly = users.filter((u) => u.subscription_type === "monthly").length;
    const yearly = users.filter((u) => u.subscription_type === "yearly").length;
    const expired = users.filter((u) => isExpired(u) && !u.is_admin).length;
    const active = total - blocked - expired;
    const newThisMonth = users.filter((u) => {
      const d = new Date(u.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const totalLoaned = users.reduce((s, u) => s + Number(u.loan_balance || 0), 0);
    const totalProfit = users.reduce((s, u) => s + Number(u.profit_balance || 0), 0);
    return { total, blocked, admins, monthly, yearly, expired, active, newThisMonth, totalLoaned, totalProfit };
  }, [users]);

  // ============ FILTERED ============
  const filtered = useMemo(() => {
    let list = users;
    if (tab === "active") list = list.filter((u) => !u.is_blocked && !isExpired(u));
    else if (tab === "blocked") list = list.filter((u) => u.is_blocked);
    else if (tab === "expired") list = list.filter((u) => isExpired(u) && !u.is_admin);
    else if (tab === "admins") list = list.filter((u) => u.is_admin);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => `${u.name} ${u.email || ""}`.toLowerCase().includes(q));
    }
    return list;
  }, [users, tab, search]);

  // ============ ACTIONS ============
  const handleToggleBlock = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_blocked: !current }).eq("id", userId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: current ? "Usuário desbloqueado" : "Usuário bloqueado" });
  };

  const handleToggleChatBlock = async (userId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_chat_blocked: !current }).eq("id", userId);
    toast({ title: current ? "Chat desbloqueado" : "Chat bloqueado" });
  };

  const handleToggleAdmin = async (userId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_admin: !current }).eq("id", userId);
    if (!current) {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    }
    toast({ title: current ? "Admin removido" : "Promovido a admin" });
  };

  const handleSetSubscription = async (userId: string, type: string) => {
    const expiresAt = new Date();
    if (type === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
    else if (type === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await supabase.from("profiles").update({
      subscription_type: type,
      subscription_expires_at: expiresAt.toISOString(),
    }).eq("id", userId);
    toast({ title: "Assinatura atualizada" });
  };

  const handleExtendSubscription = async (userId: string, days: number) => {
    const u = users.find((x) => x.id === userId);
    const base = u?.subscription_expires_at ? new Date(u.subscription_expires_at) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setDate(base.getDate() + days);
    await supabase.from("profiles").update({ subscription_expires_at: base.toISOString() }).eq("id", userId);
    toast({ title: `+${days} dias adicionados` });
  };

  // ============ BULK ============
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((u) => u.id)));
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const bulkBlock = async (block: boolean) => {
    const ids = Array.from(selected);
    await supabase.from("profiles").update({ is_blocked: block }).in("id", ids);
    toast({ title: `${ids.length} usuário(s) ${block ? "bloqueados" : "desbloqueados"}` });
    setSelected(new Set());
  };

  const bulkExtend = async (days: number) => {
    const ids = Array.from(selected);
    for (const id of ids) await handleExtendSubscription(id, days);
    setSelected(new Set());
  };

  const bulkNotify = async () => {
    if (!notifyMsg.trim()) return;
    const ids = Array.from(selected);
    const rows = ids.map((user_id) => ({ user_id, message: notifyMsg, from: "Administração", type: "admin" }));
    await supabase.from("notifications").insert(rows);
    toast({ title: `Notificação enviada para ${ids.length} usuário(s)` });
    setNotifyMsg("");
    setNotifyOpen(false);
    setSelected(new Set());
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "Plano", "Expira", "Status", "Admin", "Criado em"];
    const rows = filtered.map((u) => [
      u.name,
      u.email || "",
      u.subscription_type || "",
      u.subscription_expires_at ? new Date(u.subscription_expires_at).toLocaleDateString("pt-BR") : "",
      u.is_blocked ? "Bloqueado" : isExpired(u) ? "Expirado" : "Ativo",
      u.is_admin ? "Sim" : "Não",
      new Date(u.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: stats.total },
    { key: "active", label: "Ativos", count: stats.active },
    { key: "blocked", label: "Bloqueados", count: stats.blocked },
    { key: "expired", label: "Expirados", count: stats.expired },
    { key: "admins", label: "Admins", count: stats.admins },
  ];

  if (!profile?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <Shield size={40} className="text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground max-w-sm">
          Você não tem permissão para acessar esta página. Apenas administradores podem visualizar este painel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Crown size={18} className="text-primary-foreground" />
            </div>
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie usuários, assinaturas e permissões em tempo real.
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3 -mt-2">
        {[
          { key: "users", label: "Usuários", icon: Users },
          { key: "system", label: "Sistema", icon: Database },
          { key: "broadcast", label: "Comunicado", icon: Megaphone },
          { key: "audit", label: "Auditoria", icon: Activity },
          { key: "maintenance", label: "Manutenção", icon: Wrench },
        ].map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === "system" && (
        <div className="space-y-6">
          <SystemHealth />
          <GrowthChart />
        </div>
      )}
      {section === "audit" && <AuditTrail />}
      {section === "broadcast" && <BroadcastPanel />}
      {section === "maintenance" && <MaintenanceTools />}

      {section === "users" && <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Total" value={stats.total} tone="primary" />
        <KpiCard icon={UserCheck} label="Ativos" value={stats.active} tone="success" />
        <KpiCard icon={UserX} label="Bloqueados" value={stats.blocked} tone="danger" />
        <KpiCard icon={AlertTriangle} label="Expirados" value={stats.expired} tone="warning" />
        <KpiCard icon={Crown} label="Admins" value={stats.admins} tone="accent" />
        <KpiCard icon={Sparkles} label="Novos (mês)" value={stats.newThisMonth} tone="info" />
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> DISTRIBUIÇÃO DE PLANOS
          </p>
          <div className="space-y-3">
            <PlanBar label="Mensal" value={stats.monthly} total={stats.total} color="bg-blue-500" />
            <PlanBar label="Anual" value={stats.yearly} total={stats.total} color="bg-emerald-500" />
            <PlanBar label="Sem plano" value={stats.total - stats.monthly - stats.yearly} total={stats.total} color="bg-muted-foreground/40" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> SAÚDE DA BASE
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Taxa Ativos" value={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}%`} />
            <MiniStat label="Taxa Conversão" value={`${stats.total ? Math.round(((stats.monthly + stats.yearly) / stats.total) * 100) : 0}%`} />
            <MiniStat label="Capital Total" value={`R$ ${(stats.totalLoaned / 1000).toFixed(1)}k`} />
            <MiniStat label="Lucro Total" value={`R$ ${(stats.totalProfit / 1000).toFixed(1)}k`} />
          </div>
        </div>
      </div>

      {/* Filters tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              tab === t.key ? "bg-primary-foreground/20" : "bg-accent"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search + bulk bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-xs font-medium text-foreground">{selected.size} selecionado(s)</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">Ações</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações em massa</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => bulkBlock(true)}><Ban size={14} className="mr-2" />Bloquear</DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkBlock(false)}><CheckCircle size={14} className="mr-2" />Desbloquear</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => bulkExtend(7)}>+7 dias de assinatura</DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkExtend(30)}>+30 dias de assinatura</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setNotifyOpen(true)}>
                  <Mail size={14} className="mr-2" />Enviar notificação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border">
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-foreground font-medium">Nenhum usuário encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou a busca.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-accent/40">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Usuário</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Plano</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Expira</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Cadastro</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const expired = isExpired(u);
                  const checked = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`border-t border-border hover:bg-accent/20 transition-colors ${checked ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(u.id)}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-semibold text-foreground overflow-hidden flex-shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              u.name?.charAt(0)?.toUpperCase() || "U"
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-foreground font-medium truncate">{u.name}</p>
                              {u.is_admin && (
                                <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary/50 text-primary">
                                  ADMIN
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{u.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.subscription_type || "monthly"}
                          onChange={(e) => handleSetSubscription(u.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded-md bg-input border border-border text-foreground"
                        >
                          <option value="monthly">Mensal</option>
                          <option value="yearly">Anual</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {u.subscription_expires_at ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className={expired ? "text-destructive" : "text-muted-foreground"} />
                            <span className={`text-xs ${expired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {new Date(u.subscription_expires_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_blocked ? (
                          <Badge className="bg-destructive/15 text-destructive border-0 hover:bg-destructive/20">Bloqueado</Badge>
                        ) : expired ? (
                          <Badge className="bg-amber-500/15 text-amber-500 border-0 hover:bg-amber-500/20">Expirado</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border-0 hover:bg-emerald-500/20">Ativo</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailUser(u)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmAction({
                                title: u.is_blocked ? "Desbloquear usuário?" : "Bloquear usuário?",
                                description: u.is_blocked
                                  ? `${u.name} voltará a ter acesso ao sistema.`
                                  : `${u.name} perderá acesso ao sistema imediatamente.`,
                                onConfirm: () => handleToggleBlock(u.id, u.is_blocked),
                              })
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.is_blocked
                                ? "text-emerald-500 hover:bg-emerald-500/15"
                                : "text-destructive hover:bg-destructive/15"
                            }`}
                            title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                          >
                            {u.is_blocked ? <CheckCircle size={15} /> : <Ban size={15} />}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                <MoreVertical size={15} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="text-xs">{u.name}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleExtendSubscription(u.id, 7)}>
                                <Calendar size={14} className="mr-2" /> +7 dias
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtendSubscription(u.id, 30)}>
                                <Calendar size={14} className="mr-2" /> +30 dias
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtendSubscription(u.id, 365)}>
                                <Calendar size={14} className="mr-2" /> +1 ano
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleChatBlock(u.id, u.is_chat_blocked)}>
                                <MessageCircle size={14} className="mr-2" />
                                {u.is_chat_blocked ? "Liberar chat" : "Bloquear chat"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({
                                    title: u.is_admin ? "Remover admin?" : "Promover a admin?",
                                    description: u.is_admin
                                      ? `${u.name} perderá acesso administrativo.`
                                      : `${u.name} terá acesso total ao sistema.`,
                                    onConfirm: () => handleToggleAdmin(u.id, u.is_admin),
                                  })
                                }
                              >
                                <Crown size={14} className="mr-2" />
                                {u.is_admin ? "Remover admin" : "Tornar admin"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-foreground font-semibold overflow-hidden">
                {detailUser?.avatar_url ? (
                  <img src={detailUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  detailUser?.name?.charAt(0)?.toUpperCase()
                )}
              </div>
              {detailUser?.name}
            </DialogTitle>
            <DialogDescription>{detailUser?.email}</DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-3 text-sm">
              <DetailRow label="ID" value={detailUser.id} mono />
              <DetailRow label="Plano" value={detailUser.subscription_type === "yearly" ? "Anual" : "Mensal"} />
              <DetailRow
                label="Expira em"
                value={
                  detailUser.subscription_expires_at
                    ? new Date(detailUser.subscription_expires_at).toLocaleString("pt-BR")
                    : "—"
                }
              />
              <DetailRow label="Cadastrado em" value={new Date(detailUser.created_at).toLocaleString("pt-BR")} />
              <DetailRow label="Capital emprestado" value={`R$ ${Number(detailUser.loan_balance || 0).toFixed(2)}`} />
              <DetailRow label="Lucro acumulado" value={`R$ ${Number(detailUser.profit_balance || 0).toFixed(2)}`} />
              <DetailRow label="Despesas" value={`R$ ${Number(detailUser.expense_balance || 0).toFixed(2)}`} />
              <div className="flex flex-wrap gap-2 pt-2">
                {detailUser.is_admin && <Badge className="bg-primary/20 text-primary border-0">Admin</Badge>}
                {detailUser.is_blocked && <Badge className="bg-destructive/20 text-destructive border-0">Bloqueado</Badge>}
                {detailUser.is_chat_blocked && <Badge className="bg-muted text-muted-foreground border-0">Chat bloqueado</Badge>}
                {isExpired(detailUser) && <Badge className="bg-amber-500/20 text-amber-500 border-0">Expirado</Badge>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar notificação</DialogTitle>
            <DialogDescription>
              A mensagem será enviada para {selected.size} usuário(s) selecionado(s).
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={notifyMsg}
            onChange={(e) => setNotifyMsg(e.target.value)}
            rows={4}
            placeholder="Digite a mensagem..."
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Cancelar</Button>
            <Button onClick={bulkNotify} disabled={!notifyMsg.trim()}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
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

// ============= sub components =============
const toneMap = {
  primary: "from-primary/20 to-primary/5 text-primary",
  success: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
  danger: "from-destructive/20 to-destructive/5 text-destructive",
  warning: "from-amber-500/20 to-amber-500/5 text-amber-500",
  accent: "from-purple-500/20 to-purple-500/5 text-purple-400",
  info: "from-sky-500/20 to-sky-500/5 text-sky-400",
} as const;

const KpiCard = ({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number; tone: keyof typeof toneMap }) => (
  <div className="rounded-2xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${toneMap[tone]} flex items-center justify-center mb-2`}>
      <Icon size={16} />
    </div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
  </div>
);

const PlanBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-accent/30 p-3">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
  </div>
);

const DetailRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between items-start gap-3 py-1.5 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-xs text-foreground text-right ${mono ? "font-mono" : ""} truncate max-w-[60%]`}>{value}</span>
  </div>
);

export default Admin;
