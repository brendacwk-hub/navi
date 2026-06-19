'use client'

import { useState } from 'react'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { PersonalTabLayout } from '@/features/personal/PersonalTabLayout'
import type { Cycle } from '@/shared/types'

const SIDOI_SUB_AREAS = ['Orders', 'Marketing', 'Planning'] as const

export function SidoiTab() {
  const { sidoiCycles } = usePersonalData()
  const [activeSub, setActiveSub] = useState<string | null>(null)

  return (
    <PersonalTabLayout
      area="sidoi"
      cycles={sidoiCycles as Cycle[]}
      subAreaConfig={{
        subAreas: SIDOI_SUB_AREAS,
        activeSub,
        onSubChange: setActiveSub,
      }}
    />
  )
}
