import { TrendingUp, LogOut, Sun, Moon, Search, Wallet, User, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import NotificationsBell from "./NotificationsBell";

interface TopBarProps {
  onSearchClick?: () => void;
}

const TopBar = ({ onSearchClick }: TopBarProps) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

      {/* Financial indicators - clickable */}
      {!isMobile && (
        <div className="hidden md:flex items-center gap-1.5">
          <button
            onClick={() => navigate("/carteira")}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
            title="Ver Carteira"
          >
            <Wallet size={13} className="text-primary/60 group-hover:text-primary transition-colors" />
            <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">R$ {fmt(financials?.carteira ?? 0)}</span>
          </button>
          <button
            onClick={() => navigate("/lucros")}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/5 border border-success/10 hover:border-success/40 hover:bg-success/10 transition-all duration-200"
            title="Ver Lucros"
          >
            <TrendingUp size={13} className="text-success/70 group-hover:text-success transition-colors" />
            <span className="text-[11px] font-semibold text-success">R$ {fmt(financials?.lucro ?? 0)}</span>
          </button>
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

        <NotificationsBell />

        {!isMobile && (
          <>
            <button
              onClick={() => navigate("/perfil")}
              className="relative w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary ring-1 ring-primary/20 hover:ring-2 hover:ring-primary/40 transition-all duration-200 ml-1 micro-bounce"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                profile?.name?.charAt(0)?.toUpperCase() || "U"
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
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
