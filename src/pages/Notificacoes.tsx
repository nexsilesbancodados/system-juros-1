import { useEffect, useMemo, useState } from "react";
import { Bell, Search, CheckCheck, Trash2, Filter, AlertCircle, AlertTriangle, CheckCircle2, Info, MessageSquare, DollarSign, Users, Settings as SettingsIcon, Sparkles, ExternalLink, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";

interface NotificationItem {
  id: string;
  message: string;
  from: string;
  type: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const typeMeta = (type?: string | null) => {
  const t = (type || "info").toLowerCase();
  if (t === "success" || t === "payment" || t === "paid") return { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", ring: "ring-success/20", label: "Sucesso" };
  if (t === "warning" || t === "warn" || t === "overdue" || t === "due") return { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", ring: "ring-warning/20", label: "Atenção" };
  if (t === "error" || t === "danger" || t === "blocked") return { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/20", label: "Erro" };
  if (t === "support" || t === "ticket") return { icon: MessageSquare, color: "text-info", bg: "bg-info/10", ring: "ring-info/20", label: "Suporte" };
  if (t === "billing" || t === "subscription") return { icon: DollarSign, color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20", label: "Cobrança" };
  if (t === "client") return { icon: Users, color: "text-cyan-400", bg: "bg-cyan-400/10", ring: "ring-cyan-400/20", label: "Cliente" };
  if (t === "system") return { icon: SettingsIcon, color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border", label: "Sistema" };
  if (t === "broadcast" || t === "announcement") return { icon: Sparkles, color: "text-violet-400", bg: "bg-violet-400/10", ring: "ring-violet-400/20", label: "Comunicado" };
  return { icon: Info, color: "text-info", bg: "bg-info/10", ring: "ring-info/20", label: "Info" };
};

const typeFilters = [
  { value: "all", label: "Todos", icon: Bell },
  { value: "info", label: "Info", icon: Info },
  { value: "success", label: "Sucesso", icon: CheckCircle2 },
  { value: "warning", label: "Atenção", icon: AlertTriangle },
  { value: "error", label: "Erro", icon: AlertCircle },
  { value: "support", label: "Suporte", icon: MessageSquare },
  { value: "billing", label: "Cobrança", icon: DollarSign },
  { value: "broadcast", label: "Comunicado", icon: Sparkles },
];

const PAGE_SIZE = 30;

const Notificacoes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setItems((data || []) as NotificationItem[]);
      setLoading(false);
    };
    fetchAll();

    const channel = supabase
      .channel("notif-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (statusFilter === "unread" && n.is_read) return false;
      if (statusFilter === "read" && !n.is_read) return false;
      if (typeFilter !== "all" && (n.type || "info").toLowerCase() !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.message.toLowerCase().includes(q) && !(n.from || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, typeFilter, search]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = filtered.length > paginated.length;

  const stats = useMemo(() => ({
    total: items.length,
    unread: items.filter((n) => !n.is_read).length,
    today: items.filter((n) => new Date(n.created_at).toDateString() === new Date().toDateString()).length,
  }), [items]);

  const allSelectedOnPage = paginated.length > 0 && paginated.every((n) => selected.has(n.id));
  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      const next = new Set(selected);
      paginated.forEach((n) => next.delete(n.id));
      setSelected(next);
    } else {
      setSelected(new Set([...selected, ...paginated.map((n) => n.id)]));
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const markRead = async (ids: string[], read: boolean) => {
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: read } : n)));
    await supabase.from("notifications").update({ is_read: read }).in("id", ids);
    toast.success(`${ids.length} ${read ? "marcadas como lidas" : "marcadas como não lidas"}`);
  };

  const remove = async (ids: string[]) => {
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    setSelected(new Set());
    await supabase.from("notifications").delete().in("id", ids);
    toast.success(`${ids.length} excluída${ids.length > 1 ? "s" : ""}`);
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-3 lg:p-6 space-y-5">
      {/* Header */}
      <div className="page-hero animate-fade-in">
        <div className="page-hero-content flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="page-hero-icon">
              <Bell size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-shimmer">Notificações</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Central de notificações — todas as atividades em um só lugar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.unread > 0 && (
              <button
                onClick={() => markRead(items.filter((n) => !n.is_read).map((n) => n.id), true)}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition flex items-center gap-1.5 border border-primary/20"
              >
                <CheckCheck size={14} /> Marcar todas ({stats.unread})
              </button>
            )}
            {items.some((n) => n.is_read) && (
              <button
                onClick={() => remove(items.filter((n) => n.is_read).map((n) => n.id))}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-muted/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Limpar lidas
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-left rounded-2xl border p-4 transition ${statusFilter === "all" ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-border/80"}`}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
        </button>
        <button
          onClick={() => setStatusFilter("unread")}
          className={`text-left rounded-2xl border p-4 transition ${statusFilter === "unread" ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-border/80"}`}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Não lidas</div>
          <div className="text-2xl font-bold text-primary mt-1">{stats.unread}</div>
        </button>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Hoje</div>
          <div className="text-2xl font-bold text-success mt-1">{stats.today}</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por mensagem ou remetente..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={12} className="text-muted-foreground mr-1" />
          {typeFilters.map((f) => {
            const Icon = f.icon;
            const active = typeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon size={11} /> {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <span className="text-sm font-semibold text-foreground">
            {selected.size} selecionada{selected.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => markRead(Array.from(selected), true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-card hover:bg-muted/50 transition flex items-center gap-1.5"
            >
              <Check size={12} /> Marcar lidas
            </button>
            <button
              onClick={() => remove(Array.from(selected))}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Excluir
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-2 py-1.5 rounded-lg hover:bg-muted/50 transition text-muted-foreground"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {paginated.length > 0 && (
          <div className="px-4 py-2.5 border-b border-border/40 bg-muted/10 flex items-center gap-3">
            <input
              type="checkbox"
              checked={allSelectedOnPage}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
            />
            <span className="text-[11px] text-muted-foreground font-semibold">
              {allSelectedOnPage ? "Desmarcar todas" : "Selecionar todas"}
            </span>
            <span className="text-[11px] text-muted-foreground/60 ml-auto">
              Mostrando {paginated.length} de {filtered.length}
            </span>
          </div>
        )}
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-muted/40" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted/40 rounded w-3/4" />
                  <div className="h-2 bg-muted/30 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação encontrada"
            description={search || typeFilter !== "all" || statusFilter !== "all"
              ? "Tente ajustar os filtros para ver mais resultados."
              : "Quando algo acontecer, aparecerá aqui."}
          />
        ) : (
          <div className="divide-y divide-border/30">
            {paginated.map((n) => {
              const meta = typeMeta(n.type);
              const Icon = meta.icon;
              const isSelected = selected.has(n.id);
              return (
                <div
                  key={n.id}
                  className={`group px-4 py-3 transition-all hover:bg-accent/30 ${!n.is_read ? "bg-primary/[0.03]" : ""} ${isSelected ? "bg-primary/[0.08]" : ""}`}
                >
                  <div className="flex gap-3 items-start">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(n.id)}
                      className="w-4 h-4 mt-3 rounded accent-primary cursor-pointer shrink-0"
                    />
                    <div className={`shrink-0 w-10 h-10 rounded-xl ${meta.bg} ring-1 ${meta.ring} flex items-center justify-center`}>
                      <Icon size={16} className={meta.color} />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (!n.is_read) markRead([n.id], true);
                        if (n.link) navigate(n.link);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <p className={`text-sm leading-snug flex-1 ${!n.is_read ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                          {n.message}
                        </p>
                        {!n.is_read && <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">{n.from}</span>
                        <span className="text-[10px] text-muted-foreground/40">·</span>
                        <span className="text-[11px] text-muted-foreground/70">{fmtDate(n.created_at)}</span>
                        {n.link && (
                          <span className="text-[10px] text-primary/80 ml-auto flex items-center gap-1">
                            <ExternalLink size={9} /> Abrir
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => markRead([n.id], !n.is_read)}
                        className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-success transition"
                        title={n.is_read ? "Marcar não lida" : "Marcar lida"}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => remove([n.id])}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={() => setPage(page + 1)}
                  className="text-xs font-semibold px-4 py-2 rounded-xl bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition"
                >
                  Carregar mais ({filtered.length - paginated.length} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notificacoes;
