import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--color-bg)',
        surface:   'var(--color-surface)',
        border:    'var(--color-border)',
        accent:    'var(--color-accent)',
        'accent-dim': 'var(--color-accent-dim)',
        text:      'var(--color-text)',
        muted:     'var(--color-muted)',
        yellow:    'var(--color-yellow)',
      },
      borderRadius: {
        card: 'var(--radius)',
        sm:   'var(--radius-sm)',
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
