import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eagleLogo from "@/assets/eagle-logo.webp";
import {
  LayoutDashboard, BarChart3, Users, Receipt, Wallet,
  TrendingUp, DollarSign, Wrench, Database, Info,
  Target, Calculator, CheckSquare, StickyNote, Table, ChevronDown, ChevronLeft, ChevronRight,
  FileText, Crown, FileSignature, ClipboardList,
  Settings, Bot, QrCode, UserCheck, Shield,
  Briefcase, PieChart, Cog, Sparkles,
} from "lucide-react";

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface MenuSection {
  title: string;
  sectionIcon?: React.ReactNode;
  items: MenuItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const sections: MenuSection[] = [
  {
    title: "Visão Geral",
    sectionIcon: <PieChart size={12} />,
    items: [
      { label: "Painel", icon: <LayoutDashboard size={18} />, path: "/dashboard" },
      { label: "Análises", icon: <BarChart3 size={18} />, path: "/analises" },
      { label: "Relatórios", icon: <FileText size={18} />, path: "/relatorios" },
    ],
  },
  {
    title: "Gestão",
    sectionIcon: <Briefcase size={12} />,
    items: [
      { label: "Clientes", icon: <Users size={18} />, path: "/clientes" },
      { label: "Cobranças", icon: <Receipt size={18} />, path: "/cobrancas" },
      { label: "Cobradores", icon: <UserCheck size={18} />, path: "/cobradores" },
    ],
  },
  {
    title: "Financeiro",
    sectionIcon: <DollarSign size={12} />,
    items: [
      { label: "Carteira", icon: <Wallet size={18} />, path: "/carteira" },
      { label: "Lucros", icon: <TrendingUp size={18} />, path: "/lucros" },
      { label: "Gastos", icon: <DollarSign size={18} />, path: "/gastos" },
    ],
  },
  {
    title: "Ferramentas",
    sectionIcon: <Sparkles size={12} />,
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Agente IA", icon: <Bot size={18} />, path: "/agente-ia" },
      { label: "Simulador", icon: <Calculator size={18} />, path: "/ferramentas/simulador" },
      { label: "Metas", icon: <Target size={18} />, path: "/ferramentas/metas" },
      { label: "Tarefas", icon: <CheckSquare size={18} />, path: "/ferramentas/tarefas" },
      { label: "Anotações", icon: <StickyNote size={18} />, path: "/ferramentas/anotacoes" },
      { label: "Planilha", icon: <Table size={18} />, path: "/ferramentas/planilha" },
      { label: "Puxada de Dados", icon: <Database size={18} />, path: "/puxada-dados" },
      { label: "QR Code", icon: <QrCode size={18} />, path: "/qrcode" },
    ],
  },
  {
    title: "Sistema",
    sectionIcon: <Cog size={12} />,
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Histórico", icon: <ClipboardList size={18} />, path: "/historico" },
      { label: "Auditoria", icon: <Shield size={18} />, path: "/auditoria" },
      { label: "Configurações", icon: <Settings size={18} />, path: "/configuracoes" },
      { label: "Admin", icon: <Crown size={18} />, path: "/admin" },
      { label: "Sobre", icon: <Info size={18} />, path: "/sobre" },
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

  // Improvement #24: Tooltip on collapsed items
  const renderItem = (item: MenuItem) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-200 group relative focus-ring ${
        isActive(item.path)
          ? "premium-card text-foreground shadow-sm !border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      {isActive(item.path) && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "var(--gradient-gold)" }} />
      )}
      <span className={`shrink-0 transition-all duration-200 ${isActive(item.path) ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-xl bg-popover border border-border text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 shadow-lg z-50">
          {item.label}
        </div>
      )}
    </button>
  );

  const renderSection = (section: MenuSection) => {
    const isOpen = section.collapsible ? openSections[section.title] : true;
    const sectionHasActive = section.items.some((i) => isActive(i.path));

    return (
      <div key={section.title}>
        {section.collapsible ? (
          <button
            onClick={() => !collapsed && toggleSection(section.title)}
            title={collapsed ? section.title : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-[11px] font-semibold uppercase tracking-[0.08em] transition-all duration-200 focus-ring ${
              sectionHasActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            } hover:bg-accent/30 ${collapsed ? "justify-center px-2" : ""}`}
          >
            {section.sectionIcon && <span className="shrink-0 opacity-60">{section.sectionIcon}</span>}
            {!collapsed && <span>{section.title}</span>}
            {!collapsed && (
              <ChevronDown
                size={13}
                className={`ml-auto transition-transform duration-300 opacity-50 ${isOpen ? "rotate-180" : ""}`}
              />
            )}
          </button>
        ) : (
          !collapsed && (
            <div className="flex items-center gap-2 px-3 mb-1.5">
              {section.sectionIcon && <span className="text-muted-foreground/50">{section.sectionIcon}</span>}
              <p className="text-label">{section.title}</p>
            </div>
          )
        )}

        {/* Improvement #27: Animated section collapse */}
        <div
          className={`space-y-0.5 overflow-hidden transition-all duration-300 ease-out ${
            section.collapsible && !collapsed ? "ml-1 pl-2 border-l border-border/30" : ""
          } ${!isOpen ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100 mt-0.5"}`}
        >
          {section.items.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen glass-strong flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/30">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img src={eagleLogo} alt="System Juros" width={30} height={30} className="rounded-full ring-2 ring-primary/20" />
            <span className="font-display text-[11px] tracking-[0.2em] text-gradient-gold font-semibold">SYSTEM JUROS</span>
          </div>
        ) : (
          <img src={eagleLogo} alt="System Juros" width={30} height={30} className="rounded-full ring-2 ring-primary/20 mx-auto" />
        )}
      </div>

      {/* Improvement #28: Better collapse toggle with animation */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full premium-card flex items-center justify-center text-muted-foreground hover:text-primary hover:scale-110 transition-all duration-200 focus-ring"
        title={collapsed ? "Expandir" : "Minimizar"}
      >
        <span className={`transition-transform duration-300 ${collapsed ? "rotate-0" : "rotate-180"}`}>
          <ChevronRight size={14} />
        </span>
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {sections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <div className="border-t border-border/20 mb-3" />}
            {renderSection(section)}
          </div>
        ))}
      </nav>

      {/* Improvement #29: Version footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border/30">
          <p className="text-[9px] text-muted-foreground/40 text-center tracking-wider">v2.0 · System Juros</p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
