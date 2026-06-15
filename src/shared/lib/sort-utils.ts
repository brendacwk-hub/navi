import type { Cycle, ChecklistItem, ItemStatus } from '@/shared/types'

export interface FlatItem {
  id: string
  label: string
  status: ItemStatus
  urgent?: boolean
  optional?: boolean
  due?: string
  notes?: string
  cycleId: string
  cycleTitle: string
  subArea?: string
  sortDate: number
}

export function computeSortDate(triggerLabel: string | undefined): number {
  if (!triggerLabel) return Infinity
  const label = triggerLabel.toLowerCase().trim()
  if (!label) return Infinity

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // QuickAdd presets
  if (label === 'today') return today.getTime()
  if (label === 'tomorrow') return addDays(today, 1).getTime()
  if (label === 'this week') {
    const d = today.getDay()
    return addDays(today, (5 - d + 7) % 7 || 5).getTime()
  }
  if (label === 'next week') {
    const d = today.getDay()
    return addDays(today, ((5 - d + 7) % 7) + 7).getTime()
  }

  // ISO date string (custom date from QuickAdd)
  if (/^\d{4}-\d{2}-\d{2}$/.test(triggerLabel)) {
    return new Date(triggerLabel + 'T00:00:00').getTime()
  }

  // Weekday names
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < weekdays.length; i++) {
    if (label.includes(weekdays[i])) return nextWeekday(today, i)
  }

  // "Last 5 days of month"
  if (label.includes('last') && (label.includes('day') || label.includes('5'))) {
    return nextLastDaysOfMonth(today, 5)
  }

  // "1st work day of next month"
  if ((label.includes('1st') || label.includes('first')) && (label.includes('next') || label.includes('work'))) {
    return firstWorkdayNextMonth(today)
  }

  // "Phase 1: 20th · ..." — extract day number after "Phase 1"
  const phaseMatch = label.match(/phase\s*1\D+?(\d{1,2})/)
  if (phaseMatch) return nextMonthDay(today, parseInt(phaseMatch[1]))

  // "Every 17th", "Starts 20th", "2nd of month" — require ordinal suffix to avoid matching "Phase 2"
  const ordinalMatch = triggerLabel.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/)
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1])
    if (day >= 1 && day <= 31) return nextMonthDay(today, day)
  }

  return Infinity
}

export function formatSortDate(ts: number): string {
  if (!isFinite(ts)) return ''
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Flatten all leaf items from cycles into a sorted list for the Latest view
export function extractFlatItems(cycles: Cycle[]): FlatItem[] {
  const result: FlatItem[] = []
  for (const cycle of cycles) {
    const cycleSortDate = computeSortDate(cycle.triggerLabel)
    const topItems = cycle.items ?? cycle.phases?.flatMap(p => p.items) ?? []
    for (const item of topItems) {
      if (item.subItems && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          result.push({
            id: sub.id, label: sub.label, status: sub.status,
            urgent: sub.urgent, optional: sub.optional,
            due: sub.due, notes: sub.notes,
            cycleId: cycle.id, cycleTitle: cycle.title, subArea: cycle.subArea,
            sortDate: sub.due ? computeSortDate(sub.due) : cycleSortDate,
          })
        }
      } else {
        result.push({
          id: item.id, label: item.label, status: item.status,
          urgent: item.urgent, optional: item.optional,
          due: item.due, notes: item.notes,
          cycleId: cycle.id, cycleTitle: cycle.title, subArea: cycle.subArea,
          sortDate: item.due ? computeSortDate(item.due) : cycleSortDate,
        })
      }
    }
  }
  return result.sort((a, b) => a.sortDate - b.sortDate)
}

// ── Recurrence helpers ────────────────────────────────────────────────────────

