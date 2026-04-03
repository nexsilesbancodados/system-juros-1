import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eagleLogo from "@/assets/eagle-logo.webp";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, BarChart3, Users, Receipt, Wallet,
  TrendingUp, DollarSign, Database, Info,
  Target, Calculator, CheckSquare, StickyNote, Table, ChevronDown, ChevronRight,
  FileText, Crown, ClipboardList,
  Settings, Bot, QrCode, UserCheck, Shield,
  Briefcase, PieChart, Cog, Sparkles, LogOut, User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

interface MenuItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface MenuSection {
  title: string;
  sectionIcon?: LucideIcon;
  items: MenuItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const sections: MenuSection[] = [
  {
    title: "Visão Geral",
    sectionIcon: PieChart,
    items: [
      { label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Análises", icon: BarChart3, path: "/analises" },
      { label: "Relatórios", icon: FileText, path: "/relatorios" },
    ],
  },
  {
    title: "Gestão",
    sectionIcon: Briefcase,
    items: [
      { label: "Clientes", icon: Users, path: "/clientes" },
      { label: "Cobranças", icon: Receipt, path: "/cobrancas" },
      { label: "Cobradores", icon: UserCheck, path: "/cobradores" },
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
    title: "Ferramentas",
    sectionIcon: Sparkles,
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Agente IA", icon: Bot, path: "/agente-ia" },
      { label: "Simulador", icon: Calculator, path: "/ferramentas/simulador" },
      { label: "Metas", icon: Target, path: "/ferramentas/metas" },
      { label: "Tarefas", icon: CheckSquare, path: "/ferramentas/tarefas" },
      { label: "Anotações", icon: StickyNote, path: "/ferramentas/anotacoes" },
      { label: "Planilha", icon: Table, path: "/ferramentas/planilha" },
      { label: "Puxada de Dados", icon: Database, path: "/puxada-dados" },
      { label: "QR Code", icon: QrCode, path: "/qrcode" },
    ],
  },
  {
    title: "Sistema",
    sectionIcon: Cog,
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Histórico", icon: ClipboardList, path: "/historico" },
      { label: "Auditoria", icon: Shield, path: "/auditoria" },
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
      { label: "Admin", icon: Crown, path: "/admin" },
      { label: "Sobre", icon: Info, path: "/sobre" },
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
  const { profile, signOut } = useAuth();
  const { config } = useWhiteLabel();
  const logoSrc = config.companyLogo || eagleLogo;
  const brandName = config.companyName || "SYSTEM JUROS";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.collapsible) {
        const hasActive = s.items.some((i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/"));
        initial[s.title] = hasActive || (s.defaultOpen ?? false);
      }
    });
    return initial;
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: MenuItem) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group relative focus-ring ${
          active
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        } ${collapsed ? "justify-center px-2" : ""}`}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
        )}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
          active ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground group-hover:text-foreground group-hover:bg-accent/30"
        }`}>
          <Icon size={16} />
        </div>
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 rounded-xl bg-popover border border-border text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 shadow-xl z-50 translate-x-1 group-hover:translate-x-0">
            {item.label}
          </div>
        )}
      </button>
    );
  };

  const renderSection = (section: MenuSection) => {
    const isOpen = section.collapsible ? openSections[section.title] : true;
    const sectionHasActive = section.items.some((i) => isActive(i.path));
    const SectionIcon = section.sectionIcon;

    return (
      <div key={section.title}>
        {section.collapsible ? (
          <button
            onClick={() => !collapsed && toggleSection(section.title)}
            title={collapsed ? section.title : undefined}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-200 focus-ring ${
              sectionHasActive ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
            } ${collapsed ? "justify-center px-2" : ""}`}
          >
            {SectionIcon && <SectionIcon size={11} className="shrink-0 opacity-70" />}
            {!collapsed && <span>{section.title}</span>}
            {!collapsed && (
              <ChevronDown
                size={12}
                className={`ml-auto transition-transform duration-300 opacity-40 ${isOpen ? "rotate-180" : ""}`}
              />
            )}
          </button>
        ) : (
          !collapsed && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              {SectionIcon && <SectionIcon size={11} className="text-muted-foreground/40" />}
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">{section.title}</p>
            </div>
          )
        )}

        <div
          className={`space-y-0.5 overflow-hidden transition-all duration-300 ease-out ${
            section.collapsible && !collapsed ? "ml-1.5 pl-2.5 border-l border-border/20" : ""
          } ${!isOpen ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100 mt-0.5"}`}
        >
          {section.items.map(renderItem)}
        </div>
      </div>
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-300 border-r border-border/20 ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
      style={{
        background: "hsl(var(--card) / 0.95)",
        backdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* Logo */}
      <div className={`flex items-center px-4 h-14 border-b border-border/20 shrink-0 ${collapsed ? "justify-center" : "gap-3"}`}>
        <img
          src={eagleLogo}
          alt="System Juros"
          width={32}
          height={32}
          className="rounded-xl ring-1 ring-primary/20 shadow-sm shrink-0"
        />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold tracking-wider text-gradient-gold leading-none">SYSTEM</span>
            <span className="text-[9px] font-semibold tracking-[0.15em] text-muted-foreground/50 leading-tight">JUROS PRO</span>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-[3.25rem] w-7 h-7 rounded-full bg-card border border-border/40 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 hover:scale-110 transition-all duration-200 focus-ring shadow-md z-10"
        title={collapsed ? "Expandir" : "Minimizar"}
      >
        <span className={`transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-180"}`}>
          <ChevronRight size={13} />
        </span>
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {sections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && !collapsed && <div className="border-t border-border/10 mb-3" />}
            {renderSection(section)}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={`shrink-0 border-t border-border/20 p-2.5 ${collapsed ? "flex flex-col items-center gap-1" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-accent/30 transition-colors cursor-pointer group" onClick={() => navigate("/perfil")}>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/15">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
              ) : (
                <User size={16} className="text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{profile?.name || "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground/50 truncate">{profile?.email || ""}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => navigate("/perfil")}
              className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/15 transition-colors"
              title={profile?.name || "Perfil"}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <User size={16} className="text-primary" />
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
