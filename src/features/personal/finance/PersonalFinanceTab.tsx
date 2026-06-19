'use client'

import { usePersonalData } from '@/shared/lib/personal-data-context'
import { PersonalTabLayout } from '@/features/personal/PersonalTabLayout'
import type { Cycle } from '@/shared/types'

export function PersonalFinanceTab() {
  const { personalFinanceCycles } = usePersonalData()
  return <PersonalTabLayout area="personal-finance" cycles={personalFinanceCycles as Cycle[]} />
}
