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

// ── New recurrence pattern: "every [N] unit [on spec] from YYYY-MM-DD" ───────
// spec: weekdays "mon,thu" | month day "15" | "last"
const RECURR_RE = /^every (?:(\d+) )?(days?|weeks?|months?|years?)(?:\s+on\s+([a-z0-9,]+))?\s+from (\d{4}-\d{2}-\d{2})$/i
const DAY_ABBR  = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseRecurrFields(triggerLabel: string): { n: number; unit: string; on: string | null; start: Date } | null {
  const m = triggerLabel.match(RECURR_RE)
  if (!m) return null
  return {
    n:     m[1] ? parseInt(m[1]) : 1,
    unit:  m[2].toLowerCase().replace(/s$/, ''),
    on:    m[3] ? m[3].toLowerCase() : null,
    start: new Date(m[4] + 'T00:00:00'),
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
    const { n, unit, on, start } = rp
    if (start >= today) return start.getTime()

    if (unit === 'week' && on) {
      const wds = on.split(',').map(d => DAY_ABBR.indexOf(d)).filter(d => d !== -1)
      if (wds.length > 0) return nextWeekdayOnOrAfter(today, n, start, wds).getTime()
    }
    if (unit === 'month' && on) {
      return nextMonthDayOnOrAfter(today, n, start, on).getTime()
    }

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
  if (label === 'in 2 days') {
    return addWeekdays(today, 2).getTime()
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
  if (label === 'In 2 Days') {
    return iso(addWeekdays(base, 2))
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
    const { n, unit, on, start } = rp
    if (today.getTime() < start.getTime()) return false

    if (unit === 'week' && on) {
      const wds = on.split(',').map(d => DAY_ABBR.indexOf(d)).filter(d => d !== -1)
      if (!wds.includes(today.getDay())) return false
      if (n === 1) return true
      const startMon = getMondayOf(start)
      const todayMon = getMondayOf(today)
      const weeksDiff = Math.round((todayMon.getTime() - startMon.getTime()) / (7 * 86400000))
      return weeksDiff % n === 0
    }
    if (unit === 'month' && on) {
      const monthsFromStart = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())
      if (monthsFromStart < 0 || monthsFromStart % n !== 0) return false
      if (on === 'last') {
        return today.getDate() === new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      }
      const maxDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      return today.getDate() === Math.min(parseInt(on), maxDay)
    }

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

// Returns true if the trigger has already fired at some point in the current period
// (this month for monthly, this week for weekly). Used to keep Must recurring cycles
// visible after the exact trigger day while items are still unfinished.
export function hasTriggerFiredThisPeriod(triggerLabel: string | undefined, today: Date): boolean {
  if (!isRecurring(triggerLabel)) return false
  const label = (triggerLabel ?? '').toLowerCase()
  const dom   = today.getDate()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  // New recurrence patterns fire on exact days — no "sticky" period
  if (parseRecurrFields(triggerLabel ?? '')) return false

  // Phase trigger — use Phase 1 ordinal as the start-of-period marker
  const phaseMatch = label.match(/phase\s*1\D+?(\d{1,2})/)
  if (phaseMatch) return dom >= parseInt(phaseMatch[1])

  // Monthly ordinal — "Every 20th", "Starts 20th", "Every 2nd of month"
  const ordinalMatch = (triggerLabel ?? '').match(/\b(\d{1,2})(?:st|nd|rd|th)\b/)
  if (ordinalMatch) {
    const trigDay = parseInt(ordinalMatch[1])
    if (trigDay >= 1 && trigDay <= 28) return dom >= trigDay
  }

  // "Last 5 days of month"
  if (label.includes('last') && (label.includes('day') || label.includes('5'))) {
    return dom >= lastDay - 4
  }

  // "Every Monday" etc. — show from that weekday through end of week
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 1; i < weekdays.length; i++) {  // skip sunday (i=0)
    if (label.includes(weekdays[i])) return today.getDay() >= i
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
    const { n, unit, on, start } = rp

    if (unit === 'week' && on) {
      const wds = on.split(',').map(d => DAY_ABBR.indexOf(d)).filter(d => d !== -1)
      if (wds.length > 0) return nextWeekdayStrictlyAfter(today, n, start, wds).toISOString().slice(0, 10)
    }
    if (unit === 'month' && on) {
      return nextMonthDayStrictlyAfter(today, n, start, on).toISOString().slice(0, 10)
    }

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
      if (item.subItems && item.subItems.length > 0) return item.subItems.every(s => s.status === 'done')
      return item.status === 'done'
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

function addWeekdays(base: Date, n: number): Date {
  const d = new Date(base)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) added++
  }
  return d
}

function getMondayOf(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  r.setHours(0, 0, 0, 0)
  return r
}

// Next occurrence of any targetWds weekday on or after `after`, respecting N-week alignment to start
function nextWeekdayOnOrAfter(after: Date, n: number, start: Date, targetWds: number[]): Date {
  if (n === 1) {
    const d = new Date(after)
    for (let i = 0; i < 14; i++) {
      if (targetWds.includes(d.getDay())) return d
      d.setDate(d.getDate() + 1)
    }
    return d
  }
  let weekMon = getMondayOf(start)
  const limit = addDays(after, 400)
  while (weekMon < limit) {
    for (const wd of [...targetWds].sort((a, b) => a - b)) {
      const offset = (wd + 6) % 7  // Mon=0…Sun=6
      const occ = addDays(weekMon, offset)
      occ.setHours(0, 0, 0, 0)
      if (occ >= after) return occ
    }
    weekMon = addDays(weekMon, n * 7)
  }
  return addDays(after, n * 7)
}

function nextWeekdayStrictlyAfter(after: Date, n: number, start: Date, targetWds: number[]): Date {
  return nextWeekdayOnOrAfter(addDays(after, 1), n, start, targetWds)
}

// Next occurrence of a specific month day on or after `after`, respecting N-month alignment to start
function nextMonthDayOnOrAfter(after: Date, n: number, start: Date, daySpec: string): Date {
  const isLast = daySpec === 'last'
  const targetDay = isLast ? -1 : parseInt(daySpec)
  let year = after.getFullYear()
  let month = after.getMonth()
  for (let i = 0; i < 48; i++) {
    const monthsFromStart = (year - start.getFullYear()) * 12 + (month - start.getMonth())
    if (monthsFromStart >= 0 && monthsFromStart % n === 0) {
      const occ = isLast
        ? new Date(year, month + 1, 0)
        : new Date(year, month, Math.min(targetDay, new Date(year, month + 1, 0).getDate()))
      occ.setHours(0, 0, 0, 0)
      if (occ >= after) return occ
    }
    month++
    if (month > 11) { month = 0; year++ }
  }
  return addDays(after, 30)
}

function nextMonthDayStrictlyAfter(after: Date, n: number, start: Date, daySpec: string): Date {
  return nextMonthDayOnOrAfter(addDays(after, 1), n, start, daySpec)
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
