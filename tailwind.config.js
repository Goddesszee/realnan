/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        nan: {
          // ── Core backgrounds — mirror useNanTheme DARK + nan-theme.css v5 ──
          bg:          '#0B0F19',
          'bg-2':      '#0F1520',
          surface:     '#111827',
          'surface-2': '#1A2235',
          'surface-3': '#202C42',
          // ── Brand blue — single source of truth: #3B82F6 ──
          blue:        '#3B82F6',
          'blue-hover':'#2563EB',
          'blue-dim':  'rgba(59,130,246,0.10)',
          'blue-glow': 'rgba(59,130,246,0.22)',
          // ── Text ──
          text:        '#F9FAFB',
          'text-2':    '#9CA3AF',
          'text-3':    '#4B5563',
          // ── Semantic ──
          green:       '#10B981',
          'green-dim': 'rgba(16,185,129,0.10)',
          red:         '#EF4444',
          'red-dim':   'rgba(239,68,68,0.10)',
          gold:        '#F59E0B',
          'gold-dim':  'rgba(245,158,11,0.10)',
        },
      },
      borderRadius: {
        'nan-sm': '8px',
        nan:      '12px',
        'nan-md': '12px',
        'nan-lg': '16px',
        'nan-xl': '20px',
      },
      animation: {
        'nan-up':      'nan-up 0.22s ease both',
        'nan-fade':    'nan-fade 0.18s ease both',
        'nan-pulse':   'nan-pulse 2s ease infinite',
        'nan-spin':    'nan-spin 0.7s linear infinite',
        'nan-shimmer': 'nan-shimmer 1.4s ease infinite',
      },
      keyframes: {
        'nan-up':      { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'nan-fade':    { from: { opacity: '0' }, to: { opacity: '1' } },
        'nan-pulse':   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        'nan-spin':    { to: { transform: 'rotate(360deg)' } },
        'nan-shimmer': { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      backgroundImage: {
        'nan-glow': 'radial-gradient(ellipse 900px 500px at 22% -10%, rgba(59,130,246,0.12), transparent 60%), radial-gradient(ellipse 700px 500px at 85% 15%, rgba(59,130,246,0.06), transparent 60%)',
        'nan-card': 'linear-gradient(145deg, #0F1520 0%, #111827 55%, #0B0F19 100%)',
        'nan-cta':  'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))',
      },
    },
  },
  plugins: [],
}
