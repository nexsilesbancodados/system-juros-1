import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Registra Service Worker para PWA / modo offline básico
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Auto-recover de chunks antigos após novo deploy
window.addEventListener("error", (e) => {
  const msg = String(e?.message || "");
  if (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Importing a module script failed")) {
    if (!sessionStorage.getItem("__chunk_reloaded")) {
      sessionStorage.setItem("__chunk_reloaded", "1");
      caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => location.reload());
    }
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message || "");
  if (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Importing a module script failed")) {
    if (!sessionStorage.getItem("__chunk_reloaded")) {
      sessionStorage.setItem("__chunk_reloaded", "1");
      caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => location.reload());
    }
  }
});
