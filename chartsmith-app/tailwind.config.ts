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
      // Industrial Forge Design System
      fontFamily: {
        // Bold display font for headlines - industrial feel
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        // Clean body font
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        // Monospace for code - distinctive
        mono: ['var(--font-jetbrains-mono)', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Dramatic size scale for impact
        'display-xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-md': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-sm': ['1.875rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'overline': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.12em', fontWeight: '600' }],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px var(--forge-ember)' },
          '50%': { boxShadow: '0 0 40px var(--forge-ember), 0 0 60px var(--forge-ember-dim)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        spark: {
          '0%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1) rotate(180deg)' },
          '100%': { opacity: '0', transform: 'scale(0) rotate(360deg)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out forwards',
        slideUp: 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideDown: 'slideDown 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideInLeft: 'slideInLeft 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideInRight: 'slideInRight 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        scaleIn: 'scaleIn 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shimmer: 'shimmer 2s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 3s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        spark: 'spark 1.5s ease-out infinite',
      },
      colors: {
        // CSS variable-based colors for theming
        app: "var(--background)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        "dark-surface": "var(--surface)",
        "dark-border": "var(--border)",

        // Forge color palette - molten metal inspired
        forge: {
          // Core blacks and grays - like cooled steel
          black: '#09090b',
          charcoal: '#0c0c0e',
          steel: '#18181b',
          iron: '#27272a',
          zinc: '#3f3f46',
          silver: '#71717a',

          // Ember/molten accents - the heart of the forge
          ember: '#f97316',        // Vibrant orange - like molten metal
          'ember-bright': '#fb923c',
          'ember-dim': '#ea580c',
          'ember-glow': '#fdba74',

          // Heat spectrum for gradients
          heat: {
            white: '#fef3c7',      // White-hot
            yellow: '#fbbf24',     // Yellow-hot
            orange: '#f97316',     // Orange glow
            red: '#ef4444',        // Red-hot
            cherry: '#dc2626',     // Cherry red
          },

          // Accent - cool blue for contrast (like quenched steel)
          quench: '#0ea5e9',
          'quench-light': '#38bdf8',
          'quench-dim': '#0284c7',

          // Success/status colors
          success: '#22c55e',
          warning: '#eab308',
          error: '#ef4444',
        },

        // Legacy support
        primary: {
          DEFAULT: "#f97316",
          "50": "#fff7ed",
        },
        dark: {
          DEFAULT: "#09090b",
          surface: "#0c0c0e",
          border: "#27272a",
        },
        light: {
          DEFAULT: "#fafaf9",
          surface: "#f5f5f4",
          border: "#e7e5e4",
        },
      },
      backgroundImage: {
        // Forge-inspired gradients
        'forge-gradient': 'linear-gradient(135deg, var(--forge-charcoal) 0%, var(--forge-black) 100%)',
        'ember-gradient': 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)',
        'heat-gradient': 'linear-gradient(180deg, #fbbf24 0%, #f97316 50%, #ef4444 100%)',
        'steel-gradient': 'linear-gradient(180deg, #3f3f46 0%, #27272a 50%, #18181b 100%)',
        // Noise texture overlay
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        // Glow effects
        'ember-sm': '0 0 10px rgba(249, 115, 22, 0.3)',
        'ember-md': '0 0 20px rgba(249, 115, 22, 0.4)',
        'ember-lg': '0 0 30px rgba(249, 115, 22, 0.5), 0 0 60px rgba(249, 115, 22, 0.2)',
        'quench-sm': '0 0 10px rgba(14, 165, 233, 0.3)',
        'quench-md': '0 0 20px rgba(14, 165, 233, 0.4)',
        // Elevated surfaces
        'forge-sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
        'forge-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'forge-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'forge-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        // Inner shadows for inset elements
        'inner-forge': 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        'forge': '0.375rem', // Subtle rounding - industrial precision
        'forge-lg': '0.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config;
