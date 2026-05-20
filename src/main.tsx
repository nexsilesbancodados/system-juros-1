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
const recoverFromStaleChunk = (msg: string) => {
  if (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Importing a module script failed")) {
    if (!sessionStorage.getItem("__chunk_reloaded")) {
      sessionStorage.setItem("__chunk_reloaded", "1");
      caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => location.reload());
    }
  }
};
window.addEventListener("error", (e) => recoverFromStaleChunk(String(e?.message || "")));
window.addEventListener("unhandledrejection", (e: any) => recoverFromStaleChunk(String(e?.reason?.message || "")));
