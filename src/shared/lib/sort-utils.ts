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

// ── New recurrence pattern: "every [N] unit from YYYY-MM-DD" ─────────────────
const RECURR_RE = /^every (?:(\d+) )?(days?|weeks?|months?|years?) from (\d{4}-\d{2}-\d{2})$/i

function parseRecurrFields(triggerLabel: string): { n: number; unit: string; start: Date } | null {
  const m = triggerLabel.match(RECURR_RE)
  if (!m) return null
  return {
    n:     m[1] ? parseInt(m[1]) : 1,
    unit:  m[2].toLowerCase().replace(/s$/, ''),  // singular: day, week, month, year
    start: new Date(m[3] + 'T00:00:00'),
  }
}

export function computeSortDate(triggerLabel: string | undefined): number {
  if (!triggerLabel) return Infinity
  const label = triggerLabel.toLowerCase().trim()
  if (!label) return Infinity

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // New recurrence pattern — return next occurrence >= today
  const rp = parseRecurrFields(triggerLabel)
  if (rp) {
    const { n, unit, start } = rp
    if (start >= today) return start.getTime()
    if (unit === 'day') {
      const daysDiff = Math.round((today.getTime() - start.getTime()) / 86400000)
      const rem = daysDiff % n
      return rem === 0 ? today.getTime() : addDays(today, n - rem).getTime()
    }
    if (unit === 'week') {
      const period = n * 7
      const daysDiff = Math.round((today.getTime() - start.getTime()) / 86400000)
      const rem = daysDiff % period
      return rem === 0 ? today.getTime() : addDays(today, period - rem).getTime()
    }
    if (unit === 'month') {
      let d = new Date(start)
      while (d < today) d = new Date(d.getFullYear(), d.getMonth() + n, start.getDate())
      return d.getTime()
    }
    if (unit === 'year') {
      let yr = start.getFullYear()
      while (new Date(yr, start.getMonth(), start.getDate()) < today) yr += n
      return new Date(yr, start.getMonth(), start.getDate()).getTime()
    }
    return Infinity
  }

  // QuickAdd presets
  if (label === 'today') return today.getTime()
  if (label === 'tomorrow') return addDays(today, 1).getTime()
  if (label === 'this week') {
    const d = today.getDay()
    return addDays(today, (5 - d + 7) % 7).getTime()
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

// Convert relative QuickAdd presets to ISO dates so they age correctly
export function resolveLabel(label: string): string {
  if (!label) return label
  const base = new Date(); base.setHours(0, 0, 0, 0)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (label === 'Today') return iso(base)
  if (label === 'Tomorrow') {
    const d = new Date(base); d.setDate(d.getDate() + 1); return iso(d)
  }
  if (label === 'This Week') {
    const diff = (5 - base.getDay() + 7) % 7
    const d = new Date(base); d.setDate(d.getDate() + diff); return iso(d)
  }
  if (label === 'Next Week') {
    const diff = ((5 - base.getDay() + 7) % 7) + 7
    const d = new Date(base); d.setDate(d.getDate() + diff); return iso(d)
  }
  if (label === 'Next Mon') {
    const diff = ((1 - base.getDay() + 7) % 7) || 7
    const d = new Date(base); d.setDate(d.getDate() + diff); return iso(d)
  }
  if (label === 'End of Month') {
    const d = new Date(base.getFullYear(), base.getMonth() + 1, 0); return iso(d)
  }
  if (label === 'Next Month') {
    const d = new Date(base.getFullYear(), base.getMonth() + 2, 0); return iso(d)
  }
  return label
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

// ── Unified cycle sort (all area tabs) ───────────────────────────────────────
// Order: complete/done last → due date → must/urgent priority → effort (quick first)
const EFFORT_ORDER: Record<string, number> = { quick: 0, medium: 1, heavy: 2 }

export function sortCycles(cycles: Cycle[]): Cycle[] {
  return [...cycles].sort((a, b) => {
    const aDone = (a.status === 'complete' || !!a.nextDueAt) ? 1 : 0
    const bDone = (b.status === 'complete' || !!b.nextDueAt) ? 1 : 0
    if (aDone !== bDone) return aDone - bDone

    const dateDiff = computeSortDate(a.triggerLabel) - computeSortDate(b.triggerLabel)
    if (dateDiff !== 0) return dateDiff

    const aPri = (a.must ? 2 : 0) + (a.urgent ? 1 : 0)
    const bPri = (b.must ? 2 : 0) + (b.urgent ? 1 : 0)
    if (aPri !== bPri) return bPri - aPri

    return (EFFORT_ORDER[a.effort] ?? 1) - (EFFORT_ORDER[b.effort] ?? 1)
  })
}

// ── Recurrence helpers ────────────────────────────────────────────────────────

export function isTriggerDueToday(triggerLabel: string | undefined, today: Date): boolean {
  if (!triggerLabel) return false
  const label = triggerLabel.toLowerCase().trim()
  if (!label) return false

  // New recurrence pattern
  const rp = parseRecurrFields(triggerLabel)
  if (rp) {
    const { n, unit, start } = rp
    if (today.getTime() < start.getTime()) return false
    const daysDiff = Math.round((today.getTime() - start.getTime()) / 86400000)
    if (unit === 'day') return daysDiff % n === 0
    if (unit === 'week') return daysDiff % (n * 7) === 0
    if (unit === 'month') {
      if (today.getDate() !== start.getDate()) return false
      const months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())
      return months % n === 0
    }
    if (unit === 'year') {
      if (today.getMonth() !== start.getMonth() || today.getDate() !== start.getDate()) return false
      return (today.getFullYear() - start.getFullYear()) % n === 0
    }
    return false
  }

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

// Returns the next YYYY-MM-DD date AFTER today for a recurring trigger.
// Used by "Skip this occurrence" — sets nextDueAt so the cycle resurfaces next time.
export function computeSkipDate(triggerLabel: string | undefined): string | null {
  if (!isRecurring(triggerLabel)) return null
  const label = (triggerLabel ?? '').toLowerCase().trim()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // New recurrence pattern — next occurrence strictly AFTER today
  const rp = parseRecurrFields(triggerLabel ?? '')
  if (rp) {
    const { n, unit, start } = rp
    if (unit === 'day') {
      const daysDiff = Math.round((today.getTime() - start.getTime()) / 86400000)
      const rem = daysDiff % n
      const skip = rem === 0 ? n : (n - rem)
      return addDays(today, skip).toISOString().slice(0, 10)
    }
    if (unit === 'week') {
      const period = n * 7
      const daysDiff = Math.round((today.getTime() - start.getTime()) / 86400000)
      const rem = daysDiff % period
      const skip = rem === 0 ? period : (period - rem)
      return addDays(today, skip).toISOString().slice(0, 10)
    }
    if (unit === 'month') {
      let d = new Date(start)
      while (d <= today) d = new Date(d.getFullYear(), d.getMonth() + n, start.getDate())
      return d.toISOString().slice(0, 10)
    }
    if (unit === 'year') {
      let yr = start.getFullYear()
      while (new Date(yr, start.getMonth(), start.getDate()) <= today) yr += n
      return new Date(yr, start.getMonth(), start.getDate()).toISOString().slice(0, 10)
    }
  }

  // Weekday patterns → skip 1 week
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < weekdays.length; i++) {
    if (label.includes(weekdays[i])) {
      const d = new Date(today); d.setDate(d.getDate() + 7)
      return d.toISOString().slice(0, 10)
    }
  }

  // Monthly patterns (ordinal day, phase, last-5, 1st-workday) → skip to next month
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
  // Re-run computeSortDate from next-month perspective by shifting today
  const ts = computeSortDate(triggerLabel)
  if (isFinite(ts)) {
    const next = new Date(ts)
    // If next occurrence is today or past, add 28+ days to get next month's
    if (next <= today) {
      const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      return nm.toISOString().slice(0, 10)
    }
    // next is already in the future — add one month to be safe
    nextMonth.setDate(next.getDate())
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  }

  // Fallback: 30 days
  const d = new Date(today); d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
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
  // Always use computeSkipDate so we get NEXT occurrence, never today itself
  return computeSkipDate(triggerLabel)
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
