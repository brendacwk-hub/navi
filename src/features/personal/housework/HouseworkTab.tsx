'use client'

import { useState, useMemo } from 'react'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { PersonalTabLayout } from '@/features/personal/PersonalTabLayout'

export function HouseworkTab() {
  const { houseworkCycles, personalFinanceCycles } = usePersonalData()
  const [activeSub, setActiveSub] = useState<string | null>(null)

  const merged = useMemo(() => [
    ...houseworkCycles,
    ...personalFinanceCycles.map(c => ({ ...c, subArea: 'Finance' })),
  ], [houseworkCycles, personalFinanceCycles])

  return (
    <PersonalTabLayout
      area="housework"
      cycles={merged}
      subAreaConfig={{ subAreas: ['Finance'], activeSub, onSubChange: setActiveSub }}
    />
  )
}
