import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBR } from "@/lib/dateUtils";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
    // Preserva o destino original para retornar após o login.
    // Evita loop redirecionando para si mesmo ou para rotas públicas de auth.
    const path = location.pathname + location.search + location.hash;
    const lower = location.pathname.toLowerCase();
    const isAuthRoute =
      lower === "/" ||
      lower.startsWith("/login") ||
      lower.startsWith("/reset-password") ||
      lower.startsWith("/portal-cliente") ||
      lower.startsWith("/cobrador-externo");
    const next = !isAuthRoute && path.startsWith("/") ? `?next=${encodeURIComponent(path)}` : "";
    return <Navigate to={`/login${next}`} replace />;
  }


  // Block access for users explicitly marked as blocked
  if (profile?.is_blocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="text-destructive" size={28} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Conta Bloqueada</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta foi bloqueada pelo administrador. Entre em contato para mais informações.
          </p>
        </div>
      </div>
    );
  }

  // Acesso vitalício liberado para todos os usuários — sem checagem de assinatura/trial.


  return <>{children}</>;
};

export default ProtectedRoute;
