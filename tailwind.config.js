/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charte « Dark Glass-Orange » : noir zinc profond + orange néon (Cyber-Amber).
        // Tokens conservés (night/energy/fuel) -> re-brand global sans toucher aux vues.
        night: {
          50: '#fafafa',
          100: '#f4f4f5',
          800: '#18181c',
          900: '#101014',
          950: '#09090b', // zinc-950 (Dark Space)
        },
        energy: {
          // « Le Feu Sacré » — orange vif #f97316
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        fuel: {
          // Or ambré complémentaire (gasoil, métriques secondaires)
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(249,115,22,0.30), 0 0 20px rgba(249,115,22,0.30), 0 18px 50px -12px rgba(249,115,22,0.35)',
        'glow-soft': '0 0 20px rgba(249,115,22,0.30)',
        card: '0 10px 40px -15px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-neon': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 12px currentColor' },
          '50%': { opacity: '0.55', boxShadow: '0 0 4px currentColor' },
        },
        'float-particle': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '10%': { opacity: '0.7' },
          '90%': { opacity: '0.4' },
          '100%': { transform: 'translateY(-110vh) translateX(6vw)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        shimmer: 'shimmer 2.2s linear infinite',
        'pulse-neon': 'pulse-neon 1.6s ease-in-out infinite',
        'float-particle': 'float-particle linear infinite',
      },
    },
  },
  plugins: [],
};
