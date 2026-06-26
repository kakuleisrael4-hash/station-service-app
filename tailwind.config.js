/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identité visuelle de la station : bleu nuit + vert énergie + ambre carburant
        night: {
          50: '#f4f6fb',
          100: '#e6eaf5',
          800: '#141b2d',
          900: '#0b101e',
          950: '#060912',
        },
        energy: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        fuel: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(16,185,129,0.25), 0 18px 50px -12px rgba(16,185,129,0.35)',
        card: '0 10px 40px -15px rgba(6,9,18,0.5)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};
