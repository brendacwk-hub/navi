export interface TodaySubItem {
  id: string
  label: string
  done: boolean
  urgent?: boolean
}

export interface TodayTaskData {
  id: string
  label: string
  area: 'finance' | 'hr' | 'ops' | 'others'
  effort: 'quick' | 'medium' | 'heavy'
  must: boolean
  urgent?: boolean
  due: string
  notes?: string
  subItems?: TodaySubItem[]
  done: boolean
}

export const todayTaskData: TodayTaskData[] = [
  {
    id: 't1',
    label: 'Budgets — Screen for payment requests',
    area: 'finance',
    effort: 'heavy',
    must: true,
    due: 'Today',
    done: false,
    notes: 'Check emails, Lark, WeChat, Telegram, and ADGM budgets',
    subItems: [
      { id: 't1a', label: 'Emails', done: false },
      { id: 't1b', label: 'All chats (Lark, WeChat, Telegram)', done: false },
      { id: 't1c', label: 'ADGM budgets', done: false },
    ],
  },
  {
    id: 't2',
    label: 'Bank Statements — Weekly CSV upload',
    area: 'finance',
    effort: 'quick',
    must: true,
    due: 'Today',
    done: false,
    subItems: [
      { id: 't2a', label: 'BCOM: EV Tech, Duom', done: false },
      { id: 't2b', label: 'Fusion: EV Tech, GAHK', done: false },
    ],
  },
]
