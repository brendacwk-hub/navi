'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CycleCard } from '@/shared/components/CycleCard'
import { useWorkData } from '@/shared/lib/work-data-context'
import { useSearch } from '@/shared/lib/search-context'
import { matchesCycle } from '@/shared/lib/search-utils'
import { type CycleFilter, cycleHasMatchingItems, CADENCE_FILTERS } from '@/shared/lib/filter-utils'
import { computeSortDate, sortCycles } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'
import { Settings } from 'lucide-react'

const CHIP_FILTERS: CycleFilter[] = ['All', '⚠️ Urgent', 'Light', 'Medium', 'Heavy']

const OPS_SUB_AREAS = ['Vendor & Contracts', 'Expenses', 'Arrangements', 'AI']

function groupBySubArea(cycles: Cycle[], subAreaOrder: string[]): { subArea: string; cycles: Cycle[] }[] {
  const groups = new Map<string, Cycle[]>()
  const ungrouped: Cycle[] = []
  for (const cycle of cycles) {
    const key = cycle.subArea ?? ''
    if (!key) { ungrouped.push(cycle); continue }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(cycle)
  }
  const result: { subArea: string; cycles: Cycle[] }[] = []
  for (const sub of subAreaOrder) {
    const items = groups.get(sub)
    if (items && items.length > 0) result.push({ subArea: sub, cycles: items })
  }
  for (const [sub, items] of groups) {
    if (!OPS_SUB_AREAS.includes(sub)) result.push({ subArea: sub, cycles: items })
  }
  if (ungrouped.length > 0) result.push({ subArea: '', cycles: ungrouped })
  return result
}

