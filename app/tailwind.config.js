/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6a77fb', // Indigo
        accent: '#50e9f0', // Teal
        error: '#FF4856', // Red
        dark: {
          DEFAULT: '#161616',
          surface: '#1E1E1E',
          border: '#2A2A2A',
        },
        light: {
          DEFAULT: '#ffffff',
          surface: '#f5f5f5',
          border: '#e5e5e5',
        },
        neutral: {
          DEFAULT: '#585858',
          light: '#6E6E6E',
          dark: '#424242',
        }
      },
      backgroundColor: {
        'app': 'var(--background)',
        'surface': 'var(--surface)',
      },
      borderColor: {
        'app': 'var(--border)',
      },
      textColor: {
        'app': 'var(--text)',
      },
    },
  },
  plugins: [],
};