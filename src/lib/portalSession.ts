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
