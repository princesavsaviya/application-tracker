/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D1117',
        surface: '#161B22',
        border: '#21262D',
        muted: '#6E7681',
        accent: '#3FB950',
        warn: '#F85149',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'SF Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
