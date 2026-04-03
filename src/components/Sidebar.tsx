import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eagleLogo from "@/assets/eagle-logo.webp";
import {
  LayoutDashboard, BarChart3, Users, Receipt, Wallet,
  TrendingUp, DollarSign, Wrench, Database, Info,
  Target, Calculator, CheckSquare, StickyNote, Table, ChevronDown, ChevronLeft, ChevronRight,
  FileText, Crown, FileSignature, PhoneCall, Landmark, ClipboardList,
  Settings, Bot, QrCode, UserCheck, Shield,
} from "lucide-react";

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const sections: MenuSection[] = [
  {
    title: "Principal",
    items: [
      { label: "Painel", icon: <LayoutDashboard size={18} />, path: "/dashboard" },
      { label: "Mesa de Cobrança", icon: <PhoneCall size={18} />, path: "/mesa-cobranca" },
      { label: "Agente IA", icon: <Bot size={18} />, path: "/agente-ia" },
      { label: "Análises", icon: <BarChart3 size={18} />, path: "/analises" },
      { label: "Relatórios", icon: <FileText size={18} />, path: "/relatorios" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Clientes", icon: <Users size={18} />, path: "/clientes" },
      { label: "Contratos", icon: <FileSignature size={18} />, path: "/contratos" },
      { label: "Cobradores", icon: <UserCheck size={18} />, path: "/cobradores" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { label: "Tesouraria", icon: <Landmark size={18} />, path: "/tesouraria" },
      { label: "Cobranças", icon: <Receipt size={18} />, path: "/cobrancas" },
      { label: "Carteira", icon: <Wallet size={18} />, path: "/carteira" },
      { label: "Lucros", icon: <TrendingUp size={18} />, path: "/lucros" },
      { label: "Gastos", icon: <DollarSign size={18} />, path: "/gastos" },
    ],
  },
];

const ferramentasItems: MenuItem[] = [
  { label: "Metas", icon: <Target size={18} />, path: "/ferramentas/metas" },
  { label: "Simulador", icon: <Calculator size={18} />, path: "/ferramentas/simulador" },
  { label: "Tarefas", icon: <CheckSquare size={18} />, path: "/ferramentas/tarefas" },
  { label: "Anotações", icon: <StickyNote size={18} />, path: "/ferramentas/anotacoes" },
  { label: "Planilha", icon: <Table size={18} />, path: "/ferramentas/planilha" },
];

const bottomItems: MenuItem[] = [
  { label: "Histórico", icon: <ClipboardList size={18} />, path: "/historico" },
  { label: "Auditoria", icon: <Shield size={18} />, path: "/auditoria" },
  { label: "QR Code", icon: <QrCode size={18} />, path: "/qrcode" },
  { label: "Puxada de Dados", icon: <Database size={18} />, path: "/puxada-dados" },
  { label: "Configurações", icon: <Settings size={18} />, path: "/configuracoes" },
  { label: "Admin", icon: <Crown size={18} />, path: "/admin" },
  { label: "Sobre", icon: <Info size={18} />, path: "/sobre" },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar = ({ collapsed = false, onToggleCollapse }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [ferramentasOpen, setFerramentasOpen] = useState(
    location.pathname.startsWith("/ferramentas")
  );

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: MenuItem) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
        isActive(item.path)
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span className={`transition-colors ${isActive(item.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
        {item.icon}
      </span>
      {!collapsed && <span>{item.label}</span>}
      {!collapsed && item.badge !== undefined && (
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.badge}</span>
      )}
    </button>
  );

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-300 ${
      collapsed ? "w-16" : "w-60"
    }`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <img src={eagleLogo} alt="Urus Jurista" width={30} height={30} className="rounded-full ring-1 ring-primary/20" />
            <span className="font-display text-xs tracking-[0.2em] text-foreground">URUS JURISTA</span>
          </div>
        )}
        {collapsed && (
          <img src={eagleLogo} alt="Urus Jurista" width={30} height={30} className="rounded-full ring-1 ring-primary/20 mx-auto" />
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-sm"
        title={collapsed ? "Expandir menu" : "Minimizar menu"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] px-3 mb-2">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </div>
        ))}

        {/* Ferramentas */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={() => !collapsed && setFerramentasOpen(!ferramentasOpen)}
            title={collapsed ? "Ferramentas" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all ${
              collapsed ? "justify-center px-2" : ""
            }`}
          >
            <Wrench size={18} />
            {!collapsed && <span>Ferramentas</span>}
            {!collapsed && (
              <ChevronDown size={14} className={`ml-auto transition-transform duration-200 ${ferramentasOpen ? "rotate-180" : ""}`} />
            )}
          </button>
          {ferramentasOpen && !collapsed && (
            <div className="ml-2 space-y-0.5 mt-1">
              {ferramentasItems.map(renderItem)}
            </div>
          )}
        </div>

        {/* Bottom items */}
        <div className="space-y-0.5 pt-2 border-t border-border">
          {bottomItems.map(renderItem)}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
