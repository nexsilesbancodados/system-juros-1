import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WhiteLabelConfig {
  companyName: string;
  companyLogo: string | null;
  primaryColor: string;
  accentColor: string;
  themeMode: "light" | "dark" | "system";
  sidebarStyle: "default" | "minimal" | "gradient";
  loginTitle: string;
  loginSubtitle: string;
  footerText: string;
  borderRadius: string;
  fontFamily: string;
}

interface WhiteLabelContextType {
  config: WhiteLabelConfig;
  refresh: () => void;
  isLoaded: boolean;
  setThemeMode: (mode: "light" | "dark" | "system") => void;
  effectiveTheme: "light" | "dark";
}

const defaults: WhiteLabelConfig = {
  companyName: "SYSTEM JUROS",
  companyLogo: null,
  primaryColor: "#4a86c8",
  accentColor: "#6ba3d6",
  themeMode: "dark",
  sidebarStyle: "default",
  loginTitle: "SYSTEM JUROS",
  loginSubtitle: "SISTEMA DE GESTÃO DE EMPRÉSTIMOS",
  footerText: "© 2025 SYSTEM JUROS · TODOS OS DIREITOS RESERVADOS",
  borderRadius: "16",
  fontFamily: "default",
};

const WhiteLabelContext = createContext<WhiteLabelContextType>({
  config: defaults,
  refresh: () => {},
  isLoaded: false,
  setThemeMode: () => {},
  effectiveTheme: "dark",
});

export const useWhiteLabel = () => useContext(WhiteLabelContext);

function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToHSLValues(hex: string) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const FONT_MAP: Record<string, string> = {
  default: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  roboto: "'Roboto', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  montserrat: "'Montserrat', system-ui, sans-serif",
  nunito: "'Nunito', system-ui, sans-serif",
};

function applyConfig(config: WhiteLabelConfig) {
  const root = document.documentElement;
  const { primaryColor: primary, accentColor: accent } = config;

  // Colors
  const pHSL = hexToHSL(primary);
  const { h, s } = hexToHSLValues(primary);
  root.style.setProperty("--primary", pHSL);
  root.style.setProperty("--ring", pHSL);
  const pVals = hexToHSLValues(primary);
  const fgLight = pVals.l > 55 ? `${h} ${Math.min(s, 20)}% 8%` : `0 0% 100%`;
  root.style.setProperty("--primary-foreground", fgLight);
  root.style.setProperty("--gradient-gold", `linear-gradient(135deg, ${primary}, ${accent}, ${primary})`);
  root.style.setProperty("--gradient-button", `linear-gradient(135deg, ${primary}, ${accent}, ${primary})`);
  root.style.setProperty("--shadow-glow", `0 0 20px ${primary}33, 0 0 60px ${primary}15`);

  // Border radius
  const br = config.borderRadius || "16";
  root.style.setProperty("--radius", `${br}px`);

  // Font family
  const font = FONT_MAP[config.fontFamily] || FONT_MAP.default;
  root.style.setProperty("--font-body", font);
}

function applyThemeMode(mode: "light" | "dark") {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem("theme", mode);
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

export const WhiteLabelProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<WhiteLabelConfig>(defaults);
  const [isLoaded, setIsLoaded] = useState(false);
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("dark");

  const resolveTheme = useCallback((mode: "light" | "dark" | "system"): "light" | "dark" => {
    if (mode === "system") return getSystemTheme();
    return mode;
  }, []);

  const loadConfig = useCallback(async () => {
    if (!user) {
      setConfig(defaults);
      setIsLoaded(true);
      const stored = localStorage.getItem("theme") as "light" | "dark" | null;
      const resolved = stored || "dark";
      setEffectiveTheme(resolved);
      applyThemeMode(resolved);
      return;
    }

    const { data } = await supabase
      .from("settings")
      .select("company_name, company_logo_url, primary_color, accent_color, theme_mode, sidebar_style, login_title, login_subtitle, footer_text, border_radius, font_family")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const s = data as any;
      const newConfig: WhiteLabelConfig = {
        companyName: s.company_name || defaults.companyName,
        companyLogo: s.company_logo_url || null,
        primaryColor: s.primary_color || defaults.primaryColor,
        accentColor: s.accent_color || defaults.accentColor,
        themeMode: (s.theme_mode || defaults.themeMode) as WhiteLabelConfig["themeMode"],
        sidebarStyle: (s.sidebar_style || defaults.sidebarStyle) as WhiteLabelConfig["sidebarStyle"],
        loginTitle: s.login_title || defaults.loginTitle,
        loginSubtitle: s.login_subtitle || defaults.loginSubtitle,
        footerText: s.footer_text || defaults.footerText,
        borderRadius: s.border_radius || defaults.borderRadius,
        fontFamily: s.font_family || defaults.fontFamily,
      };
      setConfig(newConfig);
      applyConfig(newConfig);
      const resolved = resolveTheme(newConfig.themeMode);
      setEffectiveTheme(resolved);
      applyThemeMode(resolved);
    } else {
      applyThemeMode("dark");
    }
    setIsLoaded(true);
  }, [user, resolveTheme]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (isLoaded) {
      applyConfig(config);
      const resolved = resolveTheme(config.themeMode);
      setEffectiveTheme(resolved);
      applyThemeMode(resolved);
    }
  }, [config, isLoaded, resolveTheme]);

  // Listen for system theme changes when mode is "system"
  useEffect(() => {
    if (config.themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setEffectiveTheme(resolved);
      applyThemeMode(resolved);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [config.themeMode]);

  const setThemeMode = useCallback((mode: "light" | "dark" | "system") => {
    setConfig(prev => ({ ...prev, themeMode: mode }));
    const resolved = resolveTheme(mode);
    setEffectiveTheme(resolved);
    applyThemeMode(resolved);
  }, [resolveTheme]);

  return (
    <WhiteLabelContext.Provider value={{ config, refresh: loadConfig, isLoaded, setThemeMode, effectiveTheme }}>
      {children}
    </WhiteLabelContext.Provider>
  );
};
