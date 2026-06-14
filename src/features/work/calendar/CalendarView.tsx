'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useWorkData } from '@/shared/lib/work-data-context'
import { computeSortDate } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'

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
  key: string   // YYYY-MM-DD
  events: GEvent[]
  tasks: { cycle: Cycle; area: string }[]
}

type ViewMode = 'month' | 'week' | 'day'

// ── Constants ─────────────────────────────────────────────────────────────────

const AREA_BORDER: Record<string, string> = {
  finance: 'border-l-[3px] border-blue-400   bg-blue-400/8   text-blue-300',
  hr:      'border-l-[3px] border-emerald-400 bg-emerald-400/8 text-emerald-300',
  ops:     'border-l-[3px] border-orange-400  bg-orange-400/8  text-orange-300',
  others:  'border-l-[3px] border-purple-400  bg-purple-400/8  text-purple-300',
}

const WEEK_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_HEIGHT     = 52   // px per hour in time grid
const DAY_START_H     = 7    // 7am
const DAY_END_H       = 22   // 10pm

// ── Date helpers ──────────────────────────────────────────────────────────────

function toKey(d: Date) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
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
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function monthRangeISO(date: Date): [string, string] {
  const first = startOfMonth(date)
  const gs    = startOfWeek(first)
  const end   = addDays(gs, 42)
  return [gs.toISOString(), end.toISOString()]
}

function weekRangeISO(date: Date): [string, string] {
  const start = startOfWeek(date)
  const end   = addDays(start, 7)
  return [start.toISOString(), end.toISOString()]
}

function formatHour(h: number) {
  return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`
}

function eventTimeLabel(isoStart: string): string {
  const d = new Date(isoStart)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
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
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate leading-tight ${AREA_BORDER[area] ?? AREA_BORDER.others} ${compact ? '' : 'mb-0.5'}`}
      title={cycle.title}
    >
      {cycle.title}
    </div>
  )
}

// ── Day Detail Popover ────────────────────────────────────────────────────────

