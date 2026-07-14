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
  due?: string
  notes?: string
  subItems?: TodaySubItem[]
  done: boolean
  pinned?: boolean
}

// Hardcoded seed data removed — Today tasks are driven entirely by DB (today_tasks singleton)
// and recurring cycles from area tabs (Finance/HR/Ops/Others).
export const todayTaskData: TodayTaskData[] = []
