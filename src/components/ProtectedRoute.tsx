import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, AlertCircle } from "lucide-react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
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

  // Subscription expiry check (skip for admin and on perfil/sobre pages)
  const expiresAt = profile?.subscription_expires_at;
  const exemptPaths = ["/perfil", "/sobre", "/configuracoes"];
  const isExempt = exemptPaths.some((p) => location.pathname.startsWith(p));
  if (
    !profile?.is_admin &&
    !isExempt &&
    expiresAt &&
    new Date(expiresAt).getTime() < Date.now()
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
            <AlertCircle className="text-warning" size={28} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Assinatura Expirada</h1>
          <p className="text-sm text-muted-foreground">
            Sua assinatura expirou em{" "}
            <span className="font-semibold text-foreground">
              {new Date(expiresAt).toLocaleDateString("pt-BR")}
            </span>
            . Renove para continuar usando o sistema.
          </p>
          <a
            href="/perfil"
            className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Ir para Perfil
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
