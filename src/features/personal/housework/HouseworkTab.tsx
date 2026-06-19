'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { CycleCard } from '@/shared/components/CycleCard'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { sortCycles } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'
import { PersonalQuickAdd } from '@/features/personal/PersonalQuickAdd'

export function HouseworkTab() {
  const { houseworkCycles } = usePersonalData()
  const [adding, setAdding] = useState(false)

  const sorted = useMemo(() => sortCycles(houseworkCycles as Cycle[]), [houseworkCycles])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Housework</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {sorted.length} {sorted.length === 1 ? 'cycle' : 'cycles'}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all"
          style={{ borderColor: 'rgba(251,113,133,0.3)', color: '#fb7185', backgroundColor: 'rgba(251,113,133,0.1)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      <div className="px-4 pb-8 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No housework tasks yet</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Tap Add to create your first one</p>
          </div>
        ) : (
          sorted.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)
        )}
      </div>

      {adding && (
        <PersonalQuickAdd area="housework" onClose={() => setAdding(false)} />
      )}
    </div>
  )
}
