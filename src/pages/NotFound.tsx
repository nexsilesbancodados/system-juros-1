import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={36} className="text-destructive" />
        </div>
        <h1 className="text-6xl font-display font-bold text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-6">Página não encontrada</p>
        <p className="text-sm text-muted-foreground/60 mb-8 max-w-xs mx-auto">
          O endereço <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{location.pathname}</code> não existe no sistema.
        </p>
        <Link
          to="/"
          className="action-btn-primary"
        >
          <ArrowLeft size={16} />
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
