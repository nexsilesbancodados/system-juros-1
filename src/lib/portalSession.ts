// Portal session utilities — o portal do cliente é 100% separado do app do credor.
// Cliente do portal NUNCA deve conseguir acessar rotas do app principal.
const PORTAL_SESSION_KEY = "portal-cliente-session";
const PORTAL_ATTEMPTS_KEY = "portal-cliente-attempts";

export const isPortalRoute = (pathname: string): boolean => {
  const p = pathname.toLowerCase();
  return (
    p.startsWith("/portal-cliente") ||
    p.startsWith("/cobrador-externo") ||
    p === "/" ||
    p.startsWith("/planos") ||
    p.startsWith("/sobre")
  );
};

export const hasPortalSession = (): boolean => {
  try {
    const raw = sessionStorage.getItem(PORTAL_SESSION_KEY);
    if (!raw) return false;
    const { cpf } = JSON.parse(raw);
    return typeof cpf === "string" && cpf.length >= 11;
  } catch {
    return false;
  }
};

export const clearPortalSession = () => {
  try {
    sessionStorage.removeItem(PORTAL_SESSION_KEY);
  } catch {}
};

/**
 * Logout completo do portal do cliente.
 * Limpa TODO vestígio de autenticação no navegador para garantir que
 * nenhuma sessão (portal ou credor) sobreviva ao logout.
 */
export const performFullPortalLogout = async (): Promise<void> => {
  // 1) Sign out do supabase (invalida refresh token + limpa storage do SDK)
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    try {
      await supabase.auth.signOut({ scope: "global" } as any);
    } catch {
      await supabase.auth.signOut().catch(() => {});
    }
  } catch {}

  // 2) Limpar sessionStorage inteiro (portal, tentativas, cache de rota)
  try {
    sessionStorage.clear();
  } catch {}

  // 3) Limpar chaves de auth do localStorage (sb-*, supabase.*, portal-*)
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith("sb-") ||
        k.startsWith("supabase.") ||
        k.startsWith("portal-") ||
        k.includes("auth-token")
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  // 4) Expirar cookies de sessão do supabase/ssr no domínio atual e superiores
  try {
    const host = window.location.hostname;
    const parts = host.split(".");
    const domains = new Set<string>(["", host]);
    for (let i = 1; i < parts.length - 1; i++) {
      domains.add("." + parts.slice(i).join("."));
    }
    document.cookie.split(";").forEach((raw) => {
      const name = raw.split("=")[0]?.trim();
      if (!name) return;
      if (
        name.startsWith("sb-") ||
        name.startsWith("supabase") ||
        name.includes("auth-token") ||
        name.startsWith("portal-")
      ) {
        domains.forEach((d) => {
          document.cookie = `${name}=; Max-Age=0; path=/;${d ? ` domain=${d};` : ""}`;
        });
      }
    });
  } catch {}

  // 5) Limpar caches do service worker (se houver PWA)
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
};

// Rate limit: bloqueia após N tentativas em janela curta
export function recordPortalLoginAttempt(success: boolean): { blocked: boolean; waitSec: number } {
  const WINDOW_MS = 15 * 60 * 1000; // 15 min
  const MAX_ATTEMPTS = 8;
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(PORTAL_ATTEMPTS_KEY);
    let attempts: number[] = raw ? JSON.parse(raw) : [];
    attempts = attempts.filter((t) => now - t < WINDOW_MS);
    if (success) {
      sessionStorage.removeItem(PORTAL_ATTEMPTS_KEY);
      return { blocked: false, waitSec: 0 };
    }
    attempts.push(now);
    sessionStorage.setItem(PORTAL_ATTEMPTS_KEY, JSON.stringify(attempts));
    if (attempts.length >= MAX_ATTEMPTS) {
      const oldest = attempts[0];
      const waitSec = Math.max(0, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
      return { blocked: true, waitSec };
    }
  } catch {}
  return { blocked: false, waitSec: 0 };
}

export function isPortalLoginBlocked(): { blocked: boolean; waitSec: number } {
  const WINDOW_MS = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 8;
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(PORTAL_ATTEMPTS_KEY);
    if (!raw) return { blocked: false, waitSec: 0 };
    const attempts: number[] = JSON.parse(raw);
    const fresh = attempts.filter((t) => now - t < WINDOW_MS);
    if (fresh.length >= MAX_ATTEMPTS) {
      const oldest = fresh[0];
      const waitSec = Math.max(0, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
      return { blocked: true, waitSec };
    }
  } catch {}
  return { blocked: false, waitSec: 0 };
}
