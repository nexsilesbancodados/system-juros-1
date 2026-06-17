import { useEffect, useRef } from "react";

/**
 * Renderiza o fallback de Suspense e dispara um watchdog:
 * se ficar mais de `timeoutMs` carregando (geralmente chunk lazy que falhou
 * silenciosamente em conexão instável), limpa caches/SW e recarrega.
 */
const CHUNK_RELOAD_KEY = "__chunk_reloaded_at";

const SuspenseWatchdog = ({
  children,
  timeoutMs = 15000,
}: {
  children: React.ReactNode;
  timeoutMs?: number;
}) => {
  const fired = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (fired.current) return;
      fired.current = true;

      // Evita loop: só recupera uma vez a cada 30s
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));

      Promise.all([
        caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) ??
          Promise.resolve(),
        navigator.serviceWorker
          ?.getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister()))) ?? Promise.resolve(),
      ]).finally(() => location.reload());
    }, timeoutMs);

    return () => window.clearTimeout(id);
  }, [timeoutMs]);

  return <>{children}</>;
};

export default SuspenseWatchdog;