function DayPopover({ date, dayData, onClose, onNavigate }: {
  date: Date
  dayData: DayData
  onClose: () => void
  onNavigate: (d: Date) => void
}) {
  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/12 rounded-2xl shadow-2xl w-80 max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <span className="text-sm font-semibold text-white">{label}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { onNavigate(date); onClose() }}
              className="text-[11px] text-navi-blue hover:underline">Day view</button>
            <button onClick={onClose} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-1.5">
          {dayData.events.length === 0 && dayData.tasks.length === 0 && (
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
                <div className="text-[10px] opacity-60 capitalize">{area}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ date, today, dayMap, onDayClick }: {
  date: Date
  today: Date
  dayMap: Map<string, DayData>
  onDayClick: (d: Date, data: DayData) => void
}) {
  const grid    = getMonthGrid(date)
  const thisMonth = date.getMonth()

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-white/6">
        {WEEK_DAY_LABELS.map(l => (
          <div key={l} className="py-2 text-center text-[11px] font-semibold text-white/30 uppercase tracking-wider">
            {l}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {grid.map((d, i) => {
          const key      = toKey(d)
          const data     = dayMap.get(key) ?? { key, events: [], tasks: [] }
          const isToday  = isSameDay(d, today)
          const inMonth  = d.getMonth() === thisMonth
          const total    = data.events.length + data.tasks.length
          const MAX_SHOW = 3
          const overflow = Math.max(0, total - MAX_SHOW)
          const shown    = [...data.events.slice(0, MAX_SHOW), ...data.tasks].slice(0, MAX_SHOW)

          return (
            <div
              key={key}
              onClick={() => onDayClick(d, data)}
              className={`border-r border-b border-white/5 p-1 cursor-pointer hover:bg-white/3 transition-colors min-h-0 flex flex-col ${
                !inMonth ? 'opacity-30' : ''
              }`}
            >
              {/* Date number */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold mb-1 self-start ${
                isToday ? 'bg-navi-blue text-white' : 'text-white/55'
              }`}>
                {d.getDate()}
              </div>

              {/* Chips */}
              <div className="flex-1 overflow-hidden space-y-0.5">
                {shown.map((item, idx) => {
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
  const days  = getWeekDays(date)
  const hours = Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => DAY_START_H + i)

  return (
    <div className="flex-1 overflow-auto">
      {/* All-day strip */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-white/8 sticky top-0 bg-[#111] z-10">
        <div className="text-[9px] text-white/25 flex items-end pb-1 pl-1">all‑day</div>
        {days.map(d => {
          const key  = toKey(d)
          const data = dayMap.get(key) ?? { key, events: [], tasks: [] }
          const allDayEvents = data.events.filter(e => e.allDay)
          return (
            <div key={key}
              className={`border-l border-white/6 px-1 py-1 min-h-[36px] cursor-pointer hover:bg-white/3 ${
                isSameDay(d, today) ? 'bg-navi-blue/5' : ''
              }`}
              onClick={() => onDayClick(d, data)}
            >
              <div className={`text-[11px] font-semibold mb-1 ${isSameDay(d, today) ? 'text-navi-blue' : 'text-white/50'}`}>
                {WEEK_DAY_LABELS[d.getDay()]} {d.getDate()}
              </div>
              {allDayEvents.map(e => <EventChip key={e.id} event={e} compact />)}
              {data.tasks.map(({ cycle, area }) => <TaskChip key={cycle.id} cycle={cycle} area={area} compact />)}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)]" style={{ height: (DAY_END_H - DAY_START_H) * HOUR_HEIGHT }}>
        {/* Hour labels */}
        <div className="relative">
          {hours.map(h => (
            <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
              className="absolute text-[9px] text-white/20 right-2 -translate-y-2">
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map(d => {
          const key        = toKey(d)
          const data       = dayMap.get(key) ?? { key, events: [], tasks: [] }
          const timedEvents = data.events.filter(e => !e.allDay)
          return (
            <div key={key} className={`relative border-l border-white/5 ${isSameDay(d, today) ? 'bg-navi-blue/3' : ''}`}>
              {/* Hour lines */}
              {hours.map(h => (
                <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
                  className="absolute inset-x-0 border-t border-white/4" />
              ))}
              {/* Timed events */}
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

function DayView({ date, today, dayMap }: {
  date: Date
  today: Date
  dayMap: Map<string, DayData>
}) {
  const key    = toKey(date)
  const data   = dayMap.get(key) ?? { key, events: [], tasks: [] }
  const hours  = Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => DAY_START_H + i)
  const allDay = data.events.filter(e => e.allDay)
  const timed  = data.events.filter(e => !e.allDay)

  return (
    <div className="flex-1 overflow-auto">
      {/* All-day + tasks strip */}
      {(allDay.length > 0 || data.tasks.length > 0) && (
        <div className="border-b border-white/8 px-4 py-3 space-y-1">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">All day</div>
          {allDay.map(e => <EventChip key={e.id} event={e} />)}
          {data.tasks.map(({ cycle, area }) => <TaskChip key={cycle.id} cycle={cycle} area={area} />)}
        </div>
      )}

      {/* Time grid */}
      <div className="flex" style={{ minHeight: (DAY_END_H - DAY_START_H) * HOUR_HEIGHT }}>
        {/* Hour labels */}
        <div className="w-14 flex-shrink-0 relative">
          {hours.map(h => (
            <div key={h} style={{ top: (h - DAY_START_H) * HOUR_HEIGHT }}
              className="absolute text-[10px] text-white/25 right-3 -translate-y-2.5">
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Events column */}
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

          {/* Current time line */}
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

export function CalendarView() {
  const [view, setView]         = useState<ViewMode>('month')
  const [current, setCurrent]   = useState(() => new Date())
  const [events, setEvents]     = useState<GEvent[]>([])
  const [loading, setLoading]   = useState(false)
  const [popover, setPopover]   = useState<{ date: Date; data: DayData } | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all cycles from WorkData
  const { financeCycles, hrCycles, opsCycles, othersCycles } = useWorkData()

  // Build cycle → day map
  const cycleMap = new Map<string, DayData>()
  const addCycles = (cycles: Cycle[], area: string) => {
    const m = cyclesToDayMap(cycles, area)
    m.forEach((items, key) => {
      if (!cycleMap.has(key)) cycleMap.set(key, { key, events: [], tasks: [] })
      cycleMap.get(key)!.tasks.push(...items)
    })
  }
  addCycles(financeCycles, 'finance')
  addCycles(hrCycles,      'hr')
  addCycles(opsCycles,     'ops')
  addCycles(othersCycles,  'others')

  // Fetch Google Calendar events
  const fetchEvents = useCallback(async () => {
    let timeMin: string, timeMax: string
    if (view === 'month')     [timeMin, timeMax] = monthRangeISO(current)
    else if (view === 'week') [timeMin, timeMax] = weekRangeISO(current)
    else                      [timeMin, timeMax] = weekRangeISO(current) // day: fetch week anyway

    setLoading(true)
    try {
      const res  = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      const data = await res.json()
      if (data.events) setEvents(data.events)
    } catch { /* silent */ }
    finally  { setLoading(false) }
  }, [view, current])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Merge events into dayMap
  const dayMap = new Map(cycleMap)
  events.forEach(e => {
    const key = e.start.slice(0, 10)
    if (!dayMap.has(key)) dayMap.set(key, { key, events: [], tasks: [] })
    dayMap.get(key)!.events.push(e)
  })

  // Navigation
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
        {/* Nav */}
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

        {/* Label */}
        <span className="flex-1 text-sm font-semibold text-white">{viewLabel()}</span>

        {/* Loading dot */}
        {loading && <div className="w-1.5 h-1.5 rounded-full bg-navi-blue/60 animate-pulse" />}

        {/* View switcher */}
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

      {/* View */}
      {view === 'month' && (
        <MonthView
          date={current} today={today} dayMap={dayMap}
          onDayClick={(d, data) => {
            const total = data.events.length + data.tasks.length
            if (total > 0) setPopover({ date: d, data })
            else { setCurrent(d); setView('day') }
          }}
        />
      )}
      {view === 'week' && (
        <WeekView
          date={current} today={today} dayMap={dayMap}
          onDayClick={(d, data) => { setCurrent(d); setView('day') }}
        />
      )}
      {view === 'day' && (
        <DayView date={current} today={today} dayMap={dayMap} />
      )}

      {/* Popover */}
      {popover && (
        <DayPopover
          date={popover.date} dayData={popover.data}
          onClose={() => setPopover(null)}
          onNavigate={d => { setCurrent(d); setView('day') }}
        />
      )}
    </div>
  )
}
