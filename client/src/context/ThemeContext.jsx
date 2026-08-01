import { useCallback, useEffect, useState } from 'react'
import { STORAGE } from '@/utils/constants'
import { ThemeContext } from './contexts'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark',
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE.theme, theme)
    } catch {
      /* private mode — the in-memory value still applies */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}
