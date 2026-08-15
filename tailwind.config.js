/** @type {import('tailwindcss').Config} */

// Couleurs pilotées par variable CSS (--<nom>: "R G B") : supporte les
// modificateurs d'opacité Tailwind (bg-night-900/40) ET permet au Mode
// Clair de re-teinter TOUTE l'app en changeant seulement les variables
// dans index.css — zéro modification des ~25 fichiers de vues.
function withOpacity(varName) {
  // Syntaxe CSS Color 4 : la variable contient "R G B" (espaces, pas de
  // virgules) -> rgb(var(--x) / alpha). "rgba(var(--x), alpha)" est INVALIDE
  // (rgba() attend 4 arguments séparés par des virgules, pas un triplet +
  // une alpha) et fait silencieusement échouer toute la déclaration CSS.
  return ({ opacityValue }) =>
    opacityValue !== undefined ? `rgb(var(${varName}) / ${opacityValue})` : `rgb(var(${varName}))`;
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charte « Dark Glass-Orange » : noir zinc profond + orange néon (Cyber-Amber).
        // Tokens conservés (night/energy/fuel) -> re-brand global sans toucher aux vues.
        // night + slate sont var-ifiés (voir index.css) pour porter le Mode Clair ;
        // les valeurs par défaut (:root) sont pixel-identiques à l'ancien thème sombre.
        night: {
          50: withOpacity('--color-night-50'),
          100: withOpacity('--color-night-100'),
          800: withOpacity('--color-night-800'),
          900: withOpacity('--color-night-900'),
          950: withOpacity('--color-night-950'),
        },
        slate: {
          50: withOpacity('--color-slate-50'),
          100: withOpacity('--color-slate-100'),
          200: withOpacity('--color-slate-200'),
          300: withOpacity('--color-slate-300'),
          400: withOpacity('--color-slate-400'),
          500: withOpacity('--color-slate-500'),
          600: withOpacity('--color-slate-600'),
          700: withOpacity('--color-slate-700'),
          800: withOpacity('--color-slate-800'),
          900: withOpacity('--color-slate-900'),
          950: withOpacity('--color-slate-950'),
        },
        energy: {
          // « Le Feu Sacré » — orange vif #f97316
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        fuel: {
          // Or ambré complémentaire (gasoil, métriques secondaires)
          300: '#fcd34d',
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
