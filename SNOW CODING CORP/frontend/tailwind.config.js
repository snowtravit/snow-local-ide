/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.08)',
          medium: 'rgba(255, 255, 255, 0.12)',
          heavy: 'rgba(255, 255, 255, 0.18)',
          border: 'rgba(255, 255, 255, 0.15)',
        },
        ide: {
          bg: '#0a0a0f',
          surface: '#12121a',
          accent: '#c0c0c0',
          'accent-hover': '#d4d4d4',
          success: '#22c55e',
          error: '#ef4444',
          warning: '#f59e0b',
          text: '#e2e8f0',
          'text-muted': '#94a3b8',
        },
        snow: {
          accent: '#c0c0c0',
          'accent-hover': '#d4d4d4',
          silver: '#b8b8b8',
          ice: '#d0e0f0',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
