import { Bell, TrendingUp, LogOut, Sun, Moon, Search, Wallet, User, Check, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";

interface TopBarProps {
  onSearchClick?: () => void;
}

const TopBar = ({ onSearchClick }: TopBarProps) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const { data: financials } = useQuery({
    queryKey: ["topbar-financials", user?.id],
    queryFn: async () => {
      const [contractsRes, profitsRes] = await Promise.all([
        supabase.from("contracts").select("capital, status").eq("user_id", user!.id),
        supabase.from("profits").select("amount").eq("user_id", user!.id).eq("status", "available"),
      ]);
      const activeContracts = (contractsRes.data || []).filter((c: any) => c.status === "active" || c.status === "overdue");
      const carteira = activeContracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
      const lucro = (profitsRes.data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      return { carteira, lucro };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
    };
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev]);
        setUnreadCount((prev) => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <header className="h-14 border-b border-border/30 bg-card/60 glass-strong flex items-center justify-between px-3 lg:px-6 gap-3">
      {isMobile ? (
        <button onClick={() => navigate("/perfil")} className="flex items-center gap-2.5 micro-bounce">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <User size={18} className="text-primary" />
            )}
          </div>
          <div className="text-left">
            <p className="text-[11px] text-muted-foreground font-medium">Olá,</p>
            <p className="text-sm font-bold text-foreground leading-tight">{profile?.name?.split(" ")[0] || "Usuário"}</p>
          </div>
        </button>
      ) : (
        <button
          onClick={onSearchClick}
          className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-muted/40 border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/60 transition-all duration-300"
        >
          <Search size={14} className="text-muted-foreground/60 group-hover:text-primary transition-colors" />
          <span className="hidden sm:inline text-[13px]">Buscar...</span>
          <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 font-mono ml-4 text-muted-foreground/50 border border-border/30">⌘K</kbd>
        </button>
      )}

      <div className="flex-1" />

      {/* Financial indicators */}
      {!isMobile && (
        <div className="hidden md:flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/30">
            <Wallet size={13} className="text-primary/60" />
            <span className="text-[11px] font-semibold text-muted-foreground">R$ {fmt(financials?.carteira ?? 0)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/5 border border-success/10">
            <TrendingUp size={13} className="text-success/70" />
            <span className="text-[11px] font-semibold text-success">R$ {fmt(financials?.lucro ?? 0)}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {isMobile && (
          <button onClick={onSearchClick} className="p-2.5 rounded-full hover:bg-muted/50 transition-all duration-200 text-muted-foreground hover:text-foreground">
            <Search size={18} />
          </button>
        )}

        <button
          onClick={() => navigate("/configuracoes")}
          className="p-2.5 rounded-full hover:bg-muted/50 transition-all duration-200 text-muted-foreground/60 hover:text-foreground hover:rotate-45"
          style={{ transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
          title="Configurações"
        >
          <Settings size={17} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full hover:bg-muted/50 transition-all duration-200 text-muted-foreground/60 hover:text-foreground"
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-full hover:bg-muted/50 transition-all duration-200 text-muted-foreground/60 hover:text-foreground relative"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className={`absolute ${isMobile ? "right-0 left-0 mx-3 fixed top-14" : "right-0 top-12 w-80"} max-h-96 bg-card border border-border/50 rounded-2xl shadow-lg z-50 overflow-hidden animate-scale-in`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 sticky-header">
                  <span className="text-sm font-semibold text-foreground">Notificações</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-1">
                      <Check size={10} /> Marcar lidas
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-72">
                  {notifications.length === 0 ? (
                    <div className="empty-state py-10">
                      <div className="empty-state-icon !w-12 !h-12">
                        <Bell size={20} className="text-muted-foreground/30" />
                      </div>
                      <p className="text-sm text-muted-foreground">Sem notificações</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { if (n.link) navigate(n.link); setShowNotifications(false); }}
                        className={`px-4 py-3 border-b border-border/30 last:border-0 transition-colors cursor-pointer hover:bg-accent/30 ${!n.is_read ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && <span className="status-dot status-dot-success mt-1.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{n.from} · {timeAgo(n.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!isMobile && (
          <>
            <button
              onClick={() => navigate("/perfil")}
              className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary hover:ring-2 hover:ring-primary/30 transition-all duration-200 ml-1 micro-bounce"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                profile?.name?.charAt(0)?.toUpperCase() || "U"
              )}
            </button>
            <button onClick={handleSignOut} className="p-2.5 rounded-full hover:bg-destructive/10 transition-all duration-200 text-muted-foreground/60 hover:text-destructive" title="Sair">
              <LogOut size={17} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default TopBar;
