/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gv: {
          blue: '#0021A5',
          orange: '#FA4616',
          navy: '#001A33',
          storm: '#E5E5E5',
          white: '#FFFFFF',
          graphite: '#1A1A1A',
        },
      },
      fontFamily: {
        gv: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'gv-h1': ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '800' }],
        'gv-h2': ['24px', { lineHeight: '1.2', fontWeight: '700' }],
        'gv-h3': ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'gv-body': ['16px', { lineHeight: '1.4', fontWeight: '400' }],
        'gv-body-sm': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        'gv-label': ['12px', { lineHeight: '1.3', fontWeight: '500' }],
      },
      spacing: {
        'gv-1': '4px',
        'gv-2': '8px',
        'gv-3': '12px',
        'gv-4': '16px',
        'gv-5': '24px',
        'gv-6': '32px',
        'gv-7': '48px',
        'gv-8': '64px',
      },
      borderRadius: {
        gvCard: '12px',
        gvPill: '999px',
      },
      boxShadow: {
        gvCard: '0 8px 24px rgba(0, 0, 0, 0.18)',
      },
      borderColor: {
        gvCard: 'rgba(0, 26, 51, 0.2)',
      },
    },
  },
  plugins: [],
};