function OpsTabInner() {
  const [chipFilter, setChipFilter] = useState<CycleFilter>('All')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const { opsCycles } = useWorkData()
  const { query } = useSearch()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeSub = searchParams.get('sub')

  const setSubArea = (sub: string | null) => {
    setOverflowOpen(false)
    router.push(sub ? `/work/ops?sub=${encodeURIComponent(sub)}` : '/work/ops')
  }

  const sortedSubAreas = useMemo(() => {
    const minDate = new Map<string, number>()
    for (const sub of OPS_SUB_AREAS) {
      const min = opsCycles
        .filter(c => c.subArea === sub)
        .reduce((m, c) => Math.min(m, computeSortDate(c.triggerLabel)), Infinity)
      minDate.set(sub, min)
    }
    return [...OPS_SUB_AREAS].sort((a, b) => {
      const da = minDate.get(a) ?? Infinity
      const db = minDate.get(b) ?? Infinity
      if (da === db) return OPS_SUB_AREAS.indexOf(a) - OPS_SUB_AREAS.indexOf(b)
      return da - db
    })
  }, [opsCycles])

  const countBySub = useMemo(() => OPS_SUB_AREAS.reduce<Record<string, number>>((acc, sub) => {
    acc[sub] = opsCycles.filter(c => c.subArea === sub).length
    return acc
  }, {}), [opsCycles])

  const sortedFiltered = useMemo(() => sortCycles(
    opsCycles.filter(cycle => {
      if (activeSub && cycle.subArea !== activeSub) return false
      const chipMatch = (() => {
        if (chipFilter === 'All') return true
        return cycleHasMatchingItems(cycle, chipFilter)
      })()
      return chipMatch && matchesCycle(cycle, query)
    })
  ), [opsCycles, activeSub, chipFilter, query])

  const groups = useMemo(() => groupBySubArea(sortedFiltered, sortedSubAreas), [sortedFiltered, sortedSubAreas])
  const showGroups = !activeSub && chipFilter === 'All' && !query

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-white">Ops</h2>
        <p className="text-xs text-white/35 mt-0.5">
          {sortedFiltered.length < opsCycles.length || query
            ? <>{sortedFiltered.length} of {opsCycles.length} cycles{query && <span className="ml-1 text-ops/70">— &quot;{query}&quot;</span>}</>
            : <>{opsCycles.length} cycles</>}
        </p>
      </div>

      {/* Sub-area underline tab bar */}
      <div className="relative border-b border-white/8">
        <div className="flex overflow-x-auto overflow-y-hidden scrollbar-none px-3">
          <button
            onClick={() => setSubArea(null)}
            className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
              !activeSub ? 'border-ops text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            All
          </button>
          {sortedSubAreas.map(sub => (
            <button
              key={sub}
              onClick={() => setSubArea(sub)}
              className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
                activeSub === sub ? 'border-ops text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {sub}
              <span className={`ml-1 text-[11px] ${activeSub === sub ? 'text-ops/60' : 'text-white/20'}`}>
                ({countBySub[sub]})
              </span>
            </button>
          ))}
        </div>

        <div className="hidden sm:flex absolute right-0 top-0 bottom-0 items-stretch pointer-events-none">
          <div className="w-8 bg-gradient-to-l from-[rgba(12,12,12,1)] to-transparent" />
        </div>
        <div className="hidden sm:flex absolute right-0 top-0 bottom-0 items-center">
          <button
            onClick={() => setOverflowOpen(o => !o)}
            className="h-full px-3 text-white/40 hover:text-white/70 text-sm font-bold transition-colors bg-[rgba(12,12,12,0.95)] border-b-2 border-transparent -mb-px"
          >
            ···
          </button>
        </div>

        {overflowOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-sidebar border border-white/10 rounded-xl shadow-2xl py-1.5 w-[200px]">
              <div className="px-3 pb-1.5 mb-0.5 border-b border-white/6">
                <span className="text-[10px] font-bold text-ops/60 uppercase tracking-widest">Ops</span>
              </div>
              <button onClick={() => setSubArea(null)}
                className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                  !activeSub ? 'text-ops font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                All
              </button>
              {sortedSubAreas.map(sub => (
                <button key={sub} onClick={() => setSubArea(sub)}
                  className={`w-full text-left px-4 py-2 text-[13px] flex items-center justify-between transition-colors ${
                    activeSub === sub ? 'text-ops font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{sub}</span>
                  <span className="text-[11px] text-white/25">({countBySub[sub]})</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <>
      {/* Chip filter row */}
      <div className="relative pl-6 pt-4 pb-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pr-8">
          {CHIP_FILTERS.map(chip => (
            <button
              key={chip}
              onClick={() => setChipFilter(chip)}
              className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-all ${
                chipFilter === chip
                  ? 'bg-ops/20 border-ops/50 text-ops font-semibold'
                  : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/65'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-4 bottom-3 w-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(12,12,12,0.95), transparent)' }} />
      </div>

      {/* Content */}
      <div className="px-6 pb-8">
        {opsCycles.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-ops/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-ops/60" />
            </div>
            <p className="text-sm text-white/40">No Ops cycles yet</p>
            <p className="text-xs text-white/25">Use + to add tasks or run a template</p>
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/30">
            {activeSub ? `No cycles in ${activeSub}` : query ? `No cycles match "${query}"` : 'No cycles match this filter'}
          </div>
        ) : showGroups ? (
          <div className="space-y-6">
            {groups.map(({ subArea, cycles }) => (
              <div key={subArea || '_none'}>
                {subArea && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-ops/60">{subArea}</span>
                    <div className="flex-1 h-px bg-ops/15" />
                  </div>
                )}
                <div className="space-y-3">
                  {cycles.map(cycle => (
                    <CycleCard key={cycle.id} cycle={cycle} filter={CADENCE_FILTERS.has(chipFilter) ? 'All' : chipFilter} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFiltered.map(cycle => (
              <CycleCard key={cycle.id} cycle={cycle} filter={CADENCE_FILTERS.has(chipFilter) ? 'All' : chipFilter} />
            ))}
          </div>
        )}
      </div>
      </>
    </div>
  )
}

export function OpsTab() {
  return (
    <Suspense fallback={<div className="flex-1 overflow-y-auto px-6 pt-5"><div className="text-white/30 text-sm">Loading…</div></div>}>
      <OpsTabInner />
    </Suspense>
  )
}
