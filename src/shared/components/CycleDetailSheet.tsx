'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Cycle } from '@/shared/types'
import { CycleCard } from './CycleCard'

interface Props {
  cycle: Cycle | null
  onClose: () => void
}

export function CycleDetailSheet({ cycle, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  // Keep a stable ref so swipe-dismiss effect doesn't re-run on every render
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (cycle) {
      // Defer one frame so the CSS transition plays on mount
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [cycle])

  // Swipe-down to close — only when drag starts in the top handle area
  useEffect(() => {
    if (!cycle) return
    let startY = 0
    let startedInSheet = false
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      // Only trigger swipe-dismiss when touch starts near the top handle (top 60px of sheet)
      const sheetEl = document.querySelector('[data-cycle-sheet]') as HTMLElement | null
      if (sheetEl) {
        const rect = sheetEl.getBoundingClientRect()
        startedInSheet = startY >= rect.top && startY <= rect.top + 60
      } else {
        startedInSheet = false
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!startedInSheet) return
      if (e.changedTouches[0].clientY - startY > 60) onCloseRef.current()
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [cycle]) // stable: onClose accessed via ref, not in deps

  if (!cycle) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/55 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        data-cycle-sheet
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[#111111] border-t border-white/10 max-h-[88vh] flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {/* Handle bar + close */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <div className="w-8" />
          <div className="w-10 h-1 rounded-full bg-white/20" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/35 hover:text-white/65 hover:bg-white/8 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-10 pt-1">
          <CycleCard cycle={cycle} defaultExpanded />
        </div>
      </div>
    </>
  )
}
