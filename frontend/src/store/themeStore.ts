import { create } from 'zustand'

export type Theme = 'light' | 'midnight'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isDark: boolean
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'midnight'
  try {
    const stored = localStorage.getItem('app-theme')
    if (stored === 'light' || stored === 'midnight') return stored
  } catch {
    // ignore
  }
  return 'midnight'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'midnight') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  root.setAttribute('data-theme', theme)
  localStorage.setItem('app-theme', theme)
}

// Apply on load immediately
const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  isDark: initialTheme === 'midnight',
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme, isDark: theme === 'midnight' })
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'midnight' ? 'light' : 'midnight'
      applyTheme(next)
      return { theme: next, isDark: next === 'midnight' }
    })
  },
}))
