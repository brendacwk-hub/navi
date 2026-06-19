'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { useHabits, fetchHabitData, type WorkHabit, type HabitLog } from '@/shared/lib/habit-context'
import { computeSortDate } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'

const PINK = '#f0a8c8'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GEvent {
  id: string
  calendarId: string
  calendarName: string
  color: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string | null
}

interface DayData {
  key: string
  events: GEvent[]
  tasks: { cycle: Cycle; area: string }[]
}

type ViewMode = 'month' | 'week' | 'day'

// ── Constants ─────────────────────────────────────────────────────────────────

const AREA_BORDER: Record<string, string> = {
  housework:          'border-l-[3px] border-rose-400   bg-rose-400/8   text-rose-300',
  'personal-finance': 'border-l-[3px] border-cyan-400   bg-cyan-400/8   text-cyan-300',
  sidoi:              'border-l-[3px] border-pink-300   bg-pink-300/8   text-pink-200',
  tobuy:              'border-l-[3px] border-amber-400  bg-amber-400/8  text-amber-300',
}

const WEEK_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_HEIGHT     = 52
const DAY_START_H     = 7
const DAY_END_H       = 22

// ── Date helpers ──────────────────────────────────────────────────────────────

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfWeek(d: Date): Date { const r = new Date(d); r.setDate(d.getDate() - d.getDay()); r.setHours(0,0,0,0); return r }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function isSameDay(a: Date, b: Date) { return toKey(a) === toKey(b) }

function getMonthGrid(date: Date): Date[] {
  const first = startOfMonth(date)
  const gs    = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gs, i))
}

function getWeekDays(date: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i))
}

function monthRangeISO(date: Date): [string, string] {
  const first = startOfMonth(date)
  const gs    = startOfWeek(first)
  return [gs.toISOString(), addDays(gs, 42).toISOString()]
}

function weekRangeISO(date: Date): [string, string] {
  const start = startOfWeek(date)
  return [start.toISOString(), addDays(start, 7).toISOString()]
}

function formatHour(h: number) {
  return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`
}

function eventTimeLabel(isoStart: string): string {
  return new Date(isoStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function timeToY(iso: string): number {
  const d    = new Date(iso)
  const mins = d.getHours() * 60 + d.getMinutes() - DAY_START_H * 60
  return Math.max(0, (mins / 60) * HOUR_HEIGHT)
}

function durationPx(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  return Math.max(24, (ms / 3600000) * HOUR_HEIGHT)
}

// ── Cycle → calendar date ─────────────────────────────────────────────────────

function cyclesToDayMap(cycles: Cycle[], area: string): Map<string, { cycle: Cycle; area: string }[]> {
  const map = new Map<string, { cycle: Cycle; area: string }[]>()
  for (const c of cycles) {
    if (c.status === 'complete') continue
    const ts = computeSortDate(c.triggerLabel)
    if (!isFinite(ts)) continue
    const key = toKey(new Date(ts))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({ cycle: c, area })
  }
  return map
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventChip({ event, compact = false }: { event: GEvent; compact?: boolean }) {
  return (
    <div
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate text-white leading-tight ${compact ? '' : 'mb-0.5'}`}
      style={{ backgroundColor: event.color + 'cc' }}
      title={`${event.title}${event.allDay ? '' : ' · ' + eventTimeLabel(event.start)}`}
    >
      {!event.allDay && !compact && (
        <span className="opacity-70 mr-1">{eventTimeLabel(event.start)}</span>
      )}
      {event.title}
    </div>
  )
}

