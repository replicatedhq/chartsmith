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
  defaultTheme = 'auto'
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isHydrated, setIsHydrated] = useState(false);

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">('dark');

  // Hydration effect - read theme from cookie only after client hydration
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsHydrated(true);

    // Read theme from cookie after hydration to prevent SSR mismatch
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('theme='))
      ?.split('=')[1];

    if (cookieValue && ['light', 'dark', 'auto'].includes(cookieValue)) {
      setThemeState(cookieValue as Theme);
    }

    // Set initial system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Set cookie with theme preference
    if (typeof window !== 'undefined') {
      document.cookie = `theme=${newTheme}; path=/; SameSite=Lax`;
    }
    setThemeState(newTheme);
  };

  useEffect(() => {
    // Only apply theme to DOM after hydration to prevent mismatch
    if (!isHydrated || typeof window === 'undefined') return;

    const activeTheme = theme === 'auto' ? systemTheme : theme;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(activeTheme);
    document.documentElement.style.setProperty('color-scheme', activeTheme);
    // Set CSS variables for theme
    if (activeTheme === 'dark') {
      document.documentElement.style.setProperty('--background', '#0f0f0f');
      document.documentElement.style.setProperty('--surface', '#1a1a1a');
      document.documentElement.style.setProperty('--border', '#2f2f2f');
      document.documentElement.style.setProperty('--text', '#ffffff');
    } else {
      document.documentElement.style.setProperty('--background', '#ffffff');
      document.documentElement.style.setProperty('--surface', '#f1f5f9');
      document.documentElement.style.setProperty('--border', '#e2e8f0');
      document.documentElement.style.setProperty('--text', '#0f172a');
    }
  }, [theme, systemTheme, isHydrated]);

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
