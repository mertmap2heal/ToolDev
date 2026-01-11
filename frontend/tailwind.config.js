/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#2D2D2D',
          dark: '#1E1E1E',
        },
        main: {
          DEFAULT: '#F5F5F5',
          light: '#FAFAFA',
        },
      },
    },
  },
  plugins: [],
}
