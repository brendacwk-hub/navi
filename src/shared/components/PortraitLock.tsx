'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function PortraitLock() {
  const pathname = usePathname()
  const isWidget = pathname.startsWith('/widget')

  useEffect(() => {
    if (isWidget) return

    const preventTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    const preventGesture = (e: Event) => { e.preventDefault() }
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    document.addEventListener('touchmove', preventTouchZoom, { passive: false })
    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })
    document.addEventListener('wheel', preventWheelZoom, { passive: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(screen.orientation as any)?.lock?.('portrait').catch(() => {})

    return () => {
      document.removeEventListener('touchmove', preventTouchZoom)
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('wheel', preventWheelZoom)
    }
  }, [isWidget])

  return null
}
