import type { Config } from "tailwindcss";

export default {
  content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
} satisfies Config;
