import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, Wallet, MoreHorizontal,
  BarChart3, FileSignature, TrendingUp, DollarSign, Bot,
  Calculator, Target, CheckSquare, StickyNote, Table, Database,
  QrCode, ClipboardList, Shield, Settings, Crown, Info,
  UserCheck, FileText, X,
} from "lucide-react";
import { useState } from "react";

const mobileIconColor: Record<string, string> = {
  "/dashboard": "text-blue-400",
  "/clientes": "text-cyan-400",
  "/cobrancas": "text-blue-300",
  "/carteira": "text-sky-400",
  "/analises": "text-indigo-400",
  "/relatorios": "text-sky-300",
  "/cobradores": "text-slate-300",
  "/lucros": "text-emerald-400",
  "/gastos": "text-rose-400",
  "/agente-ia": "text-violet-400",
  "/ferramentas/simulador": "text-cyan-300",
  "/ferramentas/metas": "text-blue-300",
  "/ferramentas/tarefas": "text-sky-300",
  "/ferramentas/anotacoes": "text-slate-300",
  "/ferramentas/planilha": "text-indigo-300",
  "/puxada-dados": "text-blue-400",
  "/qrcode": "text-cyan-400",
  "/historico": "text-slate-400",
  "/auditoria": "text-red-300",
  "/configuracoes": "text-zinc-400",
  "/admin": "text-amber-300",
  "/sobre": "text-blue-300",
};

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
  { label: "Portais", icon: QrCode, path: "/qrcode" },
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
      {/* Improvement #21: Better "more" menu with categories */}
      {showMore && (
        <>
          <div className="fixed inset-0 bg-background/80 z-40" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[4.5rem] left-0 right-0 z-50 px-3 pb-2 animate-fade-in">
            <div className="glass-strong rounded-2xl border border-border/50 p-4 max-h-[65vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-headline text-sm text-foreground">Menu Completo</h3>
                <button onClick={() => setShowMore(false)} className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>
              {/* Improvement #22: Grouped items in more menu */}
              <div className="space-y-4">
                <div>
                  <p className="text-label mb-2">Gestão & Análise</p>
                  <div className="grid grid-cols-4 gap-2">
                    {moreItems.slice(0, 6).map((item) => (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setShowMore(false); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                          isActive(item.path) ? "bg-primary/10 text-primary" : `${mobileIconColor[item.path] || "text-muted-foreground"} hover:bg-accent/40 hover:text-foreground active:scale-95`
                        }`}
                      >
                        <item.icon size={20} />
                        <span className={`text-[10px] font-medium leading-tight text-center ${isActive(item.path) ? "" : "text-muted-foreground"}`}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/30 pt-3">
                  <p className="text-label mb-2">Ferramentas</p>
                  <div className="grid grid-cols-4 gap-2">
                    {moreItems.slice(6, 14).map((item) => (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setShowMore(false); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                          isActive(item.path) ? "bg-primary/10 text-primary" : `${mobileIconColor[item.path] || "text-muted-foreground"} hover:bg-accent/40 hover:text-foreground active:scale-95`
                        }`}
                      >
                        <item.icon size={20} />
                        <span className={`text-[10px] font-medium leading-tight text-center ${isActive(item.path) ? "" : "text-muted-foreground"}`}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/30 pt-3">
                  <p className="text-label mb-2">Sistema</p>
                  <div className="grid grid-cols-4 gap-2">
                    {moreItems.slice(14).map((item) => (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setShowMore(false); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                          isActive(item.path) ? "bg-primary/10 text-primary" : `${mobileIconColor[item.path] || "text-muted-foreground"} hover:bg-accent/40 hover:text-foreground active:scale-95`
                        }`}
                      >
                        <item.icon size={20} />
                        <span className={`text-[10px] font-medium leading-tight text-center ${isActive(item.path) ? "" : "text-muted-foreground"}`}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Improvement #23: Enhanced bottom nav with active indicator line */}
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
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[3.5rem] active:scale-95 ${
                  active ? "text-primary" : mobileIconColor[tab.path] || "text-muted-foreground"
                }`}
              >
                {active && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary animate-scale-in" />
                )}
                <div className={`p-1 rounded-xl transition-all duration-200 ${active ? "bg-primary/15" : ""}`}>
                  <tab.icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
