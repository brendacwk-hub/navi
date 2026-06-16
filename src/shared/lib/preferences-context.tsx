'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type FontScale = 'small' | 'medium' | 'large'

const FONT_SIZE: Record<FontScale, string> = {
  small:  '100%',
  medium: '105%',
  large:  '110%',
}

interface PreferencesCtx {
  fontScale: FontScale
  setFontScale: (scale: FontScale) => void
}

const Ctx = createContext<PreferencesCtx>({ fontScale: 'small', setFontScale: () => {} })

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>('small')

  // Load from Supabase on mount
  useEffect(() => {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(d => {
        const scale = d.font_scale as FontScale
        if (scale && FONT_SIZE[scale]) {
          setFontScaleState(scale)
          document.documentElement.style.fontSize = FONT_SIZE[scale]
        }
      })
      .catch(() => {})
  }, [])

  // Apply to <html> whenever scale changes
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE[fontScale]
  }, [fontScale])

  const setFontScale = (scale: FontScale) => {
    setFontScaleState(scale)
    fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_scale: scale }),
    }).catch(() => {})
  }

  return <Ctx.Provider value={{ fontScale, setFontScale }}>{children}</Ctx.Provider>
}

export const usePreferences = () => useContext(Ctx)
