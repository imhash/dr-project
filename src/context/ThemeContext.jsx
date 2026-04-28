import { createContext, useContext, useState, useEffect, useRef } from 'react'

const ThemeContext = createContext({})

export const THEMES = {
  dark:     { label: 'Dark',     isDark: true,  swatch: '#1a1d27' },
  light:    { label: 'Light',    isDark: false, swatch: '#f1f5f9' },
  navy:     { label: 'Navy',     isDark: true,  swatch: '#0d1b2e' },
  graphite: { label: 'Graphite', isDark: true,  swatch: '#1c1c1e' },
}

function applyTheme(name) {
  const t = THEMES[name] ?? THEMES.dark
  document.documentElement.setAttribute('data-theme', name)
  document.documentElement.classList.toggle('dark', t.isDark)
}

async function fetchTheme() {
  try {
    const res = await fetch('/api/theme')
    if (!res.ok) throw new Error()
    const { theme } = await res.json()
    return THEMES[theme] ? theme : 'dark'
  } catch {
    return 'dark'
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
  const [theme, setThemeState] = useState('dark')

  useEffect(() => {
    fetchTheme().then((name) => {
      applyTheme(name)
      setThemeState(name)
    })
  }, [])

  function setTheme(name) {
    if (!THEMES[name]) return
    applyTheme(name)
    setThemeState(name)
    persistTheme(name)
  }

  // legacy: components that still destructure { dark, toggle }
  const dark = THEMES[theme]?.isDark ?? true
  const toggle = () => setTheme(dark ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

/** Returns theme-aware class strings backed by CSS custom properties */
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
