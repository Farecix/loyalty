/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans Thai"', '"Noto Sans"', 'system-ui', 'sans-serif'] },
      colors: { ink: '#1c1917', brand: { DEFAULT: '#b45309', dark: '#78350f', light: '#fef3c7' } },
    },
  },
  plugins: [],
}
