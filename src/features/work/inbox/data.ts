export type InboxSource = 'email' | 'lark' | 'wechat' | 'telegram' | 'whatsapp' | 'manual'
export type InboxArea = 'finance' | 'hr' | 'ops' | 'others'
export type InboxEffort = 'quick' | 'medium' | 'heavy'

export interface InboxItem {
  id: string
  title: string
  area: InboxArea
  effort: InboxEffort
  must: boolean
  urgent: boolean
  dueText: string
  notes?: string
  source: InboxSource
  capturedAt: string
}

export const mockInboxItems: InboxItem[] = [
  {
    id: 'i1',
    title: 'Arrange ADGM funds transfer — OA Airwallex before settlement',
    area: 'finance',
    effort: 'quick',
    must: true,
    urgent: true,
    dueText: 'Today',
    source: 'lark',
    capturedAt: 'Jun 13',
  },
  {
    id: 'i2',
    title: 'Check EV Tech HSBC balance before payroll settlement',
    area: 'finance',
    effort: 'quick',
    must: true,
    urgent: false,
    dueText: '20th',
    source: 'manual',
    capturedAt: 'Jun 13',
  },
  {
    id: 'i3',
    title: 'Renew insurance for DT office staff — submit documents to broker',
    area: 'hr',
    effort: 'medium',
    must: false,
    urgent: false,
    dueText: 'End of month',
    source: 'email',
    capturedAt: 'Jun 12',
  },
  {
    id: 'i4',
    title: 'Follow up John visa renewal documents',
    area: 'hr',
    effort: 'quick',
    must: false,
    urgent: false,
    dueText: 'This week',
    source: 'whatsapp',
    capturedAt: 'Jun 12',
  },
  {
    id: 'i5',
    title: 'Review cleaning company vendor contract renewal',
    area: 'ops',
    effort: 'medium',
    must: false,
    urgent: false,
    dueText: 'Next week',
    source: 'email',
    capturedAt: 'Jun 11',
  },
]
