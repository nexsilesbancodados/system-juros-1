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

  // Subscription and Trial check (skip for admin and on exempt pages)
  const expiresAt = profile?.subscription_expires_at;
  const trialEndsAt = profile?.trial_ends_at;
  
  const exemptPaths = ["/perfil", "/sobre", "/configuracoes"];
  const isExempt = exemptPaths.some((p) => location.pathname.startsWith(p));

  // Determine if account is active
  const isSubscriptionActive = expiresAt && new Date(expiresAt).getTime() > Date.now();
  const isTrialActive = trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();
  const isAccountActive = isSubscriptionActive || isTrialActive;

  if (!profile?.is_admin && !isExempt && !isAccountActive) {
    const expiredDate = expiresAt || trialEndsAt;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
            <AlertCircle className="text-warning" size={28} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Acesso Restrito</h1>
          <p className="text-sm text-muted-foreground">
            {expiredDate ? (
              <>
                Sua assinatura/período de teste expirou em{" "}
                <span className="font-semibold text-foreground">
                  {formatBR(expiredDate)}
                </span>
                . Renove para continuar usando o sistema.
              </>
            ) : (
              "Você precisa de uma assinatura ativa para acessar esta área."
            )}
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/perfil"
              className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Ir para Perfil
            </a>
            <button
              onClick={async () => {
                const { data: checkoutUrl } = await supabase.rpc("get_signup_checkout_url");
                if (checkoutUrl) window.location.href = checkoutUrl as string;
              }}
              className="inline-block px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
            >
              Assinar Agora
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
