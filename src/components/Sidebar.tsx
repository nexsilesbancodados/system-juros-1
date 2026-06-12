import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eagleLogo from "@/assets/eagle-logo.webp";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, BarChart3, Users, Receipt, Wallet,
  TrendingUp, DollarSign, Database, Info, Search, X,
  Target, Calculator, CheckSquare, StickyNote, Table, ChevronDown,
  FileText, Crown, ClipboardList, Sparkles,
  Settings, Bot, QrCode, UserCheck, Shield,
  Briefcase, PieChart, Cog, LogOut, User, LifeBuoy, MessageCircle,
  AlertTriangle, ChevronLeft, Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { isSuperAdminEmail } from "@/lib/admin";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useToast } from "@/hooks/use-toast";

interface MenuItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
  highlight?: boolean;
  shortcut?: string;
}

interface MenuSection {
  title: string;
  sectionIcon?: LucideIcon;
  items: MenuItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

// Paleta unificada — 4 tons semânticos
const iconColorMap: Record<string, string> = {
  // destaque / inteligência
  "/hoje": "text-amber-400",
  "/comunicacao": "text-violet-400",
  "/comunicacao/inbox": "text-violet-400",
  "/chat": "text-violet-400",
  // positivo / financeiro
  "/carteira": "text-emerald-400",
  "/lucros": "text-emerald-400",
  // alerta
  "/inadimplencia": "text-rose-400",
  "/gastos": "text-rose-400",
  // admin / sistema
  "/admin": "text-amber-300",
  "/auditoria": "text-amber-300",
};

const sections: MenuSection[] = [
  {
    title: "Principal",
    sectionIcon: PieChart,
    items: [
      { label: "Hoje", icon: Sparkles, path: "/hoje", highlight: true, shortcut: "h" },
      { label: "Painel", icon: LayoutDashboard, path: "/dashboard", shortcut: "1" },
      { label: "Análises", icon: BarChart3, path: "/analises", shortcut: "2" },
      { label: "Relatórios", icon: FileText, path: "/relatorios", shortcut: "3" },
    ],
  },
  {
    title: "Operações",
    sectionIcon: Briefcase,
    items: [
      { label: "Clientes", icon: Users, path: "/clientes", shortcut: "4" },
      { label: "Cobranças", icon: Receipt, path: "/cobrancas", shortcut: "5" },
      { label: "Inadimplência", icon: AlertTriangle, path: "/inadimplencia" },
      { label: "Cobradores", icon: UserCheck, path: "/cobradores" },
      { label: "Portais", icon: QrCode, path: "/qrcode" },
    ],
  },
  {
    title: "Financeiro",
    sectionIcon: DollarSign,
    items: [
      { label: "Carteira", icon: Wallet, path: "/carteira" },
      { label: "Lucros", icon: TrendingUp, path: "/lucros" },
      { label: "Gastos", icon: DollarSign, path: "/gastos" },
    ],
  },
  {
    title: "Comunicação",
    sectionIcon: Bot,
    items: [
      { label: "Comunicação & IA", icon: Bot, path: "/comunicacao", highlight: true },
      { label: "Inbox WhatsApp", icon: MessageCircle, path: "/comunicacao/inbox" },
      { label: "Chat interno", icon: MessageCircle, path: "/chat" },
    ],
  },
  {
    title: "Ferramentas",
    sectionIcon: Wrench,
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Simulador", icon: Calculator, path: "/ferramentas/simulador" },
      { label: "Metas", icon: Target, path: "/ferramentas/metas" },
      { label: "Tarefas", icon: CheckSquare, path: "/ferramentas/tarefas" },
      { label: "Anotações", icon: StickyNote, path: "/ferramentas/anotacoes" },
      { label: "Planilha", icon: Table, path: "/ferramentas/planilha" },
      { label: "Puxada de Dados", icon: Database, path: "/puxada-dados" },
    ],
  },
  {
    title: "Sistema",
    sectionIcon: Cog,
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
      { label: "Suporte", icon: LifeBuoy, path: "/suporte" },
      { label: "Sobre", icon: Info, path: "/sobre" },
      { label: "Auditoria", icon: Shield, path: "/auditoria" },
      { label: "Histórico", icon: ClipboardList, path: "/historico" },
      { label: "Admin", icon: Crown, path: "/admin" },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar = ({ collapsed = false, onToggleCollapse }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();
  const { config } = useWhiteLabel();
  const logoSrc = config.companyLogo || eagleLogo;
  const brandName = config.companyName || "SYSTEM JUROS";
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const chatUnread = useChatUnread();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  // Filtra item "Admin" do menu para usuários comuns
  const visibleSections = useMemo(() =>
    sections.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (i.path === "/admin") return isSuperAdmin;
        if (["/auditoria", "/historico"].includes(i.path)) return profile?.is_admin;
        return true;
      }),
    })), [isSuperAdmin, profile?.is_admin]);

  // Filtra por busca
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return visibleSections;
    const q = searchQuery.toLowerCase();
    return visibleSections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [visibleSections, searchQuery]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const renderItem = (item: MenuItem) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    const badge = item.path === "/chat" && chatUnread > 0 ? chatUnread : item.badge || 0;
    const colorClass = iconColorMap[item.path] || "text-muted-foreground";

    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        title={collapsed ? item.label : undefined}
        className={`
          group relative w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[13px] font-medium
          transition-all duration-300 ease-out
          ${active
            ? "text-foreground sidebar-item-active"
            : "text-muted-foreground hover:text-foreground"
          }
          ${collapsed ? "justify-center px-2" : ""}
        `}
      >
        {/* Indicador ativo - barra lateral */}
        {active && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
        )}

        {/* Container do ícone */}
        <div
          className={`
            relative w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0
            transition-all duration-300 ease-out
            ${active
              ? "bg-primary/20 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.25)]"
              : `${colorClass} group-hover:bg-accent/40 group-hover:shadow-[0_0_12px_hsl(var(--primary)/0.1)] group-hover:scale-105`
            }
          `}
        >
          <Icon size={17} strokeWidth={active ? 2.5 : 2} />

          {/* Badge no ícone (modo collapsed) */}
          {badge > 0 && collapsed && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-card animate-pulse">
              {badge > 9 ? "9+" : badge}
            </span>
          )}

          {/* Highlight dot */}
          {item.highlight && !active && !collapsed && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] animate-pulse" />
          )}
        </div>

        {/* Label */}
        {!collapsed && (
          <span className="truncate flex-1 text-left transition-all duration-200">
            {item.label}
          </span>
        )}

        {/* Badge (modo expandido) */}
        {!collapsed && badge > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive/90 text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse shrink-0 shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        )}

        {/* Shortcut */}
        {!collapsed && item.shortcut && !active && !searchQuery && (
          <kbd className="hidden lg:inline-flex h-5 px-1.5 rounded-md bg-muted text-[10px] font-mono text-muted-foreground/60 items-center border border-border/30">
            {item.shortcut}
          </kbd>
        )}

        {/* Tooltip no modo collapsed */}
        {collapsed && (
          <div
            className="
              absolute left-full ml-3 px-3.5 py-2.5 rounded-xl
              bg-popover/95 backdrop-blur-xl border border-border/40
              text-[13px] text-foreground font-medium whitespace-nowrap
              opacity-0 pointer-events-none
              group-hover:opacity-100 group-hover:pointer-events-auto
              transition-all duration-200 ease-out
              shadow-2xl z-50 translate-x-2 group-hover:translate-x-0
              before:absolute before:-left-1 before:top-1/2 before:-translate-y-1/2
              before:w-2 before:h-2 before:bg-popover/95 before:rotate-45
              before:border-l before:border-b before:border-border/40
            "
          >
            {item.label}
            {badge > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                {badge}
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  const renderSection = (section: MenuSection, index: number) => {
    const sectionHasActive = section.items.some((i) => isActive(i.path));
    const SectionIcon = section.sectionIcon;

    return (
      <div key={section.title} className={index > 0 ? "mt-1" : ""}>
        {/* Cabeçalho da seção */}
        {!collapsed && (
          <div
            className={`
              flex items-center gap-2 px-3 py-2 mb-1
              transition-colors duration-200
            `}
          >
            {SectionIcon && (
              <SectionIcon
                size={12}
                className={`shrink-0 transition-colors duration-200 ${
                  sectionHasActive ? "text-primary/70" : "text-muted-foreground/30"
                }`}
              />
            )}
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-200 ${
                sectionHasActive ? "text-primary/60" : "text-muted-foreground/40"
              }`}
            >
              {section.title}
            </p>
            <div className="flex-1 h-px bg-border/20 ml-1" />
          </div>
        )}

        {/* Itens da seção */}
        <div className="space-y-0.5">
          {section.items.map(renderItem)}
        </div>
      </div>
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const sidebarBg = config.sidebarStyle === "gradient"
    ? `linear-gradient(180deg, hsl(var(--card) / 0.98), ${config.primaryColor}08)`
    : undefined;

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen flex flex-col z-50
        transition-[width] duration-300 ease-out
        border-r border-border/5 shadow-2xl shadow-black/40
        ${collapsed ? "w-[76px]" : "w-[260px]"}
      `}
      style={{
        background: sidebarBg || "hsl(var(--card) / 0.4)",
        backdropFilter: "blur(40px)",
      }}
    >
      {/* Background Subtle Eagle */}
      <div className="absolute -bottom-10 -left-10 w-40 h-40 opacity-[0.03] pointer-events-none rotate-[-15deg] -z-10">
        <img src={eagleLogo} alt="" className="w-full h-full object-contain grayscale" />
      </div>

      {/* Logo */}
      <div
        className={`
          flex items-center h-20 border-b border-border/5 shrink-0
          transition-all duration-300
          ${collapsed ? "justify-center px-2" : "px-4 gap-3"}
        `}
      >
        <div className="relative shrink-0">
          <img
            src={logoSrc}
            alt={brandName}
            width={34}
            height={34}
            className="rounded-xl ring-1 ring-primary/20 shadow-lg shadow-primary/5"
          />
          {/* Status online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>

        {!collapsed && (
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="text-sm font-bold tracking-wider text-gradient-gold leading-none truncate">
              {brandName.split(" ")[0] || brandName}
            </span>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/40 leading-tight truncate">
              {brandName.split(" ").slice(1).join(" ") || "PRO"}
            </span>
          </div>
        )}
      </div>

      {/* Botão de colapsar */}
      <button
        onClick={onToggleCollapse}
        className="
          absolute -right-3 top-[3.5rem] w-7 h-7
          rounded-full bg-background border border-border/20 shadow-xl
          flex items-center justify-center
          text-muted-foreground hover:text-primary hover:border-primary/30
          hover:scale-110 hover:shadow-lg hover:shadow-primary/10
          transition-all duration-300 focus-ring z-10
        "
        title={collapsed ? "Expandir" : "Minimizar"}
      >
        <span
          className={`transition-transform duration-300 ${
            collapsed ? "rotate-0" : "rotate-180"
          }`}
        >
          <ChevronLeft size={13} />
        </span>
      </button>

      {/* Busca */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-2">
          <div className="relative group">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary/60 transition-colors"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no menu..."
              className="
                w-full h-9 pl-9 pr-8 rounded-xl
                bg-accent/30 border border-border/20
                text-[13px] text-foreground placeholder:text-muted-foreground/40
                focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30
                focus:bg-accent/50
                transition-all duration-200
              "
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-accent/50 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navegação */}
      <nav
        className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1 scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {filteredSections.map((section, idx) => renderSection(section, idx))}

        {filteredSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
            <Search size={24} className="mb-2 opacity-50" />
            <p className="text-xs">Nenhum item encontrado</p>
          </div>
        )}
      </nav>

      {/* Footer do usuário */}
      <div
        className={`
          shrink-0 border-t border-border/5 p-3.5 bg-background/20
          ${collapsed ? "flex flex-col items-center gap-2" : ""}
        `}
      >
        {!collapsed ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-accent/30 transition-all duration-200 cursor-pointer group">
            {/* Avatar */}
            <div
              className="
                w-10 h-10 rounded-xl
                bg-primary/10 flex items-center justify-center shrink-0
                ring-1 ring-primary/15 group-hover:ring-primary/30
                transition-all duration-200
              "
              onClick={() => navigate("/perfil")}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover"
                />
              ) : (
                <User size={18} className="text-primary" />
              )}
            </div>

            {/* Info */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate("/perfil")}
            >
              <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                {profile?.name || "Usuário"}
              </p>
              <p className="text-[10px] text-muted-foreground/50 truncate">
                {profile?.email || ""}
              </p>
            </div>

            {/* Sair */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSignOut();
              }}
              className="
                p-2 rounded-lg
                text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10
                transition-all duration-200 opacity-0 group-hover:opacity-100
              "
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => navigate("/perfil")}
              className="
                w-11 h-11 rounded-xl
                bg-primary/10 flex items-center justify-center
                hover:bg-primary/15 hover:ring-2 hover:ring-primary/20
                transition-all duration-200
              "
              title={profile?.name || "Perfil"}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover"
                />
              ) : (
                <User size={18} className="text-primary" />
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="
                p-2 rounded-lg
                text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10
                transition-all duration-200
              "
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
