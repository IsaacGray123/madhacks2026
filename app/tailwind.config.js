const v = (name) => `rgb(var(${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark mode follows prefers-color-scheme, which Electron's nativeTheme.themeSource drives from Settings.
  darkMode: 'media',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      colors: {
        // Values live in src/renderer/src/index.css so light/dark themes can swap them.
        ink: { DEFAULT: v('--ink'), soft: v('--ink-soft'), faint: v('--ink-faint') },
        paper: { DEFAULT: v('--paper'), card: v('--paper-card'), line: v('--paper-line') },
        accent: { DEFAULT: v('--accent'), soft: v('--accent-soft'), dark: v('--accent-dark') }
      },
      boxShadow: { card: 'var(--shadow-card)' },
      borderRadius: { xl2: '1.25rem' }
    }
  },
  plugins: []
}
