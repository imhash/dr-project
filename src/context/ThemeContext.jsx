import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({})

export const THEMES = {
  light: { label: 'Light', isDark: false, swatch: '#f1f5f9' },
  dark:  { label: 'Dark',  isDark: true,  swatch: '#1a1d27' },
}

function applyTheme(name) {
  const t = THEMES[name] ?? THEMES.light
  document.documentElement.setAttribute('data-theme', name)
  document.documentElement.classList.toggle('dark', t.isDark)
}

async function fetchTheme() {
  try {
    const res = await fetch('/api/theme')
    if (!res.ok) throw new Error()
    const { theme } = await res.json()
    return THEMES[theme] ? theme : 'light'
  } catch {
    return 'light'
  }
}

async function persistTheme(name) {
  try {
    await fetch('/api/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: name }),
    })
  } catch {}
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')

  useEffect(() => {
    // Check localStorage first for instant load, then server
    const stored = localStorage.getItem('ctm-theme')
    const initial = (stored && THEMES[stored]) ? stored : 'light'
    applyTheme(initial)
    setThemeState(initial)

    fetchTheme().then((name) => {
      applyTheme(name)
      setThemeState(name)
    })
  }, [])

  function setTheme(name) {
    if (!THEMES[name]) return
    applyTheme(name)
    setThemeState(name)
    localStorage.setItem('ctm-theme', name)
    persistTheme(name)
  }

  const dark   = THEMES[theme]?.isDark ?? false
  const toggle = () => setTheme(dark ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

export function useT() {
  return {
    pageBg:     'bg-[var(--pageBg)]',
    card:       'bg-[var(--card)]',
    cardHover:  'hover:bg-[var(--cardHover)]',
    inner:      'bg-[var(--inner)]',
    tableHead:  'bg-[var(--tableHead)]',
    inputBg:    'bg-[var(--inputBg)]',
    border:     'border-[var(--border)]',
    borderDash: 'border-[var(--borderDash)]',
    text:       'text-[var(--text)]',
    textSub:    'text-[var(--textSub)]',
    textMuted:  'text-[var(--textMuted)]',
    textFaint:  'text-[var(--textFaint)]',
    textCode:   'text-[var(--textCode)]',
    header:     'bg-[var(--card)] border-[var(--border)]',
  }
}
