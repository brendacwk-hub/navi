import type { Cycle } from '@/shared/types'

export const personalFinanceCycles: Cycle[] = [
  {
    id: 'personal-monthly-budget',
    title: 'Monthly Budget Review',
    area: 'personal-finance',
    effort: 'medium',
    must: false,
    triggerLabel: 'every month on 1 from 2026-07-01',
    status: 'active',
    items: [
      { id: 'pmb1', label: 'Review income vs expenses', status: 'todo', effort: 'quick' },
      { id: 'pmb2', label: 'Check savings progress', status: 'todo', effort: 'quick' },
      { id: 'pmb3', label: 'Review investment portfolio', status: 'todo', effort: 'quick' },
    ],
  },
]
