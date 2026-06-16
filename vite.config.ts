import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy/independent vendor groups so the initial app shell stays small
        // and rarely-used features (PDF, charts, motion) load on demand.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Mantém recharts + TODAS as suas dependências (d3-*, victory-vendor,
          // react-smooth, internmap, delaunator, robust-predicates, etc.) num único
          // chunk para evitar "Cannot access 'X' before initialization" causado por
          // dependências circulares divididas em chunks diferentes.
          if (
            id.includes("recharts") ||
            id.includes("victory-vendor") ||
            id.includes("react-smooth") ||
            id.includes("/d3-") ||
            id.includes("internmap") ||
            id.includes("delaunator") ||
            id.includes("robust-predicates")
          ) return "vendor-charts";
          if (id.includes("jspdf") || id.includes("html2pdf") || id.includes("html2canvas")) return "vendor-pdf";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("emoji-picker-react")) return "vendor-emoji";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-tanstack";
          if (id.includes("react-router")) return "vendor-router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) return "vendor-react";
        },
      },
    },
  },
}));
