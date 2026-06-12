'use client'

import { useState } from 'react'
import { CycleCard } from '@/shared/components/CycleCard'
import { useWorkData } from '@/shared/lib/work-data-context'
import { useSearch } from '@/shared/lib/search-context'
import { matchesCycle } from '@/shared/lib/search-utils'
import { type CycleFilter, cycleHasMatchingItems, CADENCE_FILTERS } from '@/shared/lib/filter-utils'
import { Settings } from 'lucide-react'

const filters: CycleFilter[] = ['All', '⚠️ Urgent', 'Light', 'Medium', 'Heavy', 'Weekly', 'Monthly']

export function OpsTab() {
  const [active, setActive] = useState<CycleFilter>('All')
  const { opsCycles } = useWorkData()
  const { query } = useSearch()

  const filtered = opsCycles.filter(cycle => {
    const chipMatch = (() => {
      if (active === 'All') return true
      if (active === 'Weekly' || active === 'Monthly') return false
      return cycleHasMatchingItems(cycle, active)
    })()
    return chipMatch && matchesCycle(cycle, query)
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-white">Ops</h2>
        <p className="text-xs text-white/35 mt-0.5">
          {opsCycles.length === 0
            ? 'Vendor & contract management, expenses, arrangements'
            : `${filtered.length} of ${opsCycles.length} cycles${query ? ` — "${query}"` : ''}`}
        </p>
      </div>

      {opsCycles.length > 0 && (
        <div className="px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-none">
          {filters.map(chip => (
            <button
              key={chip}
              onClick={() => setActive(chip)}
              className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-all ${
                active === chip
                  ? 'bg-ops/20 border-ops/50 text-ops font-semibold'
                  : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/65'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div className="px-6 pb-8 space-y-3">
        {opsCycles.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-ops/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-ops/60" />
            </div>
            <p className="text-sm text-white/40">No Ops tasks yet</p>
            <p className="text-xs text-white/25">Approve inbox items to Ops or use + to add tasks</p>
          </div>
        ) : filtered.length === 0 ? (
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
