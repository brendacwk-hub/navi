'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'days'; days: number[] }          // 0=Sun … 6=Sat
  | { type: 'times_per_week'; times: number }
  | { type: 'times_per_month'; times: number }

export interface WorkHabit {
  id: string
  name: string
  emoji: string
  goal: number
  frequency?: HabitFrequency
  reminderTime?: string // "HH:MM"
  order: number
}

export interface HabitLog {
  [habitId: string]: number
}

export type HabitMode = 'work' | 'personal'

type DbOp = { table: string; operation: 'upsert' | 'insert' | 'delete'; data?: unknown; matchId?: string }

function dbWrite(op: DbOp) {
  fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op),
  }).catch(e => console.error('[dbWrite]', e))
}

async function dbRead(table: string): Promise<unknown[]> {
  try {
    const res = await fetch(`/api/db?table=${table}`)
    const json = await res.json()
    return json.data ?? []
  } catch (e) {
    console.error('[dbRead]', e)
    return []
  }
}

const DEFAULT_WORK_HABITS: WorkHabit[] = [
  { id: 'water',    name: 'Water',        emoji: '💧', goal: 2, frequency: { type: 'weekdays' }, order: 0 },
  { id: 'standing', name: 'Standing Desk', emoji: '🧍', goal: 2, frequency: { type: 'weekdays' }, order: 1 },
]

const DEFAULT_PERSONAL_HABITS: WorkHabit[] = [
  { id: 'personal-exercise', name: 'Exercise', emoji: '🏃', goal: 1, frequency: { type: 'daily' }, order: 0 },
  { id: 'personal-read',     name: 'Read',     emoji: '📚', goal: 1, frequency: { type: 'daily' }, order: 1 },
]

// Exported for CalendarView to fetch both modes' data for union display
export async function fetchHabitData(mode: HabitMode): Promise<{ habits: WorkHabit[]; weekLogs: Record<string, HabitLog> }> {
  const prefix = `${mode}-`
  try {
    const [defRes, logRes] = await Promise.all([
      fetch('/api/db?table=habit_definitions'),
      fetch('/api/db?table=habit_logs'),
    ])
    const defJson = await defRes.json()
    const logJson = await logRes.json()
    const defRows: { id: string; habits?: WorkHabit[] }[] = defJson.data ?? []
    const logRows: { id: string; logs?: HabitLog }[] = logJson.data ?? []

    const defsRow = defRows.find(r => r.id === `${mode}-singleton`)
      ?? (mode === 'work' ? defRows.find(r => r.id === 'singleton') : undefined)
    const habits: WorkHabit[] = defsRow?.habits ?? []

    const map: Record<string, HabitLog> = {}
    for (const row of logRows) {
      if (row.id?.startsWith(prefix)) {
        const dateKey = row.id.slice(prefix.length)
        if (row.logs) map[dateKey] = row.logs
      } else if (mode === 'work' && row.id && /^\d{4}-\d{2}-\d{2}$/.test(row.id)) {
        // backward compat: old plain-date log rows belong to work mode
        if (!map[row.id] && row.logs) map[row.id] = row.logs
      }
    }
    return { habits, weekLogs: map }
  } catch {
    return { habits: [], weekLogs: {} }
  }
}

