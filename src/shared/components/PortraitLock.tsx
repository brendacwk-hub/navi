'use client'

import { useEffect, useState } from 'react'

export function PortraitLock() {
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    // Prevent pinch-to-zoom on touch devices
    const preventTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    // Prevent gesture-based zoom in Safari
    const preventGesture = (e: Event) => { e.preventDefault() }
    // Prevent Ctrl+scroll zoom on desktop
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    document.addEventListener('touchmove', preventTouchZoom, { passive: false })
    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })
    document.addEventListener('wheel', preventWheelZoom, { passive: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(screen.orientation as any)?.lock?.('portrait').catch(() => {})

    // Only lock on touch devices (mobile) — desktop browsers can be any shape
    const mq = window.matchMedia('(orientation: landscape) and (pointer: coarse) and (max-width: 1024px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsLandscape(e.matches)
    handler(mq)
    mq.addEventListener('change', handler as (e: MediaQueryListEvent) => void)
    return () => {
      mq.removeEventListener('change', handler as (e: MediaQueryListEvent) => void)
      document.removeEventListener('touchmove', preventTouchZoom)
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('wheel', preventWheelZoom)
    }
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
