import { useState, useEffect, useRef } from "react";
import { TrendingUp, LogOut, Sun, Moon, Search, Wallet, User, Settings, Plus, Users, Receipt, Landmark, UserPlus, ListTodo, Calculator, ChevronDown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMultiTableRealtime } from "@/hooks/useRealtimeSubscription";
import NotificationsBell from "./NotificationsBell";
import LanguageSwitcher from "./LanguageSwitcher";
import { fetchAll } from "@/lib/fetchAll";

interface TopBarProps {
  onSearchClick?: () => void;
}

const TopBar = ({ onSearchClick }: TopBarProps) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quickOpen) return;
    const handler = (e: MouseEvent) => {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setQuickOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [quickOpen]);

  const { data: financials } = useQuery({
    queryKey: ["topbar-financials", user?.id],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [contracts, profits, overdueRes] = await Promise.all([
        fetchAll((f, t) => supabase.from("contracts").select("capital, status").eq("user_id", user!.id).range(f, t)),
        fetchAll((f, t) => supabase.from("profits").select("amount").eq("user_id", user!.id).eq("status", "available").range(f, t)),
        supabase.from("contract_installments").select("id", { count: "exact", head: true })
          .eq("user_id", user!.id).eq("status", "pending").lt("due_date", nowIso),
      ]);
      const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "overdue");
      const carteira = activeContracts.reduce((s: number, c: any) => s + Number(c.capital), 0);
      const lucro = profits.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const overdue = overdueRes.count || 0;
      return { carteira, lucro, overdue };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  useMultiTableRealtime(
    ["contracts", "profits", "contract_installments"],
    [["topbar-financials", user?.id]],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border/40 bg-card/70 glass-strong flex items-center justify-between px-3 lg:px-8 gap-2">
      {isMobile ? (
        <button onClick={() => navigate("/perfil")} className="flex items-center gap-2 micro-bounce min-w-0 max-w-[60%]">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <User size={16} className="text-primary" />
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium leading-none">Olá,</p>
            <p className="text-[13px] font-bold text-foreground leading-tight truncate">{profile?.name?.split(" ")[0] || "Usuário"}</p>
          </div>
        </button>
      ) : (
        <button
          data-tour="topbar-search"
          onClick={onSearchClick}
          className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-muted/40 border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/60 transition-all duration-300"
        >
          <Search size={14} className="text-muted-foreground/60 group-hover:text-primary transition-colors" />
          <span className="hidden sm:inline text-[13px]">Buscar...</span>
          <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 font-mono ml-4 text-muted-foreground/50 border border-border/30">⌘K</kbd>
        </button>
      )}


      <div className="flex-1" />

      {/* Financial indicators — pill compacto unificado */}
      {!isMobile && (
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => navigate("/carteira")}
            className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-muted/40 border border-border/40 hover:border-primary/50 hover:bg-primary/8 transition-all duration-200 hover-lift"
            title="Ver Carteira"
          >
            <Wallet size={14} className="text-primary/70 group-hover:text-primary transition-colors" />
            <span className="text-[12px] font-semibold tracking-tight text-muted-foreground group-hover:text-foreground transition-colors">R$ {fmt(financials?.carteira ?? 0)}</span>
          </button>
          <button
            onClick={() => navigate("/lucros")}
            className="hidden lg:flex group items-center gap-2 px-3.5 py-2 rounded-full bg-success/8 border border-success/20 hover:border-success/50 hover:bg-success/12 transition-all duration-200 hover-lift"
            title="Ver Lucros"
          >
            <TrendingUp size={14} className="text-success/80 group-hover:text-success transition-colors" />
            <span className="text-[12px] font-semibold tracking-tight text-success">R$ {fmt(financials?.lucro ?? 0)}</span>
          </button>
          {(financials?.overdue ?? 0) > 0 && (
            <button
              onClick={() => navigate("/cobrancas?tab=aging")}
              className="group flex items-center gap-2 px-3 py-2 rounded-full bg-destructive/8 border border-destructive/25 hover:border-destructive/50 hover:bg-destructive/12 transition-all duration-200 hover-lift"
              title="Ver Inadimplência"
            >
              <AlertTriangle size={14} className="text-destructive/80 group-hover:text-destructive transition-colors" />
              <span className="text-[12px] font-bold tracking-tight text-destructive">{financials?.overdue}</span>
            </button>
          )}
        </div>
      )}


      {/* Quick Add Menu */}
      {!isMobile && (
        <div ref={quickRef} className="relative flex items-center mr-2">
          <button
            onClick={() => setQuickOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[11px] font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
            aria-haspopup="menu"
            aria-expanded={quickOpen}
          >
            <Plus size={14} /> Novo
            <ChevronDown size={11} className={`transition-transform ${quickOpen ? "rotate-180" : ""}`} />
          </button>
          {quickOpen && (
            <div className="absolute top-full right-0 mt-2 w-60 rounded-xl border border-border bg-card shadow-2xl overflow-hidden z-50 animate-scale-in origin-top-right">
              <p className="px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Ações rápidas</p>
              {[
                { Icon: UserPlus, label: "Novo cliente", desc: "Cadastrar + contrato", path: "/clientes/novo" },
                { Icon: Receipt, label: "Registrar pagamento", desc: "Abrir cobranças", path: "/cobrancas" },
                { Icon: TrendingUp, label: "Lançar lucro", desc: "Entrada manual", path: "/lucros" },
                { Icon: Wallet, label: "Lançar gasto", desc: "Despesa manual", path: "/gastos" },
                { Icon: ListTodo, label: "Nova tarefa", desc: "Lembretes & to-dos", path: "/ferramentas/tarefas" },
                { Icon: Calculator, label: "Simular empréstimo", desc: "Calcular juros", path: "/ferramentas/simulador" },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => { setQuickOpen(false); navigate(item.path); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <item.Icon size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setQuickOpen(false); onSearchClick?.(); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40 text-[11px] text-muted-foreground hover:bg-accent/30 transition-colors"
              >
                <span className="flex items-center gap-2"><Search size={12} /> Buscar tudo</span>
                <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-mono">⌘K</kbd>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {isMobile && (
          <button onClick={onSearchClick} aria-label="Buscar" className="p-2 rounded-full hover:bg-muted/50 transition-all duration-200 text-muted-foreground hover:text-foreground">
            <Search size={18} />
          </button>
        )}

        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className="relative p-2 rounded-full hover:bg-muted/50 transition-all duration-200 text-muted-foreground hover:text-foreground group"
        >
          <span className="relative block w-[18px] h-[18px]">
            <Sun size={18} className={`absolute inset-0 transition-all duration-300 ${theme === "dark" ? "opacity-0 -rotate-90 scale-75" : "opacity-100 rotate-0 scale-100 text-amber-500"}`} />
            <Moon size={18} className={`absolute inset-0 transition-all duration-300 ${theme === "dark" ? "opacity-100 rotate-0 scale-100 text-primary" : "opacity-0 rotate-90 scale-75"}`} />
          </span>
        </button>

        <LanguageSwitcher />
        <NotificationsBell />

        {!isMobile && <UserMenu profile={profile} theme={theme} toggleTheme={toggleTheme} onSignOut={handleSignOut} navigate={navigate} isAdmin={!!profile?.is_admin} />}

      </div>
    </header>
  );
};

interface UserMenuProps {
  profile: any;
  theme: string;
  toggleTheme: () => void;
  onSignOut: () => void;
  navigate: (path: string) => void;
  isAdmin: boolean;
}

const UserMenu = ({ profile, theme, toggleTheme, onSignOut, navigate, isAdmin }: UserMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Menu do usuário"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary ring-1 ring-primary/20 hover:ring-2 hover:ring-primary/40 transition-all duration-200 micro-bounce"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          profile?.name?.charAt(0)?.toUpperCase() || "U"
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-border bg-card shadow-2xl overflow-hidden z-50 animate-scale-in origin-top-right" role="menu">
          <div className="px-3 py-3 border-b border-border/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <User size={18} className="text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate">{profile?.name || "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.email || ""}</p>
            </div>
          </div>

          <button onClick={() => go("/perfil")} role="menuitem" className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors text-[12px] text-foreground">
            <User size={14} className="text-muted-foreground" /> Meu perfil
          </button>
          {isAdmin && (
            <button onClick={() => go("/configuracoes")} role="menuitem" className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors text-[12px] text-foreground">
              <Settings size={14} className="text-muted-foreground" /> Configurações
            </button>
          )}
          <button onClick={toggleTheme} role="menuitem" className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors text-[12px] text-foreground">
            <span className="flex items-center gap-2.5">
              {theme === "dark" ? <Sun size={14} className="text-muted-foreground" /> : <Moon size={14} className="text-muted-foreground" />}
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </span>
          </button>
          <div className="border-t border-border/40">
            <button onClick={onSignOut} role="menuitem" className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-destructive/10 transition-colors text-[12px] text-destructive font-semibold">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


export default TopBar;
