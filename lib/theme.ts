export type Theme = 'light' | 'dark'

const KEY = 'hr_theme'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const v = window.localStorage.getItem(KEY)
  if (v === 'light' || v === 'dark') return v
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  window.localStorage.setItem(KEY, theme)
}