function TaskChip({ cycle, area, compact = false }: { cycle: Cycle; area: string; compact?: boolean }) {
  return (
    <div
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate leading-tight ${AREA_BORDER[area] ?? AREA_BORDER.housework} ${compact ? '' : 'mb-0.5'}`}
      title={cycle.title}
    >
      {cycle.title}
    </div>
  )
}

// ── Day Detail Popover ────────────────────────────────────────────────────────

function DayPopover({ date, dayData, habits, weekLogs, onClose, onNavigate }: {
  date: Date
  dayData: DayData
  habits: { id: string; name: string; emoji: string; goal: number }[]
  weekLogs: Record<string, Record<string, number>>
  onClose: () => void
  onNavigate: (d: Date) => void
}) {
  const label    = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const key      = toKey(date)
  const dayLog   = weekLogs[key] ?? {}
  const doneHabits    = habits.filter(h => (dayLog[h.id] ?? 0) >= h.goal)
  const partialHabits = habits.filter(h => (dayLog[h.id] ?? 0) > 0 && (dayLog[h.id] ?? 0) < h.goal)
  const hasHabits = doneHabits.length > 0 || partialHabits.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#0e1628] border border-white/12 rounded-2xl shadow-2xl w-80 max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <span className="text-sm font-semibold text-white">{label}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { onNavigate(date); onClose() }}
              className="text-[11px] hover:underline" style={{ color: PINK }}>Day view</button>
            <button onClick={onClose} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-1.5">
          {dayData.events.length === 0 && dayData.tasks.length === 0 && !hasHabits && (
            <p className="text-xs text-white/30 py-4 text-center">Nothing scheduled</p>
          )}
          {dayData.events.map(e => (
            <div key={e.id} className="flex items-start gap-2 py-1">
              <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: e.color }} />
              <div>
                <div className="text-xs font-medium text-white">{e.title}</div>
                {!e.allDay && <div className="text-[10px] text-white/35">{eventTimeLabel(e.start)}</div>}
                <div className="text-[10px] text-white/25">{e.calendarName}</div>
              </div>
            </div>
          ))}
          {dayData.tasks.map(({ cycle, area }) => (
            <div key={cycle.id} className={`flex items-start gap-2 py-1 pl-2 rounded-lg ${AREA_BORDER[area]}`}>
              <div className="flex-1">
                <div className="text-xs font-medium">{cycle.title}</div>
                <div className="text-[10px] opacity-60 capitalize">{area.replace('personal-', '')}</div>
              </div>
            </div>
          ))}
          {hasHabits && (
            <div className="pt-1 mt-1 border-t border-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Habits</div>
              <div className="flex flex-col gap-1.5">
                {habits.map(h => {
                  const count = dayLog[h.id] ?? 0
                  if (count === 0) return null
                  const done = count >= h.goal
                  return (
                    <div key={h.id} className="flex items-center gap-2">
                      <span className="text-base leading-none">{h.emoji}</span>
                      <span className="text-xs text-white/70 flex-1">{h.name}</span>
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: done ? '#4ade80' : PINK }}>
                        {count}/{h.goal} {done ? '✓' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

interface HabitDot { id: string; emoji: string; goal: number }

function MonthView({ date, today, dayMap, habits, weekLogs, onDayClick }: {
  date: Date
  today: Date
  dayMap: Map<string, DayData>
  habits: HabitDot[]
  weekLogs: Record<string, Record<string, number>>
  onDayClick: (d: Date, data: DayData) => void
}) {
  const grid     = getMonthGrid(date)
  const thisMonth = date.getMonth()

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="grid grid-cols-7 border-b border-white/6">
        {WEEK_DAY_LABELS.map(l => (
          <div key={l} className="py-2 text-center text-[11px] font-semibold text-white/30 uppercase tracking-wider">
            {l}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {grid.map((d) => {
          const key      = toKey(d)
          const data     = dayMap.get(key) ?? { key, events: [], tasks: [] }
          const isToday  = isSameDay(d, today)
          const inMonth  = d.getMonth() === thisMonth
          const total    = data.events.length + data.tasks.length
          const MAX_SHOW = 2
          const overflow = Math.max(0, total - MAX_SHOW)
          const shown    = [...data.events.slice(0, MAX_SHOW), ...data.tasks].slice(0, MAX_SHOW)
          const dayLog   = weekLogs[key] ?? {}
          const loggedHabits = habits.filter(h => (dayLog[h.id] ?? 0) > 0)

          return (
            <div
              key={key}
              onClick={() => onDayClick(d, data)}
              className={`border-r border-b border-white/5 p-1 cursor-pointer hover:bg-white/3 transition-colors min-h-0 flex flex-col gap-0.5 ${
                !inMonth ? 'opacity-30' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={isToday
                    ? { backgroundColor: PINK, color: '#0e1628' }
                    : { color: 'rgba(255,255,255,0.55)' }}
                >
                  {d.getDate()}
                </div>
                {loggedHabits.length > 0 && (
                  <div className="flex gap-0.5">
                    {loggedHabits.map(h => (
                      <span key={h.id} className={`text-[10px] leading-none ${(dayLog[h.id] ?? 0) >= h.goal ? '' : 'opacity-50'}`}>
                        {h.emoji}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-hidden space-y-0.5 flex-1">
                {shown.map((item) => {
                  if ('calendarId' in item) {
                    return <EventChip key={item.id} event={item as GEvent} compact />
                  }
                  const t = item as { cycle: Cycle; area: string }
                  return <TaskChip key={t.cycle.id} cycle={t.cycle} area={t.area} compact />
                })}
                {overflow > 0 && (
                  <div className="text-[9px] text-white/35 pl-1">+{overflow} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ date, today, dayMap, onDayClick }: {
  date: Date
  today: Date
  dayMap: Map<string, DayData>
  onDayClick: (d: Date, data: DayData) => void
}) {
  const days      = getWeekDays(date)
  const hours     = Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => DAY_START_H + i)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const now  = new Date()
    const mins = now.getHours() * 60 + now.getMinutes() - DAY_START_H * 60
    scrollRef.current.scrollTop = Math.max(0, (mins / 60) * HOUR_HEIGHT - 120)
  }, [])

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-white/8 sticky top-0 z-10" style={{ backgroundColor: '#0e1628' }}>
        <div className="text-[9px] text-white/25 flex items-end pb-1 pl-1">all‑day</div>
        {days.map(d => {
          const key  = toKey(d)
          const data = dayMap.get(key) ?? { key, events: [], tasks: [] }
          const allDayEvents = data.events.filter(e => e.allDay)
          return (
            <div key={key}
              className="border-l border-white/6 px-1 py-1 min-h-[36px] cursor-pointer hover:bg-white/3"
              style={isSameDay(d, today) ? { backgroundColor: `${PINK}08` } : {}}
              onClick={() => onDayClick(d, data)}
            >
              <div className="text-[11px] font-semibold mb-1" style={{ color: isSameDay(d, today) ? PINK : 'rgba(255,255,255,0.5)' }}>
                {WEEK_DAY_LABELS[d.getDay()]} {d.getDate()}
              </div>
              {allDayEvents.map(e => <EventChip key={e.id} event={e} compact />)}
              {data.tasks.map(({ cycle, area }) => <TaskChip key={cycle.id} cycle={cycle} area={area} compact />)}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[48px_repeat(7,1fr)]" style={{ height: (DAY_END_H - DAY_START_H) * HOUR_HEIGHT }}>
        <div className="relative">
          {hours.map(h => (
            <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
              className="absolute text-[9px] text-white/20 right-2 -translate-y-2">
              {formatHour(h)}
            </div>
          ))}
        </div>

        {days.map(d => {
          const key        = toKey(d)
          const data       = dayMap.get(key) ?? { key, events: [], tasks: [] }
          const timedEvents = data.events.filter(e => !e.allDay)
          return (
            <div key={key} className="relative border-l border-white/5"
              style={isSameDay(d, today) ? { backgroundColor: `${PINK}05` } : {}}>
              {hours.map(h => (
                <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
                  className="absolute inset-x-0 border-t border-white/4" />
              ))}
              {timedEvents.map(e => {
                const top    = timeToY(e.start)
                const height = durationPx(e.start, e.end)
                return (
                  <div key={e.id}
                    style={{ top, height, backgroundColor: e.color + 'bb', position: 'absolute', left: 2, right: 2, zIndex: 1 }}
                    className="rounded px-1 py-0.5 overflow-hidden cursor-pointer"
                    title={`${e.title} · ${eventTimeLabel(e.start)}`}
                  >
                    <div className="text-[10px] font-medium text-white truncate">{e.title}</div>
                    <div className="text-[9px] text-white/70">{eventTimeLabel(e.start)}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ date, today, dayMap, habits, weekLogs }: {
  date: Date
  today: Date
  dayMap: Map<string, DayData>
  habits: { id: string; name: string; emoji: string; goal: number }[]
  weekLogs: Record<string, Record<string, number>>
}) {
  const key      = toKey(date)
  const data     = dayMap.get(key) ?? { key, events: [], tasks: [] }
  const hours    = Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => DAY_START_H + i)
  const allDay   = data.events.filter(e => e.allDay)
  const timed    = data.events.filter(e => !e.allDay)
  const dayLog   = weekLogs[key] ?? {}
  const loggedHabits = habits.filter(h => (dayLog[h.id] ?? 0) > 0)

  return (
    <div className="flex-1 overflow-auto">
      {(allDay.length > 0 || data.tasks.length > 0 || loggedHabits.length > 0) && (
        <div className="border-b border-white/8 px-4 py-3 space-y-1">
          {(allDay.length > 0 || data.tasks.length > 0) && (
            <>
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">All day</div>
              {allDay.map(e => <EventChip key={e.id} event={e} />)}
              {data.tasks.map(({ cycle, area }) => <TaskChip key={cycle.id} cycle={cycle} area={area} />)}
            </>
          )}
          {loggedHabits.length > 0 && (
            <div className={allDay.length > 0 || data.tasks.length > 0 ? 'pt-2 border-t border-white/6' : ''}>
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Habits</div>
              <div className="flex flex-wrap gap-3">
                {loggedHabits.map(h => {
                  const count = dayLog[h.id] ?? 0
                  const done  = count >= h.goal
                  return (
                    <div key={h.id} className="flex items-center gap-1.5">
                      <span className="text-base">{h.emoji}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: done ? '#4ade80' : PINK }}>
                        {count}/{h.goal}{done ? ' ✓' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex" style={{ minHeight: (DAY_END_H - DAY_START_H) * HOUR_HEIGHT }}>
        <div className="w-14 flex-shrink-0 relative">
          {hours.map(h => (
            <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
              className="absolute text-[10px] text-white/25 right-3 -translate-y-2.5">
              {formatHour(h)}
            </div>
          ))}
        </div>

        <div className="flex-1 relative border-l border-white/6">
          {hours.map(h => (
            <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
              className="absolute inset-x-0 border-t border-white/5" />
          ))}
          {timed.map(e => {
            const top    = timeToY(e.start)
            const height = durationPx(e.start, e.end)
            return (
              <div key={e.id}
                style={{ top, height, backgroundColor: e.color + 'cc', position: 'absolute', left: 8, right: 8 }}
                className="rounded-lg px-2 py-1 overflow-hidden"
              >
                <div className="text-[11px] font-semibold text-white">{e.title}</div>
                <div className="text-[10px] text-white/70">
                  {eventTimeLabel(e.start)} · {e.calendarName}
                </div>
                {e.location && <div className="text-[10px] text-white/50">{e.location}</div>}
              </div>
            )
          })}

          {isSameDay(date, today) && (() => {
            const now  = new Date()
            const mins = now.getHours() * 60 + now.getMinutes() - DAY_START_H * 60
            if (mins < 0) return null
            const top  = (mins / 60) * HOUR_HEIGHT
            return (
              <div style={{ top, position: 'absolute', left: 0, right: 0 }}
                className="flex items-center pointer-events-none z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                <div className="flex-1 border-t border-red-500" />
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PersonalCalendarView() {
  const [view, setView]         = useState<ViewMode>('month')
  const [current, setCurrent]   = useState(() => new Date())
  const [events, setEvents]     = useState<GEvent[]>([])
  const [loading, setLoading]   = useState(false)
  const [popover, setPopover]   = useState<{ date: Date; data: DayData } | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles } = usePersonalData()
  const { habits: personalHabits, weekLogs: personalWeekLogs } = useHabits()

  const [workHabits, setWorkHabits]       = useState<WorkHabit[]>([])
  const [workWeekLogs, setWorkWeekLogs]   = useState<Record<string, HabitLog>>({})
  useEffect(() => {
    fetchHabitData('work').then(({ habits, weekLogs }) => {
      setWorkHabits(habits)
      setWorkWeekLogs(weekLogs)
    })
  }, [])

  const allHabits = useMemo(() => [...personalHabits, ...workHabits], [personalHabits, workHabits])
  const allWeekLogs = useMemo(() => {
    const merged: Record<string, HabitLog> = { ...personalWeekLogs }
    for (const [date, log] of Object.entries(workWeekLogs)) {
      merged[date] = { ...(merged[date] ?? {}), ...log }
    }
    return merged
  }, [personalWeekLogs, workWeekLogs])

  const cycleMap = new Map<string, DayData>()
  const addCycles = (cycles: Cycle[], area: string) => {
    const m = cyclesToDayMap(cycles, area)
    m.forEach((items, key) => {
      if (!cycleMap.has(key)) cycleMap.set(key, { key, events: [], tasks: [] })
      cycleMap.get(key)!.tasks.push(...items)
    })
  }
  addCycles(houseworkCycles,       'housework')
  addCycles(personalFinanceCycles, 'personal-finance')
  addCycles(sidoiCycles,           'sidoi')
  addCycles(tobuyCycles,           'tobuy')

  const fetchEvents = useCallback(async () => {
    let timeMin: string, timeMax: string
    if (view === 'month')     [timeMin, timeMax] = monthRangeISO(current)
    else if (view === 'week') [timeMin, timeMax] = weekRangeISO(current)
    else                      [timeMin, timeMax] = weekRangeISO(current)

    setLoading(true)
    try {
      const res  = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      const data = await res.json()
      if (data.events) setEvents(data.events)
    } catch { /* silent */ }
    finally  { setLoading(false) }
  }, [view, current])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const dayMap = new Map(cycleMap)
  events.forEach(e => {
    const key = e.start.slice(0, 10)
    if (!dayMap.has(key)) dayMap.set(key, { key, events: [], tasks: [] })
    dayMap.get(key)!.events.push(e)
  })

  function navigate(dir: 1 | -1) {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else d.setDate(d.getDate() + dir * 7)
      return d
    })
  }

  function viewLabel() {
    if (view === 'month') return current.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const days = getWeekDays(current)
      const s    = days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const e    = days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return `${s} – ${e}`
    }
    return current.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => navigate(1)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => { setCurrent(new Date()); setView('month') }}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-white/12 text-white/45 hover:text-white hover:border-white/25 transition-all">
          Today
        </button>

        <span className="flex-1 text-sm font-semibold text-white">{viewLabel()}</span>

        {loading && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: `${PINK}60` }} />}

        <div className="flex gap-0.5 bg-white/6 rounded-xl p-0.5">
          {(['month', 'week', 'day'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                view === v ? 'bg-white/12 text-white' : 'text-white/35 hover:text-white/60'
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <MonthView
          date={current} today={today} dayMap={dayMap}
          habits={allHabits.map(h => ({ id: h.id, emoji: h.emoji, goal: h.goal }))}
          weekLogs={allWeekLogs}
          onDayClick={(d, data) => {
            const key       = toKey(d)
            const dayLog    = allWeekLogs[key] ?? {}
            const hasHabits = allHabits.some(h => (dayLog[h.id] ?? 0) > 0)
            const total     = data.events.length + data.tasks.length
            if (total > 0 || hasHabits) setPopover({ date: d, data })
            else { setCurrent(d); setView('day') }
          }}
        />
      )}
      {view === 'week' && (
        <WeekView
          date={current} today={today} dayMap={dayMap}
          onDayClick={(d) => { setCurrent(d); setView('day') }}
        />
      )}
      {view === 'day' && (
        <DayView date={current} today={today} dayMap={dayMap} habits={allHabits} weekLogs={allWeekLogs} />
      )}

      {popover && (
        <DayPopover
          date={popover.date} dayData={popover.data}
          habits={allHabits}
          weekLogs={allWeekLogs}
          onClose={() => setPopover(null)}
          onNavigate={d => { setCurrent(d); setView('day') }}
        />
      )}
    </div>
  )
}
