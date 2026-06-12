'use client'

import { useState } from 'react'
import { useWorkData } from '@/shared/lib/work-data-context'
import { CycleCard } from '@/shared/components/CycleCard'
import { useSearch } from '@/shared/lib/search-context'
import { matchesCycle } from '@/shared/lib/search-utils'
import { type CycleFilter, cycleHasMatchingItems, CADENCE_FILTERS } from '@/shared/lib/filter-utils'

const filters: CycleFilter[] = ['All', '⚠️ Urgent', 'Light', 'Medium', 'Heavy', 'Monthly']

export function HRTab() {
  const [active, setActive] = useState<CycleFilter>('All')
  const { hrCycles } = useWorkData()
  const { query } = useSearch()

  const filtered = hrCycles.filter(cycle => {
    const chipMatch = (() => {
      if (active === 'All') return true
      if (active === 'Monthly') return true   // all HR cycles are monthly
      return cycleHasMatchingItems(cycle, active)
    })()
    return chipMatch && matchesCycle(cycle, query)
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-white">HR</h2>
        <p className="text-xs text-white/35 mt-0.5">
          {filtered.length} of {hrCycles.length} cycles
          {query && <span className="ml-1 text-hr/70">— &quot;{query}&quot;</span>}
        </p>
      </div>

      <div className="px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map(chip => (
          <button
            key={chip}
            onClick={() => setActive(chip)}
            className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-all ${
              active === chip
                ? 'bg-hr/20 border-hr/50 text-hr font-semibold'
                : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/65'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="px-6 pb-8 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/30">
            {query ? `No cycles match "${query}"` : 'No cycles match this filter'}
          </div>
        ) : (
          filtered.map(cycle => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              filter={CADENCE_FILTERS.has(active) ? 'All' : active}
            />
          ))
        )}
      </div>
    </div>
  )
}
