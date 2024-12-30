"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with a default theme that matches what we use server-side
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);

  // After mount, check for stored theme preference
  useEffect(() => {
    const themeCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('theme='));
    const storedTheme = themeCookie ? (themeCookie.split('=')[1] as Theme) : 'dark';
    setThemeState(storedTheme);
    setIsInitialized(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Set cookie with theme preference
    document.cookie = `theme=${newTheme}; path=/; SameSite=Lax`;
    setThemeState(newTheme);
  };

  useEffect(() => {
    if (isInitialized) {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
    }
  }, [theme, isInitialized]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
