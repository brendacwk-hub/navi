import type { Cycle } from '@/shared/types'

export const hrCycles: Cycle[] = [
  {
    id: 'mpf',
    title: 'MPF Filing',
    area: 'hr',
    effort: 'heavy',
    must: true,
    urgent: true,
    triggerLabel: 'After Payroll Phase 2 Settlement',
    status: 'upcoming',
    items: [
      {
        id: 'mpf1',
        label: 'eMPF portal — submit for all entities',
        status: 'todo',
        effort: 'heavy',
        subItems: [
          { id: 'mpf1a', label: 'Apexco', status: 'todo', effort: 'quick' },
          { id: 'mpf1b', label: 'EVGM', status: 'todo', effort: 'quick' },
          { id: 'mpf1c', label: 'DT', status: 'todo', effort: 'quick' },
          { id: 'mpf1d', label: 'GAHK', status: 'todo', effort: 'quick' },
          { id: 'mpf1e', label: 'Duom', status: 'todo', effort: 'quick' },
          { id: 'mpf1f', label: 'EV Tech', status: 'todo', effort: 'quick' },
        ],
      },
      {
        id: 'mpf2',
        label: 'Prepare settlement per entity',
        status: 'todo',
        effort: 'medium',
        subItems: [
          { id: 'mpf2a', label: 'Apexco — savings account', status: 'todo', effort: 'quick' },
          { id: 'mpf2b', label: 'EVGM — savings account', status: 'todo', effort: 'quick' },
          { id: 'mpf2c', label: 'DT — cheque', status: 'todo', effort: 'quick' },
          { id: 'mpf2d', label: 'GAHK — savings account', status: 'todo', effort: 'quick' },
          { id: 'mpf2e', label: 'Duom — checking account', status: 'todo', effort: 'quick' },
          { id: 'mpf2f', label: 'EV Tech — savings account', status: 'todo', effort: 'quick' },
        ],
      },
      {
        id: 'mpf3',
        label: 'Check new joiner applications',
        status: 'todo',
        effort: 'quick',
        optional: true,
        subItems: [
          { id: 'mpf3a', label: '(Skip if no new joiners this month)', status: 'todo', effort: 'quick', optional: true },
        ],
      },
    ],
  },
  {
    id: 'hr-overhead-cost',
    title: 'HR Overhead Cost',
    area: 'hr',
    effort: 'quick',
    must: true,
    triggerLabel: 'After MPF (parallel with China Budget)',
    status: 'upcoming',
    items: [
      { id: 'hroc1', label: 'Update internal Google Sheet', status: 'todo', effort: 'quick', url: 'internal-sheet' },
      { id: 'hroc2', label: 'Update accounting Google Sheet', status: 'todo', effort: 'quick', url: 'internal-sheet' },
    ],
  },
]