// Helpers for weekly/monthly aggregation (used by Today strips)
export function getWeekDateKeys(date: Date): string[] {
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

export function getMonthDateKeys(date: Date): string[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  )
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isWeekday(): boolean {
  const d = new Date().getDay()
  return d >= 1 && d <= 5
}

interface HabitCtx {
  habits: WorkHabit[]
  todayLogs: HabitLog
  weekLogs: Record<string, HabitLog>
  isWorkday: boolean
  logHabit: (id: string) => void
  unlogHabit: (id: string) => void
  logHabitForDate: (id: string, date: string) => void
  unlogHabitForDate: (id: string, date: string) => void
  addHabit: (h: Omit<WorkHabit, 'id' | 'order'>) => void
  updateHabit: (id: string, patch: Partial<Omit<WorkHabit, 'id' | 'order'>>) => void
  deleteHabit: (id: string) => void
}

const HabitContext = createContext<HabitCtx | null>(null)

export function HabitProvider({ mode, children }: { mode: HabitMode; children: React.ReactNode }) {
  const defaults = mode === 'work' ? DEFAULT_WORK_HABITS : DEFAULT_PERSONAL_HABITS
  const [habits, setHabits]       = useState<WorkHabit[]>(defaults)
  const [todayLogs, setTodayLogs] = useState<HabitLog>({})
  const [weekLogs, setWeekLogs]   = useState<Record<string, HabitLog>>({})
  // Personal habits can be logged any day; work habits respect weekday check
  const isWorkday = mode === 'work' ? isWeekday() : true

  const weekLogsRef = useRef<Record<string, HabitLog>>({})
  useEffect(() => { weekLogsRef.current = weekLogs }, [weekLogs])

  useEffect(() => {
    let lastKey = todayKey()
    function check() {
      const key = todayKey()
      if (key !== lastKey) {
        lastKey = key
        setTodayLogs(weekLogsRef.current[key] ?? {})
      }
    }
    document.addEventListener('visibilitychange', check)
    const t = setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const [defRows, logRows] = await Promise.all([
        dbRead('habit_definitions'),
        dbRead('habit_logs'),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dr = defRows as any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lr = logRows as any[]

      // Find the mode-specific definitions row; fall back to old `singleton` for work mode migration
      const defRow = dr.find(r => r.id === `${mode}-singleton`)
        ?? (mode === 'work' ? dr.find(r => r.id === 'singleton') : undefined)

      if (defRow?.habits?.length > 0) {
        setHabits(defRow.habits)
        // Migrate old `singleton` → `work-singleton` once
        if (mode === 'work' && defRow.id === 'singleton') {
          dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: 'work-singleton', habits: defRow.habits } })
        }
      } else {
        dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: `${mode}-singleton`, habits: defaults } })
      }

      // Build weekLogs map from prefixed DB rows; work mode also accepts old plain-date rows
      const prefix = `${mode}-`
      const map: Record<string, HabitLog> = {}
      for (const row of lr) {
        if (row.id?.startsWith(prefix)) {
          const dateKey = row.id.slice(prefix.length)
          if (row.logs) map[dateKey] = row.logs
        } else if (mode === 'work' && row.id && /^\d{4}-\d{2}-\d{2}$/.test(row.id)) {
          if (!map[row.id] && row.logs) map[row.id] = row.logs
        }
      }
      setWeekLogs(map)
      setTodayLogs(map[todayKey()] ?? {})
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const persistLogs = useCallback((date: string, logs: HabitLog, all: Record<string, HabitLog>) => {
    dbWrite({ table: 'habit_logs', operation: 'upsert', data: { id: `${mode}-${date}`, logs } })
    setWeekLogs({ ...all, [date]: logs })
  }, [mode])

  const logHabit = useCallback((id: string) => {
    const date = todayKey()
    setTodayLogs(prev => {
      const next = { ...prev, [id]: (prev[id] ?? 0) + 1 }
      persistLogs(date, next, weekLogs)
      return next
    })
  }, [weekLogs, persistLogs])

  const unlogHabit = useCallback((id: string) => {
    const date = todayKey()
    setTodayLogs(prev => {
      const current = prev[id] ?? 0
      if (current <= 0) return prev
      const next = { ...prev, [id]: current - 1 }
      persistLogs(date, next, weekLogs)
      return next
    })
  }, [weekLogs, persistLogs])

  const logHabitForDate = useCallback((id: string, date: string) => {
    setWeekLogs(prev => {
      const dayLog = { ...(prev[date] ?? {}), [id]: (prev[date]?.[id] ?? 0) + 1 }
      dbWrite({ table: 'habit_logs', operation: 'upsert', data: { id: `${mode}-${date}`, logs: dayLog } })
      return { ...prev, [date]: dayLog }
    })
  }, [mode])

  const unlogHabitForDate = useCallback((id: string, date: string) => {
    setWeekLogs(prev => {
      const current = prev[date]?.[id] ?? 0
      if (current <= 0) return prev
      const dayLog = { ...(prev[date] ?? {}), [id]: current - 1 }
      dbWrite({ table: 'habit_logs', operation: 'upsert', data: { id: `${mode}-${date}`, logs: dayLog } })
      return { ...prev, [date]: dayLog }
    })
  }, [mode])

  const addHabit = useCallback((h: Omit<WorkHabit, 'id' | 'order'>) => {
    setHabits(prev => {
      const idPrefix = mode === 'personal' ? 'personal-habit-' : 'habit-'
      const next = [...prev, { ...h, id: `${idPrefix}${Date.now()}`, order: prev.length }]
      dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: `${mode}-singleton`, habits: next } })
      return next
    })
  }, [mode])

  const updateHabit = useCallback((id: string, patch: Partial<Omit<WorkHabit, 'id' | 'order'>>) => {
    setHabits(prev => {
      const next = prev.map(h => h.id === id ? { ...h, ...patch } : h)
      dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: `${mode}-singleton`, habits: next } })
      return next
    })
  }, [mode])

  const deleteHabit = useCallback((id: string) => {
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id).map((h, i) => ({ ...h, order: i }))
      dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: `${mode}-singleton`, habits: next } })
      return next
    })
  }, [mode])

  return (
    <HabitContext.Provider value={{ habits, todayLogs, weekLogs, isWorkday, logHabit, unlogHabit, logHabitForDate, unlogHabitForDate, addHabit, updateHabit, deleteHabit }}>
      {children}
    </HabitContext.Provider>
  )
}

export function useHabits() {
  const ctx = useContext(HabitContext)
  if (!ctx) throw new Error('useHabits must be inside HabitProvider')
  return ctx
}
