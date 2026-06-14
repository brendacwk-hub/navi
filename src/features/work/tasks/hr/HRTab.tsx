'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useWorkData } from '@/shared/lib/work-data-context'
import { CycleCard } from '@/shared/components/CycleCard'
import { useSearch } from '@/shared/lib/search-context'
import { matchesCycle } from '@/shared/lib/search-utils'
import { type CycleFilter, cycleHasMatchingItems, CADENCE_FILTERS } from '@/shared/lib/filter-utils'
import { computeSortDate, extractFlatItems, formatSortDate } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'
import { TemplatesView } from '@/features/work/templates/TemplatesView'

const CHIP_FILTERS: CycleFilter[] = ['All', 'Latest', '⚠️ Urgent', 'Light', 'Medium', 'Heavy']

const HR_SUB_AREAS = ['Payroll & MPF', 'Insurance & VISA', 'Leave & Attendance', 'Onboarding & Offboarding', 'Tax', 'Records', 'AI']

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
    if (!HR_SUB_AREAS.includes(sub)) result.push({ subArea: sub, cycles: items })
  }
  if (ungrouped.length > 0) result.push({ subArea: '', cycles: ungrouped })
  return result
}

function HRTabInner() {
  const [chipFilter, setChipFilter] = useState<CycleFilter>('All')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const { hrCycles, toggleItem } = useWorkData()
  const { query } = useSearch()
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeSub = searchParams.get('sub')

  const setSubArea = (sub: string | null) => {
    setOverflowOpen(false)
    router.push(sub ? `/work/hr?sub=${encodeURIComponent(sub)}` : '/work/hr')
  }

  // Sub-area tabs ordered by closest deadline
  const sortedSubAreas = useMemo(() => {
    const minDate = new Map<string, number>()
    for (const sub of HR_SUB_AREAS) {
      const min = hrCycles
        .filter(c => c.subArea === sub)
        .reduce((m, c) => Math.min(m, computeSortDate(c.triggerLabel)), Infinity)
      minDate.set(sub, min)
    }
    return [...HR_SUB_AREAS].sort((a, b) => {
      const da = minDate.get(a) ?? Infinity
      const db = minDate.get(b) ?? Infinity
      if (da === db) return HR_SUB_AREAS.indexOf(a) - HR_SUB_AREAS.indexOf(b)
      return da - db
    })
  }, [hrCycles])

  const countBySub = useMemo(() => HR_SUB_AREAS.reduce<Record<string, number>>((acc, sub) => {
    acc[sub] = hrCycles.filter(c => c.subArea === sub).length
    return acc
  }, {}), [hrCycles])

  // Cycles filtered and sorted by deadline
  const sortedFiltered = useMemo(() => {
    return hrCycles
      .filter(cycle => {
        if (activeSub && cycle.subArea !== activeSub) return false
        if (chipFilter === 'Latest') return matchesCycle(cycle, query)
        const chipMatch = (() => {
          if (chipFilter === 'All') return true
          return cycleHasMatchingItems(cycle, chipFilter)
        })()
        return chipMatch && matchesCycle(cycle, query)
      })
      .sort((a, b) => computeSortDate(a.triggerLabel) - computeSortDate(b.triggerLabel))
  }, [hrCycles, activeSub, chipFilter, query])

  // Flat items for Latest view
  const flatItems = useMemo(() => {
    if (chipFilter !== 'Latest') return []
    return extractFlatItems(hrCycles.filter(c => matchesCycle(c, query)))
  }, [chipFilter, hrCycles, query])

  const groups = useMemo(() => groupBySubArea(sortedFiltered, sortedSubAreas), [sortedFiltered, sortedSubAreas])
  const showGroups = !activeSub && chipFilter === 'All' && !query

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-white">HR</h2>
        <p className="text-xs text-white/35 mt-0.5">
          {chipFilter === 'Latest'
            ? <>{flatItems.length} tasks in deadline order</>
            : sortedFiltered.length < hrCycles.length || query
              ? <>{sortedFiltered.length} of {hrCycles.length} cycles{query && <span className="ml-1 text-hr/70">— &quot;{query}&quot;</span>}</>
              : <>{hrCycles.length} cycles</>}
        </p>
      </div>

      {/* Sub-area underline tab bar */}
      <div className="relative border-b border-white/8">
        <div className="flex overflow-x-auto overflow-y-hidden scrollbar-none px-3">
          <button
            onClick={() => setSubArea(null)}
            className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
              !activeSub ? 'border-hr text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            All
          </button>
          {sortedSubAreas.map(sub => (
            <button
              key={sub}
              onClick={() => setSubArea(sub)}
              className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
                activeSub === sub ? 'border-hr text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {sub}
              <span className={`ml-1 text-[11px] ${activeSub === sub ? 'text-hr/60' : 'text-white/20'}`}>
                ({countBySub[sub]})
              </span>
            </button>
          ))}
          <button
            onClick={() => setSubArea('Templates')}
            className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
              activeSub === 'Templates' ? 'border-navi-blue text-navi-blue' : 'border-transparent text-white/30 hover:text-white/55'
            }`}
          >
            Templates
          </button>
        </div>

        <div className="hidden sm:flex absolute right-0 top-0 bottom-0 items-stretch pointer-events-none">
          <div className="w-8 bg-gradient-to-l from-[rgba(12,12,12,1)] to-transparent" />
        </div>

        {overflowOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-sidebar border border-white/10 rounded-xl shadow-2xl py-1.5 w-[220px]">
              <div className="px-3 pb-1.5 mb-0.5 border-b border-white/6">
                <span className="text-[10px] font-bold text-hr/60 uppercase tracking-widest">HR</span>
              </div>
              <button onClick={() => setSubArea(null)}
                className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                  !activeSub ? 'text-hr font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                All
              </button>
              {sortedSubAreas.map(sub => (
                <button key={sub} onClick={() => setSubArea(sub)}
                  className={`w-full text-left px-4 py-2 text-[13px] flex items-center justify-between transition-colors ${
                    activeSub === sub ? 'text-hr font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
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

      {activeSub === 'Templates' ? (
        <TemplatesView area="hr" />
      ) : (
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
                  ? 'bg-hr/20 border-hr/50 text-hr font-semibold'
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
        {chipFilter === 'Latest' ? (
          flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/30">No tasks</div>
          ) : (
            <div className="space-y-0.5">
              {flatItems.map(item => (
                <div key={item.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <button
                    onClick={() => toggleItem('hr', item.cycleId, item.id)}
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-all ${
                      item.status === 'done' ? 'bg-navi-blue border-navi-blue' : 'border-white/30 hover:border-white/60'
                    }`}
                  >
                    {item.status === 'done' && (
                      <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] leading-relaxed ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'} ${item.optional ? 'italic' : ''}`}>
                      {item.urgent && <span className="text-orange-400 mr-1 text-[11px]">⚠</span>}
                      {item.label}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-white/30">{item.cycleTitle}</span>
                      {item.subArea && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-hr/10 text-hr/60 border border-hr/15">
                          {item.subArea}
                        </span>
                      )}
                    </div>
                  </div>
                  {isFinite(item.sortDate) && (
                    <span className="flex-shrink-0 text-[11px] text-white/30 mt-0.5 tabular-nums">
                      {item.due ?? formatSortDate(item.sortDate)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
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
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-hr/60">{subArea}</span>
                    <div className="flex-1 h-px bg-hr/15" />
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
      )}
    </div>
  )
}

export function HRTab() {
  return (
    <Suspense fallback={<div className="flex-1 overflow-y-auto px-6 pt-5"><div className="text-white/30 text-sm">Loading…</div></div>}>
      <HRTabInner />
    </Suspense>
  )
}
