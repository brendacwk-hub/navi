export type Area = 'finance' | 'hr' | 'ops' | 'others'
export type WorkArea = 'finance' | 'hr' | 'ops' | 'others'
export type PersonalArea = 'health' | 'creative' | 'learning' | 'life-admin' | 'personal-finance' | 'social'
export type Mode = 'work' | 'personal'
export type Effort = 'quick' | 'medium' | 'heavy'
export type TaskStatus = 'active' | 'snoozed' | 'waiting' | 'blocked' | 'done' | 'urgent'
export type ItemStatus = 'todo' | 'done' | 'waiting'

export interface ChecklistItem {
  id: string
  label: string
  status: ItemStatus
  effort?: Effort
  waitingOn?: boolean
  urgent?: boolean
  must?: boolean
  notes?: string
  due?: string
  url?: string
  subItems?: ChecklistItem[]
  optional?: boolean
}

export interface CyclePhase {
  id: string
  title: string
  triggerLabel: string
  effort: Effort
  must: boolean
  status: 'locked' | 'upcoming' | 'active' | 'complete'
  items: ChecklistItem[]
}

export interface Cycle {
  id: string
  title: string
  area: Area
  subArea?: string
  effort: Effort
  must: boolean
  urgent?: boolean
  triggerLabel?: string
  phases?: CyclePhase[]
  items?: ChecklistItem[]
  status: 'upcoming' | 'active' | 'in-progress' | 'complete'
  completionPercent?: number
  notes?: string
  location?: 'hk' | 'abu-dhabi'
  lastCompletedAt?: string
  nextDueAt?: string
}

export interface Task {
  id: string
  title: string
  area: Area | PersonalArea
  subArea?: string
  effort: Effort
  must?: boolean
  urgent?: boolean
  status: TaskStatus
  dueDate?: string
  notes?: string
  location?: 'hk' | 'abu-dhabi'
}
