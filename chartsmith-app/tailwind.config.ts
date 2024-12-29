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
      },
    },
  },
  plugins: [],
} satisfies Config;
