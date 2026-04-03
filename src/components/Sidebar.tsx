import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eagleLogo from "@/assets/eagle-logo.webp";
import {
  LayoutDashboard, BarChart3, Users, Receipt, Wallet,
  TrendingUp, DollarSign, Wrench, Database, Info,
  Target, Calculator, CheckSquare, StickyNote, Table, ChevronDown, ChevronLeft, ChevronRight,
  FileText, Crown, FileSignature, ClipboardList,
  Settings, Bot, QrCode, UserCheck, Shield,
} from "lucide-react";

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  collapsible?: boolean;
}

const sections: MenuSection[] = [
  {
    title: "Início",
    items: [
      { label: "Painel", icon: <LayoutDashboard size={18} />, path: "/dashboard" },
      { label: "Análises", icon: <BarChart3 size={18} />, path: "/analises" },
      { label: "Relatórios", icon: <FileText size={18} />, path: "/relatorios" },
    ],
  },
  {
    title: "Operacional",
    items: [
      { label: "Clientes", icon: <Users size={18} />, path: "/clientes" },
      { label: "Contratos", icon: <FileSignature size={18} />, path: "/contratos" },
      { label: "Cobranças", icon: <Receipt size={18} />, path: "/cobrancas" },
      { label: "Cobradores", icon: <UserCheck size={18} />, path: "/cobradores" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { label: "Carteira", icon: <Wallet size={18} />, path: "/carteira" },
      { label: "Lucros", icon: <TrendingUp size={18} />, path: "/lucros" },
      { label: "Gastos", icon: <DollarSign size={18} />, path: "/gastos" },
    ],
  },
  {
    title: "Ferramentas",
    collapsible: true,
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

  // Track which collapsible sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.collapsible) {
        initial[s.title] = s.items.some((i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/"));
      }
    });
    return initial;
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: MenuItem) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
        isActive(item.path)
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span className={`shrink-0 transition-colors ${isActive(item.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );

  const renderSection = (section: MenuSection) => {
    const isOpen = section.collapsible ? openSections[section.title] : true;

    return (
      <div key={section.title}>
        {section.collapsible ? (
          <button
            onClick={() => !collapsed && toggleSection(section.title)}
            title={collapsed ? section.title : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all ${
              collapsed ? "justify-center px-2" : ""
            }`}
          >
            <Wrench size={18} className="shrink-0" />
            {!collapsed && <span>{section.title}</span>}
            {!collapsed && (
              <ChevronDown
                size={14}
                className={`ml-auto transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            )}
          </button>
        ) : (
          !collapsed && (
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] px-3 mb-1.5">
              {section.title}
            </p>
          )
        )}

        {isOpen && (
          <div className={`space-y-0.5 ${section.collapsible && !collapsed ? "ml-2 mt-0.5" : ""}`}>
            {section.items.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img src={eagleLogo} alt="System Juros" width={28} height={28} className="rounded-full ring-1 ring-primary/20" />
            <span className="font-display text-[11px] tracking-[0.2em] text-foreground">SYSTEM JUROS</span>
          </div>
        ) : (
          <img src={eagleLogo} alt="System Juros" width={28} height={28} className="rounded-full ring-1 ring-primary/20 mx-auto" />
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-sm"
        title={collapsed ? "Expandir" : "Minimizar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <div className="border-t border-border mb-3" />}
            {renderSection(section)}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
