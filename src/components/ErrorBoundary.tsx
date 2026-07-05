import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  resetKey?: string;
}

interface State {
  error: Error | null;
}

const CHUNK_LOAD_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "ChunkLoadError",
  "Loading chunk",
];

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = `${error.name} ${error.message}`;
  return CHUNK_LOAD_PATTERNS.some((p) => msg.includes(p));
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);

    // Stale-deploy recovery: if a code-split chunk hash 404s after a redeploy,
    // force a one-time hard reload so the browser picks up the new index.html.
    if (isChunkLoadError(error)) {
      const KEY = "__chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) || "0");
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    // Rotas públicas (portal do cliente / cobrador externo) NUNCA devem
    // levar o usuário para o app do emprestador. Detectamos o contexto
    // pelo pathname atual e escondemos o botão de "Início".
    const path = typeof window !== "undefined" ? window.location.pathname.toLowerCase() : "";
    const isPortalContext =
      path.startsWith("/portal-cliente") ||
      path.startsWith("/cobrador-externo");

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-card/60 backdrop-blur p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Algo deu errado</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isPortalContext
                ? "Não foi possível carregar esta tela. Tente novamente."
                : "Esta tela travou. Tente recarregar ou voltar pro início."}
            </p>
            {error.message && (
              <p className="mt-3 text-[11px] font-mono text-muted-foreground/80 bg-muted/30 rounded-md p-2 break-words text-left max-h-32 overflow-auto">
                {error.message}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reset}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90"
            >
              <RotateCcw size={12} /> Tentar de novo
            </button>
            {!isPortalContext && (
              <a
                href="/dashboard"
                className="px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-accent"
              >
                <Home size={12} /> Início
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
}


// Wrapper para auto-resetar quando o usuário troca de rota,
// evitando ficar "preso" na tela de erro ao navegar pelo menu.
const ErrorBoundary = ({ children, fallback }: Omit<Props, "resetKey">) => {
  let pathname = "static";
  try {
    // useLocation só funciona dentro do BrowserRouter; protegido por try/catch
    // pra não quebrar se alguém usar fora do Router.
    pathname = useLocation().pathname;
  } catch {}
  return (
    <ErrorBoundaryInner resetKey={pathname} fallback={fallback}>
      {children}
    </ErrorBoundaryInner>
  );
};

export default ErrorBoundary;
