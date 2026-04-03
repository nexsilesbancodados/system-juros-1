import { createContext, useContext } from "react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { effectiveTheme, setThemeMode } = useWhiteLabel();

  const toggleTheme = () => {
    setThemeMode(effectiveTheme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
