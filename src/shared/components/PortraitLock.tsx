'use client'

import { useEffect } from 'react'

export function PortraitLock() {
  useEffect(() => {
    // Lock to portrait; silently ignore if not supported (desktop browsers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (screen.orientation as any)?.lock?.('portrait').catch(() => {})
  }, [])
  return null
}
