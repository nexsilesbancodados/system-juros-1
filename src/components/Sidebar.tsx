import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eagleLogo from "@/assets/eagle-logo.webp";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Car,
  Smartphone,
  Gavel,
  Receipt,
  Wallet,
  TrendingUp,
  DollarSign,
  Wrench,
  MessageSquare,
  Database,
  Network,
  Info,
  Target,
  Calculator,
  CheckSquare,
  StickyNote,
  Table,
  ChevronDown,
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
      { label: "Análises", icon: <BarChart3 size={18} />, path: "/analises" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Clientes", icon: <Users size={18} />, path: "/clientes" },
      { label: "Veículos", icon: <Car size={18} />, path: "/veiculos" },
      { label: "Venda de Celulares", icon: <Smartphone size={18} />, path: "/celulares" },
      { label: "Penhoras", icon: <Gavel size={18} />, path: "/penhoras" },
    ],
  },
  {
    title: "Financeiro",
    items: [
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
  { label: "Uruszap", icon: <MessageSquare size={18} />, path: "/uruszap", badge: "0" },
  { label: "Puxada de Dados", icon: <Database size={18} />, path: "/puxada-dados" },
  { label: "Network", icon: <Network size={18} />, path: "/network" },
  { label: "Sobre", icon: <Info size={18} />, path: "/sobre" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: MenuItem) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive(item.path)
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
      {item.badge !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground">{item.badge}</span>
      )}
    </button>
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-card border-r border-border flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <img src={eagleLogo} alt="Urus Jurista" width={28} height={28} className="rounded-full" />
        <span className="font-display text-sm tracking-widest text-foreground">URUS JURISTA</span>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {section.title}
            </p>
            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </div>
        ))}

        {/* Bottom items */}
        <div className="space-y-0.5 pt-2 border-t border-border">
          {bottomItems.map(renderItem)}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
