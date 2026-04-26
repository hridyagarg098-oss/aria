/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#1e3a5f',
          light: '#2d5282',
          dark: '#142a47',
          50: '#eef3f9',
        },
        gold: {
          DEFAULT: '#c8960a',
          light: '#f5c842',
          bg: '#fef9e7',
        },
        bg: '#f8f9fa',
        surface: '#ffffff',
        border: '#e5e7eb',
        status: {
          'success-bg': '#d1fae5',
          'success-text': '#065f46',
          'error-bg': '#fee2e2',
          'error-text': '#991b1b',
          'warning-bg': '#fef3c7',
          'warning-text': '#92400e',
          'info-bg': '#dbeafe',
          'info-text': '#1e40af',
        },
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        pill: '100px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06)',
        sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
      },
      fontSize: {
        hero: ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'section-head': ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        'card-title': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.6' }],
        label: ['11px', { letterSpacing: '0.08em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
