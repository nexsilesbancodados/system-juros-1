import { Bell, TrendingUp, LogOut, Sun, Moon, Search, Wallet, User, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

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
    for (const id of unreadIds) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    }
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
    <header className="h-14 border-b border-border/50 bg-card/80 glass flex items-center justify-between px-3 lg:px-6 gap-2">
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
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-accent/50 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent transition-all duration-200 micro-bounce"
        >
          <Search size={14} />
          <span className="hidden sm:inline text-[13px]">Buscar...</span>
          <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md bg-muted font-mono ml-3 text-muted-foreground/70">⌘K</kbd>
        </button>
      )}

      <div className="flex-1" />

      {!isMobile && (
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet size={14} className="text-primary/70" />
            <span className="font-medium">R$ {fmt(Number(profile?.loan_balance || 0))}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp size={14} className="text-success" />
            <span className="font-medium">R$ {fmt(Number(profile?.profit_balance || 0))}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5">
        {isMobile && (
          <button onClick={onSearchClick} className="p-2 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground">
            <Search size={18} />
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground"
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground relative"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold notif-bounce">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className={`absolute ${isMobile ? "right-0 left-0 mx-3 fixed top-14" : "right-0 top-12 w-80"} max-h-96 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-scale-in`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky-header">
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
                        className={`px-4 py-3 border-b border-border/50 last:border-0 transition-colors cursor-pointer hover:bg-accent/30 ${!n.is_read ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && <span className="status-dot status-dot-success mt-1.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              {n.from} · {timeAgo(n.created_at)}
                            </p>
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
              className="w-8 h-8 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary hover:ring-2 hover:ring-primary/30 transition-all duration-200 ml-1 micro-bounce"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-xl object-cover" />
              ) : (
                profile?.name?.charAt(0)?.toUpperCase() || "U"
              )}
            </button>
            <button onClick={handleSignOut} className="p-2 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-destructive" title="Sair">
              <LogOut size={17} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default TopBar;
