'use client'

import { usePersonalData } from '@/shared/lib/personal-data-context'
import { PersonalTabLayout } from '@/features/personal/PersonalTabLayout'
import type { Cycle } from '@/shared/types'

export function ToBuyTab() {
  const { tobuyCycles } = usePersonalData()
  return <PersonalTabLayout area="tobuy" cycles={tobuyCycles as Cycle[]} />
}
