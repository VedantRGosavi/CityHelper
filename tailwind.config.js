/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Univers', 'sans-serif'],
      },
      colors: {
        'phthalo-green': '#123832',
      },
    },
  },
  plugins: [],
}