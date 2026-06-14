'use client'

import { useEffect, useState } from 'react'

export function PortraitLock() {
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(screen.orientation as any)?.lock?.('portrait').catch(() => {})

    const mq = window.matchMedia('(orientation: landscape)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsLandscape(e.matches)
    handler(mq)
    mq.addEventListener('change', handler as (e: MediaQueryListEvent) => void)
    return () => mq.removeEventListener('change', handler as (e: MediaQueryListEvent) => void)
  }, [])

  if (!isLandscape) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0c0c0c] flex flex-col items-center justify-center gap-4">
      <span className="text-5xl">📱</span>
      <p className="text-white text-base font-semibold">Please rotate to portrait</p>
      <p className="text-white/40 text-sm">Navi is designed for portrait mode</p>
    </div>
  )
}
