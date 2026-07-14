'use client'

import { useState, useMemo } from 'react'
import { CycleCard } from '@/shared/components/CycleCard'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { type CycleFilter, cycleHasMatchingItems } from '@/shared/lib/filter-utils'
import { sortCycles, extractFlatItems, formatSortDate, isRecurring } from '@/shared/lib/sort-utils'
import type { Cycle, PersonalArea } from '@/shared/types'

const CHIP_FILTERS: CycleFilter[] = ['All', 'Latest', '⚠️ Urgent', 'Light', 'Medium', 'Heavy']

const AREA_COLOR: Record<PersonalArea, string> = {
  housework:          '#fb7185',
  'personal-finance': '#22d3ee',
  sidoi:              '#f9a8d4',
  tobuy:              '#fcd34d',
  'personal-others':  '#fbbf24',
}

const AREA_LABEL: Record<PersonalArea, string> = {
  housework:          'Home',
  'personal-finance': 'Finance',
  sidoi:              'Sidoi',
  tobuy:              'To Buy',
  'personal-others':  'Others',
}

interface SubAreaConfig {
  subAreas: readonly string[]
  activeSub: string | null
  onSubChange: (sub: string | null) => void
}

interface Props {
  area: PersonalArea
  cycles: Cycle[]
  subAreaConfig?: SubAreaConfig
}

export function PersonalTabLayout({ area, cycles, subAreaConfig }: Props) {
  const { toggleItem } = usePersonalData()
  const [chipFilter, setChipFilter] = useState<CycleFilter>('All')

  const color = AREA_COLOR[area]
  const label = AREA_LABEL[area]

  const activeSub = subAreaConfig?.activeSub ?? null

  const sortedFiltered = useMemo(() => sortCycles(
    cycles.filter(c => {
      if (c.status === 'complete') return false
      if (c.nextDueAt && !isRecurring(c.triggerLabel)) return false
      if (activeSub && c.subArea !== activeSub) return false
      if (chipFilter === 'All' || chipFilter === 'Latest') return true
      return cycleHasMatchingItems(c, chipFilter)
    }),
  ), [cycles, activeSub, chipFilter])

  const flatItems = useMemo(() => {
    if (chipFilter !== 'Latest') return []
    const base = activeSub ? cycles.filter(c => c.subArea === activeSub) : cycles
    return extractFlatItems(base)
  }, [chipFilter, cycles, activeSub])

  const countBySub = useMemo(() => {
    if (!subAreaConfig) return {}
    return subAreaConfig.subAreas.reduce<Record<string, number>>((acc, s) => {
      acc[s] = cycles.filter(c => c.subArea === s).length
      return acc
    }, {})
  }, [cycles, subAreaConfig])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {chipFilter === 'Latest'
            ? `${flatItems.length} tasks in deadline order`
            : sortedFiltered.length < cycles.length
              ? `${sortedFiltered.length} of ${cycles.length} cycles`
              : `${cycles.length} ${cycles.length === 1 ? 'cycle' : 'cycles'}`}
        </p>
      </div>

      {/* Sub-area tab bar (Sidoi only) */}
      {subAreaConfig && (
        <div className="flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex overflow-x-auto scrollbar-none px-3">
            <button
              onClick={() => subAreaConfig.onSubChange(null)}
              className="flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all"
              style={!activeSub
                ? { borderColor: color, color: '#ffffff' }
                : { borderColor: 'transparent', color: 'rgba(255,255,255,0.4)' }}
            >
              All
            </button>
            {subAreaConfig.subAreas.map(sub => (
              <button
                key={sub}
                onClick={() => subAreaConfig.onSubChange(sub)}
                className="flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all"
                style={activeSub === sub
                  ? { borderColor: color, color: '#ffffff' }
                  : { borderColor: 'transparent', color: 'rgba(255,255,255,0.4)' }}
              >
                {sub}
                <span className="ml-1 text-[11px]" style={{ color: activeSub === sub ? `${color}99` : 'rgba(255,255,255,0.2)' }}>
                  ({countBySub[sub]})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chip filters */}
      <div className="flex-shrink-0 relative px-6 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pr-4">
          {CHIP_FILTERS.map(chip => (
            <button
              key={chip}
              onClick={() => setChipFilter(chip)}
              className="flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-all"
              style={chipFilter === chip
                ? { backgroundColor: `${color}33`, borderColor: `${color}80`, color, fontWeight: 600 }
                : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-3 bottom-2 w-8 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(14,22,40,0.95), transparent)' }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {chipFilter === 'Latest' ? (
          flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No tasks</div>
          ) : (
            <div className="space-y-0.5">
              {flatItems.map(item => (
                <div key={item.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  <button
                    onClick={() => toggleItem(area, item.cycleId, item.id)}
                    className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-all"
                    style={item.status === 'done'
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: 'rgba(255,255,255,0.3)' }}
                  >
                    {item.status === 'done' && (
                      <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] leading-relaxed ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}>
                      {item.urgent && <span className="text-orange-400 mr-1 text-[11px]">⚠</span>}
                      {item.label}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.cycleTitle}</div>
                  </div>
                  {isFinite(item.sortDate) && (
                    <span className="flex-shrink-0 text-[11px] mt-0.5 tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {item.due ?? formatSortDate(item.sortDate)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        ) : sortedFiltered.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {activeSub ? `No cycles in ${activeSub}` : 'No cycles match this filter'}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {sortedFiltered.map(cycle => <CycleCard key={cycle.id} cycle={cycle} filter={chipFilter} />)}
          </div>
        )}
      </div>

    </div>
  )
}
