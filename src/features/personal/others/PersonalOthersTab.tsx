'use client'

import { usePersonalData } from '@/shared/lib/personal-data-context'
import { PersonalTabLayout } from '@/features/personal/PersonalTabLayout'

export function PersonalOthersTab() {
  const { personalOthersCycles } = usePersonalData()
  return <PersonalTabLayout area="personal-others" cycles={personalOthersCycles} />
}
