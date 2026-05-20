import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";

const LABELS: Record<string, string> = {
  dashboard: "Painel",
  clientes: "Clientes",
  novo: "Novo",
  buscar: "Buscar",
  contratos: "Contratos",
  cobrancas: "Cobranças",
  carteira: "Carteira",
  lucros: "Lucros",
  gastos: "Gastos",
  analises: "Análises",
  relatorios: "Relatórios",
  cobradores: "Cobradores",
  historico: "Histórico",
  configuracoes: "Configurações",
  whatsapp: "WhatsApp",
  qrcode: "Portais",
  "agente-ia": "Agente IA",
  auditoria: "Auditoria",
  automacoes: "Automações",
  suporte: "Suporte",
  notificacoes: "Notificações",
  chat: "Chat",
  inadimplencia: "Inadimplência",
  perfil: "Perfil",
  admin: "Admin",
  sobre: "Sobre",
  "puxada-dados": "Puxada de Dados",
  ferramentas: "Ferramentas",
  metas: "Metas",
  simulador: "Simulador",
  tarefas: "Tarefas",
  anotacoes: "Anotações",
  planilha: "Planilha",
};

const labelFor = (seg: string) => {
  if (LABELS[seg]) return LABELS[seg];
  // UUID-ish (cliente/:id) — encurta
  if (/^[0-9a-f]{8}-/i.test(seg)) return "Detalhes";
  return decodeURIComponent(seg).replace(/-/g, " ");
};

const Breadcrumbs = () => {
  const { pathname } = useLocation();

  const segments = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);

  // Não renderizar no dashboard root
  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden sm:flex items-center gap-1 px-3 lg:px-6 h-9 border-b border-border/20 bg-card/30 text-[11px] text-muted-foreground"
    >
      <Link
        to="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted/40"
      >
        <Home size={11} />
        <span>Painel</span>
      </Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-muted-foreground/40" />
            {isLast ? (
              <span className="text-foreground font-semibold px-1.5 py-0.5 capitalize">
                {labelFor(seg)}
              </span>
            ) : (
              <Link
                to={href}
                className="hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted/40 capitalize"
              >
                {labelFor(seg)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
