'use client'

import { usePersonalData } from '@/shared/lib/personal-data-context'
import { PersonalTabLayout } from '@/features/personal/PersonalTabLayout'
import type { Cycle } from '@/shared/types'

export function HouseworkTab() {
  const { houseworkCycles } = usePersonalData()
  return <PersonalTabLayout area="housework" cycles={houseworkCycles as Cycle[]} />
}
