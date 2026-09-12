import { useState, useEffect } from 'react'

const KEY = 'dinner-planner-theme'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem(KEY) === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  return [isDark, () => setIsDark(d => !d)]
}
