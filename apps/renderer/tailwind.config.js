/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // CRÍTICO: habilita las variantes dark: basadas en la clase del elemento raíz
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Mapeados a las variables CSS para que Tailwind y CSS variables
        // coexistan y podamos usar clases como bg-surface, text-muted, etc.
        base:     'var(--bg-base)',
        surface:  'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        border:   'var(--border-base)',
        primary:  'var(--text-primary)',
        muted:    'var(--text-muted)',
        accent:   'var(--blue)',
        success:  'var(--green)',
        danger:   'var(--danger)',
        warn:     'var(--warn)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',   // rounded = 8px (lg industrial)
      },
      boxShadow: {
        card:   '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-md': '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
        focus:  '0 0 0 3px rgba(37,99,235,0.18)',
      },
    },
  },
  plugins: [],
};