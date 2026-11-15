/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#1f2933', soft: '#52606d', faint: '#9aa5b1' },
        paper: { DEFAULT: '#f7f7f5', card: '#ffffff', line: '#e8e8e4' },
        accent: { DEFAULT: '#0f9d8a', soft: '#e3f4f1', dark: '#0b7a6b' }
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.05)' },
      borderRadius: { xl2: '1.25rem' }
    }
  },
  plugins: []
}
