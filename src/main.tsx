import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Splash hide: remove o splash do index.html após o React montar
requestAnimationFrame(() => {
  const splash = document.getElementById("app-splash");
  if (splash) {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 350);
  }
});

// Service Worker: NUNCA registra em iframes ou hosts de preview Lovable
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  location.hostname.includes("id-preview--") ||
  location.hostname.includes("lovableproject.com") ||
  location.hostname.includes("lovable.app") && location.hostname.startsWith("id-");

if (isInIframe || isPreviewHost) {
  // Em preview, desregistra qualquer SW pré-existente para evitar conteúdo stale
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Auto-recover de chunks antigos após novo deploy
const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "Failed to load module script",
  "ChunkLoadError",
];

const recoverFromStaleChunk = (msg: string) => {
  if (!msg) return;
  if (!CHUNK_ERROR_PATTERNS.some((p) => msg.includes(p))) return;

  const last = Number(sessionStorage.getItem("__chunk_reloaded_at") || 0);
  // Janela de 30s para evitar loop infinito, mas permite nova recuperação depois
  if (Date.now() - last < 30_000) return;
  sessionStorage.setItem("__chunk_reloaded_at", String(Date.now()));

  // Limpa caches + service workers e recarrega forçadamente
  Promise.all([
    caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) ?? Promise.resolve(),
    navigator.serviceWorker?.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))) ?? Promise.resolve(),
  ]).finally(() => {
    // bypass cache
    location.reload();
  });
};

window.addEventListener("error", (e) => {
  recoverFromStaleChunk(String(e?.message || ""));
  recoverFromStaleChunk(String((e as any)?.error?.message || ""));
});
window.addEventListener("unhandledrejection", (e: any) => {
  recoverFromStaleChunk(String(e?.reason?.message || e?.reason || ""));
});
