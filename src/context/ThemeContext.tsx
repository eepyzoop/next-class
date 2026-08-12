import { createContext, useContext, useState, useCallback, type ReactNode, type CSSProperties } from "react";
import { themes, getTheme, defaultThemeId, type Theme } from "../themes";

const STORAGE_KEY = "nextclass_theme_id";

interface ThemeContextValue {
  theme: Theme;
  themeId: string;
  setThemeId: (id: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? defaultThemeId);

  const setThemeId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setThemeIdState(id);
  }, []);

  const theme = getTheme(themeId);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId, themes }}>
      <div
        style={
          {
            background: theme.background,
            minHeight: "100vh",
            color: "#f5f5f7",
            "--panel-color": theme.panelColor,
            "--accent-color": theme.accentColor,
            "--panel-blur": theme.blur,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
