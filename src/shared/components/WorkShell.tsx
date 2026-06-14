'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { QuickAddButton } from './QuickAddButton'
import { useWorkData } from '@/shared/lib/work-data-context'

const PULL_THRESHOLD = 72

export function WorkShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  const { refreshData } = useWorkData()
  const [pullDist, setPullDist]     = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const mainRef       = useRef<HTMLDivElement>(null)
  const touchStartY   = useRef(0)
  const isPulling     = useRef(false)
  const refreshingRef = useRef(false)

  // Keep ref in sync so the native listener can read it without stale closure
  useEffect(() => { refreshingRef.current = refreshing }, [refreshing])

  // Walk up from the touch target to find the actual scrollable element
  const findScrollEl = (target: EventTarget | null): HTMLElement | null => {
    let el = target as HTMLElement | null
    while (el && el !== mainRef.current) {
      if (el.scrollHeight > el.clientHeight + 1) return el
      el = el.parentElement
    }
    return null
  }

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollEl = findScrollEl(e.target)
    const atTop = !scrollEl || scrollEl.scrollTop <= 0
    if (atTop) {
      touchStartY.current = e.touches[0].clientY
      isPulling.current = true
    } else {
      isPulling.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Use a native (non-passive) touchmove listener so we can preventDefault
  // and prevent the page from bouncing while the user is pulling
  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    const handleMove = (e: TouchEvent) => {
      if (!isPulling.current || refreshingRef.current) return
      const dist = e.touches[0].clientY - touchStartY.current
      if (dist > 8) {
        e.preventDefault()
        setPullDist(Math.min(dist, PULL_THRESHOLD * 1.5))
      } else if (dist < 0) {
        // User scrolled up — cancel pull
        isPulling.current = false
        setPullDist(0)
      }
    }

    el.addEventListener('touchmove', handleMove, { passive: false })
    return () => el.removeEventListener('touchmove', handleMove)
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false
    const dist = pullDist

    if (dist >= PULL_THRESHOLD) {
      setRefreshing(true)
      setPullDist(PULL_THRESHOLD)
      await refreshData()
      setTimeout(() => { setRefreshing(false); setPullDist(0) }, 400)
    } else {
      setPullDist(0)
    }
  }, [pullDist, refreshData])

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const openSidebar = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setSidebarOpen(true)
  }
  const scheduledClose = () => {
    closeTimer.current = setTimeout(() => setSidebarOpen(false), 180)
  }
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  const pullProgress = Math.min(pullDist / PULL_THRESHOLD, 1)

  return (
    <div className="flex flex-col h-full">
      <Header
        onMenuClick={() => setSidebarOpen(o => !o)}
        onMenuHover={openSidebar}
      />

      <div className="flex-1 relative overflow-hidden">
        {sidebarOpen && (
          <div className="absolute inset-0 z-30 bg-black/60" onClick={() => setSidebarOpen(false)} />
        )}

        <div
          className={`absolute top-0 left-0 bottom-0 z-40 w-[220px] transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduledClose}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <main
          ref={mainRef}
          className="h-full overflow-hidden flex relative"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Pull indicator */}
          {pullDist > 4 && (
            <div
              className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none"
              style={{ height: `${pullDist}px`, opacity: pullProgress }}
            >
              <div
                className={`w-8 h-8 rounded-full bg-navi-blue/20 border border-navi-blue/40 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}
                style={{ transform: `rotate(${pullProgress * 180}deg)` }}
              >
                <RefreshCw className="w-3.5 h-3.5 text-navi-blue" />
              </div>
            </div>
          )}

          <div
            className="flex-1 overflow-hidden flex"
            style={{ transform: pullDist > 4 ? `translateY(${pullDist}px)` : undefined, transition: pullDist === 0 ? 'transform 0.2s ease' : undefined }}
          >
            {children}
          </div>
          <QuickAddButton />
        </main>
      </div>
    </div>
  )
}
