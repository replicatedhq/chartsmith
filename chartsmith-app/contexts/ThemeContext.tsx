"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "auto";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'dark'
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : 'dark'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Set cookie with theme preference
    document.cookie = `theme=${newTheme}; path=/; SameSite=Lax`;
    setThemeState(newTheme);
  };

  useEffect(() => {
    const activeTheme = theme === 'auto' ? systemTheme : theme;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(activeTheme);
    document.documentElement.style.setProperty('color-scheme', activeTheme);
  }, [theme, systemTheme]);

  const resolvedTheme = theme === 'auto' ? systemTheme : theme;

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
