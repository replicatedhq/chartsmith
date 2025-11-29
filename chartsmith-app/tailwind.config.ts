import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 100ms ease-in-out forwards',
      },
      colors: {
        app: "var(--background)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        "dark-surface": "var(--surface)",
        "dark-border": "var(--border)",
        primary: {
          DEFAULT: "#6366f1",
          "50": "#eef2ff",
        },
        dark: {
          DEFAULT: "#0f0f0f",
          surface: "#1a1a1a",
          border: "#2f2f2f",
        },
        light: {
          DEFAULT: "#ffffff",
          surface: "#f1f5f9",
          border: "#e2e8f0",
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config;
