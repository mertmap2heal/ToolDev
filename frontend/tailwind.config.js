/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
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
        ink: {
          primary: 'var(--ink-primary)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          inset: 'var(--surface-inset)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          'primary-hover': 'var(--accent-primary-hover)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger: 'var(--status-danger)',
          info: 'var(--status-info)',
        },
      },
      borderColor: {
        default: 'var(--border-default)',
        strong: 'var(--border-strong)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
