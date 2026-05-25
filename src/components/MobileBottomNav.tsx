import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, Wallet, MoreHorizontal,
  BarChart3, FileSignature, TrendingUp, DollarSign, Bot,
  Calculator, Target, CheckSquare, StickyNote, Table, Database,
  QrCode, ClipboardList, Shield, Settings, Crown, Info,
  UserCheck, FileText, X, Sparkles, Zap, MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdminEmail } from "@/lib/admin";

const mobileIconColor: Record<string, string> = {
  "/hoje": "text-amber-400",
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
  "/automacoes": "text-amber-400",
  "/configuracoes": "text-zinc-400",
  "/admin": "text-amber-300",
  "/sobre": "text-blue-300",
  "/suporte": "text-pink-400",
  "/chat": "text-emerald-400",
};

const mainTabs = [
  { label: "Hoje", icon: Sparkles, path: "/hoje" },
  { label: "Clientes", icon: Users, path: "/clientes" },
  { label: "Cobranças", icon: Receipt, path: "/cobrancas" },
  { label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreGroups = [
  {
    title: "Análise & Gestão",
    items: [
      { label: "Análises", icon: BarChart3, path: "/analises" },
      { label: "Relatórios", icon: FileText, path: "/relatorios" },
      { label: "Cobradores", icon: UserCheck, path: "/cobradores" },
      { label: "Lucros", icon: TrendingUp, path: "/lucros" },
      { label: "Gastos", icon: DollarSign, path: "/gastos" },
      { label: "Inadimplência", icon: FileSignature, path: "/inadimplencia" },
    ],
  },
  {
    title: "Inteligência",
    items: [
      { label: "Comunicação & IA", icon: Bot, path: "/comunicacao" },
      { label: "Simulador", icon: Calculator, path: "/ferramentas/simulador" },
      { label: "Metas", icon: Target, path: "/ferramentas/metas" },
      { label: "Tarefas", icon: CheckSquare, path: "/ferramentas/tarefas" },
      { label: "Anotações", icon: StickyNote, path: "/ferramentas/anotacoes" },
    ],
  },
  {
    title: "Ferramentas & Sistema",
    items: [
      { label: "Planilha", icon: Table, path: "/ferramentas/planilha" },
      { label: "Puxada Dados", icon: Database, path: "/puxada-dados" },
      { label: "Portais", icon: QrCode, path: "/qrcode" },
      { label: "Chat", icon: MessageCircle, path: "/chat" },
      { label: "Histórico", icon: ClipboardList, path: "/historico" },
      { label: "Auditoria", icon: Shield, path: "/auditoria" },
      { label: "Config.", icon: Settings, path: "/configuracoes" },
      { label: "Admin", icon: Crown, path: "/admin" },
      { label: "Suporte", icon: Sparkles, path: "/suporte" },
      { label: "Sobre", icon: Info, path: "/sobre" },
    ],
  },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const isSuperAdmin = isSuperAdminEmail(user?.email);

  const isActive = (path: string) => {
    if (path === "__more__") return showMore;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const isInMoreSection = moreGroups.some((group) =>
    group.items.some(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(item.path + "/")
    )
  );

  return (
    <>
      {/* Menu "Mais" */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-[4.5rem] left-0 right-0 z-50 px-3 pb-2 animate-slide-up">
            <div className="glass-strong rounded-2xl border border-border/40 p-4 max-h-[70vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Menu Completo</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-5">
                {moreGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2.5 px-1">
                      {group.title}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {group.items
                        .filter((i) => i.path !== "/admin" || isSuperAdmin)
                        .map((item) => {
                          const active = isActive(item.path);
                          return (
                            <button
                              key={item.path}
                              onClick={() => {
                                navigate(item.path);
                                setShowMore(false);
                              }}
                              className={`
                                flex flex-col items-center gap-1.5 p-3 rounded-xl
                                transition-all duration-200 active:scale-95
                                ${active
                                  ? "bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                                  : `${mobileIconColor[item.path] || "text-muted-foreground"} hover:bg-accent/40 hover:text-foreground`
                                }
                              `}
                            >
                              <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
                              <span
                                className={`text-[10px] font-semibold leading-tight text-center ${
                                  active ? "text-primary" : "text-muted-foreground"
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border/40 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {mainTabs.map((tab) => {
            const active =
              tab.path === "__more__"
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
                className={`
                  relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl
                  transition-all duration-200 min-w-[3.5rem] active:scale-95
                  ${active ? "text-primary" : mobileIconColor[tab.path] || "text-muted-foreground"}
                `}
              >
                {/* Indicador ativo */}
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)] animate-scale-in" />
                )}

                <div
                  className={`
                    p-1.5 rounded-xl transition-all duration-200
                    ${active ? "bg-primary/15" : ""}
                  `}
                >
                  <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