export function isTriggerDueToday(triggerLabel: string | undefined, today: Date): boolean {
  if (!triggerLabel) return false
  const label = triggerLabel.toLowerCase().trim()
  if (!label) return false

  if (label === 'today') return true

  // ISO date: due today or overdue
  if (/^\d{4}-\d{2}-\d{2}$/.test(triggerLabel)) {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return triggerLabel <= todayStr
  }

  const wd = today.getDay()   // 0=Sun, 1=Mon, ..., 6=Sat
  const dom = today.getDate()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  // "Every Monday", "Every Tuesday", etc.
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < weekdays.length; i++) {
    if (label.includes(weekdays[i])) return wd === i
  }

  // "Last 5 days of month"
  if (label.includes('last') && (label.includes('day') || label.includes('5'))) {
    return dom >= lastDay - 4
  }

  // "1st work day of next month" — fires on first workday of each month
  if ((label.includes('1st') || label.includes('first')) && (label.includes('next') || label.includes('work'))) {
    const firstWorkday = new Date(today.getFullYear(), today.getMonth(), 1)
    while (firstWorkday.getDay() === 0 || firstWorkday.getDay() === 6) firstWorkday.setDate(firstWorkday.getDate() + 1)
    return dom === firstWorkday.getDate()
  }

  // "Phase 1: 20th · ..." — extract day number
  const phaseMatch = label.match(/phase\s*1\D+?(\d{1,2})/)
  if (phaseMatch) return dom === parseInt(phaseMatch[1])

  // "Every 17th", "Starts 20th", "2nd of month" — ordinal suffix required
  const ordinalMatch = triggerLabel.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/)
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1])
    if (day >= 1 && day <= 31) return dom === day
  }

  return false
}

export function isRecurring(triggerLabel: string | undefined): boolean {
  if (!triggerLabel) return false
  const l = triggerLabel.toLowerCase()
  if (l.startsWith('after')) return false
  return (
    l.includes('every') ||
    l.includes('starts') ||
    l.includes('phase 1') ||
    (l.includes('last') && l.includes('day')) ||
    (l.includes('1st') && l.includes('work'))
  )
}

// Returns YYYY-MM-DD of next scheduled occurrence
export function computeNextDue(triggerLabel: string | undefined): string | null {
  if (!isRecurring(triggerLabel)) return null
  const ts = computeSortDate(triggerLabel)
  if (!isFinite(ts)) return null
  return new Date(ts).toISOString().slice(0, 10)
}

export function allCycleDone(cycle: Cycle): boolean {
  const checkItems = (items: ChecklistItem[]): boolean => {
    if (items.length === 0) return false
    return items.every(item => {
      if (item.status !== 'done') return false
      if (item.subItems && item.subItems.length > 0) return item.subItems.every(s => s.status === 'done')
      return true
    })
  }
  if (cycle.phases && cycle.phases.length > 0) return cycle.phases.every(p => checkItems(p.items))
  return checkItems(cycle.items ?? [])
}

export function resetCycle(cycle: Cycle): Cycle {
  const resetItems = (items: ChecklistItem[]): ChecklistItem[] =>
    items.map(item => ({
      ...item, status: 'todo' as const,
      subItems: item.subItems?.map(s => ({ ...s, status: 'todo' as const })),
    }))
  const base = { ...cycle, lastCompletedAt: undefined, nextDueAt: undefined }
  if (cycle.phases) {
    return {
      ...base,
      // All phases back to upcoming — user can open each when the time comes
      phases: cycle.phases.map(p => ({
        ...p,
        status: 'upcoming' as const,
        items: resetItems(p.items),
      })),
    }
  }
  return { ...base, items: resetItems(cycle.items ?? []) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function nextWeekday(from: Date, wd: number): number {
  const diff = (wd - from.getDay() + 7) % 7
  return addDays(from, diff === 0 ? 7 : diff).getTime()
}

function nextMonthDay(from: Date, day: number): number {
  const d = new Date(from.getFullYear(), from.getMonth(), day)
  if (d.getTime() <= from.getTime()) d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

function nextLastDaysOfMonth(from: Date, count: number): number {
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()
  const start = new Date(from.getFullYear(), from.getMonth(), lastDay - count + 1)
  if (start.getTime() >= from.getTime()) return start.getTime()
  const nextLast = new Date(from.getFullYear(), from.getMonth() + 2, 0).getDate()
  return new Date(from.getFullYear(), from.getMonth() + 1, nextLast - count + 1).getTime()
}

function firstWorkdayNextMonth(from: Date): number {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.getTime()
}
