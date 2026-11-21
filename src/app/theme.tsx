import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "../lib/ui";

export type Theme = "system" | "light" | "dark";
const KEY = "devkit.theme";
const QUERY = "(prefers-color-scheme: dark)";

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function resolve(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia(QUERY).matches;
}

function stored(): Theme {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(stored);

  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle("dark", resolve(theme));
    apply();
    if (theme !== "system") return;
    // Follow the OS while on "system": macOS can switch appearance at sunset.
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <Segmented
      size="sm"
      label="Appearance"
      value={theme}
      onChange={setTheme}
      options={[
        { value: "system", label: "", hint: "Match system", icon: Monitor },
        { value: "light", label: "", hint: "Light", icon: Sun },
        { value: "dark", label: "", hint: "Dark", icon: Moon },
      ]}
    />
  );
}
