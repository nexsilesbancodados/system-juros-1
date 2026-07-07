import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPortalSession } from "@/lib/portalSession";

type AccessState = "checking" | "allowed" | "denied";

/**
 * Cache the subscription decision per user for a short period to avoid
 * hammering the DB on every navigation. Reset on logout via cache key.
 */
const CACHE_KEY = (uid: string) => `__sub_status_${uid}`;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function readCache(uid: string): "allowed" | "denied" | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY(uid));
    if (!raw) return null;
    const { v, t } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch {
    return null;
  }
}
function writeCache(uid: string, v: "allowed" | "denied") {
  try {
    sessionStorage.setItem(CACHE_KEY(uid), JSON.stringify({ v, t: Date.now() }));
  } catch {}
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [access, setAccess] = useState<AccessState>("checking");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user?.id) return;

    // Admin always allowed
    if (profile?.is_admin) {
      setAccess("allowed");
      return;
    }

    // Cache hit?
    const cached = readCache(user.id);
    if (cached) {
      setAccess(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      // 1) Active trial on profile (legacy users)
      const trialOk =
        profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now();
      const profileSubOk =
        (profile as any)?.subscription_expires_at &&
        new Date((profile as any).subscription_expires_at).getTime() > Date.now();

      if (trialOk || profileSubOk) {
        if (!cancelled) {
          writeCache(user.id, "allowed");
          setAccess("allowed");
        }
        return;
      }

      // 2) Active subscription on `subscriptions` table (paid via Hubla)
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (sub?.status === "active") {
        writeCache(user.id, "allowed");
        setAccess("allowed");
        return;
      }

      // 3) No access — fetch checkout URL once for the CTA
      const { data: url } = await supabase.rpc("get_signup_checkout_url");
      if (cancelled) return;
      if (typeof url === "string") setCheckoutUrl(url);
      writeCache(user.id, "denied");
      setAccess("denied");
    })();

    return () => { cancelled = true; };
  }, [user?.id, profile?.is_admin, profile?.trial_ends_at, (profile as any)?.subscription_expires_at, loading]);

  if (loading || (user && access === "checking")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
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

  if (access === "denied") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <CreditCard className="text-primary" size={28} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Assinatura necessária</h1>
            <p className="text-sm text-muted-foreground">
              Para acessar o System Juros é preciso ter uma assinatura ativa. Finalize seu pagamento para liberar o acesso imediatamente.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {checkoutUrl ? (
              <a
                href={checkoutUrl}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
              >
                Ir para o pagamento
              </a>
            ) : (
              <a
                href="/planos"
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
              >
                Ver planos
              </a>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-xs hover:text-foreground transition"
            >
              Sair
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Já pagou? Aguarde alguns segundos — assim que o Hubla confirmar, seu acesso é liberado automaticamente.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
