'use client'

import { Star } from 'lucide-react'
import type { Cycle } from '@/shared/types'

const AREA_DOT: Record<string, string> = {
  finance: 'bg-finance', hr: 'bg-hr', ops: 'bg-ops', others: 'bg-others',
}

interface WeeklyFocusStripProps {
  focusCycles: Cycle[]
  onSelect: (cycle: Cycle) => void
}

export function WeeklyFocusStrip({ focusCycles, onSelect }: WeeklyFocusStripProps) {
  if (focusCycles.length === 0) return null
  return (
    <div className="rounded-xl border border-navi-blue/20 bg-navi-blue/5 p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Star className="w-3 h-3 text-navi-blue/60" />
        <span className="text-[10px] font-semibold text-navi-blue/70 uppercase tracking-wider">This Week's Focus</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2">
        {focusCycles.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto bg-white/5 border border-white/8 rounded-lg px-2.5 py-1.5 hover:bg-white/10 hover:border-white/15 transition-all active:scale-95"
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AREA_DOT[c.area] ?? 'bg-white/25'}`} />
            <span className="text-[11.5px] text-white/65 font-medium truncate">{c.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
