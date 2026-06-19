'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { CycleCard } from '@/shared/components/CycleCard'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { sortCycles } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'
import { PersonalQuickAdd } from '@/features/personal/PersonalQuickAdd'

const SIDOI_COLOR = '#f9a8d4'
const SUB_AREAS = ['Orders', 'Marketing', 'Planning'] as const
type SidoiSubArea = typeof SUB_AREAS[number]

export function SidoiTab() {
  const { sidoiCycles } = usePersonalData()
  const [activeSub, setActiveSub] = useState<SidoiSubArea | null>(null)
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const base = sidoiCycles as Cycle[]
    if (activeSub) return sortCycles(base.filter(c => c.subArea === activeSub))
    return sortCycles(base)
  }, [sidoiCycles, activeSub])

  const countBySub = useMemo(() => {
    const base = sidoiCycles as Cycle[]
    return SUB_AREAS.reduce<Record<string, number>>((acc, sub) => {
      acc[sub] = base.filter(c => c.subArea === sub).length
      return acc
    }, {})
  }, [sidoiCycles])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-end justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-white">Sidoi</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {(sidoiCycles as Cycle[]).length} {(sidoiCycles as Cycle[]).length === 1 ? 'cycle' : 'cycles'}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all"
          style={{ borderColor: `${SIDOI_COLOR}4d`, color: SIDOI_COLOR, backgroundColor: `${SIDOI_COLOR}1a` }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Sub-area tab bar */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex overflow-x-auto scrollbar-none px-3">
          <button
            onClick={() => setActiveSub(null)}
            className="flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all"
            style={!activeSub
              ? { borderColor: SIDOI_COLOR, color: '#ffffff' }
              : { borderColor: 'transparent', color: 'rgba(255,255,255,0.4)' }
            }
          >
            All
          </button>
          {SUB_AREAS.map(sub => (
            <button
              key={sub}
              onClick={() => setActiveSub(sub)}
              className="flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-all"
              style={activeSub === sub
                ? { borderColor: SIDOI_COLOR, color: '#ffffff' }
                : { borderColor: 'transparent', color: 'rgba(255,255,255,0.4)' }
              }
            >
              {sub}
              <span className="ml-1 text-[11px]" style={{ color: activeSub === sub ? `${SIDOI_COLOR}99` : 'rgba(255,255,255,0.2)' }}>
                ({countBySub[sub]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cycle list */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {activeSub ? `No ${activeSub} tasks yet` : 'No Sidoi tasks yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Tap Add to create one</p>
          </div>
        ) : (
          filtered.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)
        )}
      </div>

      {adding && (
        <PersonalQuickAdd
          area="sidoi"
          defaultSubArea={activeSub ?? undefined}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
