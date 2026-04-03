import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, Wallet, MoreHorizontal,
  BarChart3, FileSignature, TrendingUp, DollarSign, Bot,
  Calculator, Target, CheckSquare, StickyNote, Table, Database,
  QrCode, ClipboardList, Shield, Settings, Crown, Info,
  UserCheck, FileText, X,
} from "lucide-react";
import { useState } from "react";

const mainTabs = [
  { label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Clientes", icon: Users, path: "/clientes" },
  { label: "Cobranças", icon: Receipt, path: "/cobrancas" },
  { label: "Carteira", icon: Wallet, path: "/carteira" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreItems = [
  { label: "Análises", icon: BarChart3, path: "/analises" },
  { label: "Relatórios", icon: FileText, path: "/relatorios" },
  { label: "Contratos", icon: FileSignature, path: "/contratos" },
  { label: "Cobradores", icon: UserCheck, path: "/cobradores" },
  { label: "Lucros", icon: TrendingUp, path: "/lucros" },
  { label: "Gastos", icon: DollarSign, path: "/gastos" },
  { label: "Agente IA", icon: Bot, path: "/agente-ia" },
  { label: "Simulador", icon: Calculator, path: "/ferramentas/simulador" },
  { label: "Metas", icon: Target, path: "/ferramentas/metas" },
  { label: "Tarefas", icon: CheckSquare, path: "/ferramentas/tarefas" },
  { label: "Anotações", icon: StickyNote, path: "/ferramentas/anotacoes" },
  { label: "Planilha", icon: Table, path: "/ferramentas/planilha" },
  { label: "Puxada Dados", icon: Database, path: "/puxada-dados" },
  { label: "QR Code", icon: QrCode, path: "/qrcode" },
  { label: "Histórico", icon: ClipboardList, path: "/historico" },
  { label: "Auditoria", icon: Shield, path: "/auditoria" },
  { label: "Config.", icon: Settings, path: "/configuracoes" },
  { label: "Admin", icon: Crown, path: "/admin" },
  { label: "Sobre", icon: Info, path: "/sobre" },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path: string) => {
    if (path === "__more__") return showMore;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const isInMoreSection = moreItems.some(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  );

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[4.5rem] left-0 right-0 z-50 px-3 pb-2 animate-fade-in">
            <div className="glass-strong rounded-2xl border border-border/50 p-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-headline text-sm text-foreground">Menu</h3>
                <button onClick={() => setShowMore(false)} className="p-1 rounded-lg hover:bg-accent/50">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {moreItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setShowMore(false);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                      isActive(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border/40 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {mainTabs.map((tab) => {
            const active = tab.path === "__more__"
              ? showMore || isInMoreSection
              : isActive(tab.path);

            return (
              <button
                key={tab.label}
                onClick={() => {
                  if (tab.path === "__more__") {
                    setShowMore(!showMore);
                  } else {
                    navigate(tab.path);
                    setShowMore(false);
                  }
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[3.5rem] ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <div className={`p-1 rounded-xl transition-all duration-200 ${active ? "bg-primary/15" : ""}`}>
                  <tab.icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-semibold ${active ? "text-primary" : ""}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
