'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'days'; days: number[] }        // 0=Sun … 6=Sat
  | { type: 'times_per_week'; times: number }

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

const DEFAULT_HABITS: WorkHabit[] = [
  { id: 'water',    name: 'Water',        emoji: '💧', goal: 2, frequency: { type: 'weekdays' }, order: 0 },
  { id: 'standing', name: 'Standing Desk', emoji: '🧍', goal: 2, frequency: { type: 'weekdays' }, order: 1 },
]

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

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits]     = useState<WorkHabit[]>(DEFAULT_HABITS)
  const [todayLogs, setTodayLogs] = useState<HabitLog>({})
  const [weekLogs, setWeekLogs]   = useState<Record<string, HabitLog>>({})
  const isWorkday = isWeekday()

  // Keep a ref to weekLogs so the day-reset effect can read the latest value
  // without re-registering its listeners on every update.
  const weekLogsRef = useRef<Record<string, HabitLog>>({})
  useEffect(() => { weekLogsRef.current = weekLogs }, [weekLogs])

  // Reset todayLogs when the calendar date changes (midnight crossover while app is open).
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
  }, []) // runs once — reads weekLogs via ref

  useEffect(() => {
    async function init() {
      const [defRows, logRows] = await Promise.all([
        dbRead('habit_definitions'),
        dbRead('habit_logs'),
      ])

      if (defRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = defRows[0] as any
        if (row?.habits?.length > 0) setHabits(row.habits)
      } else {
        dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: 'singleton', habits: DEFAULT_HABITS } })
      }

      // Build week log map from DB rows
      const map: Record<string, HabitLog> = {}
      for (const row of logRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any
        if (r.id && r.logs) map[r.id] = r.logs
      }
      setWeekLogs(map)
      setTodayLogs(map[todayKey()] ?? {})
    }
    init()
  }, [])

  const persistLogs = useCallback((date: string, logs: HabitLog, all: Record<string, HabitLog>) => {
    dbWrite({ table: 'habit_logs', operation: 'upsert', data: { id: date, logs } })
    setWeekLogs({ ...all, [date]: logs })
  }, [])

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
      dbWrite({ table: 'habit_logs', operation: 'upsert', data: { id: date, logs: dayLog } })
      return { ...prev, [date]: dayLog }
    })
  }, [])

  const unlogHabitForDate = useCallback((id: string, date: string) => {
    setWeekLogs(prev => {
      const current = prev[date]?.[id] ?? 0
      if (current <= 0) return prev
      const dayLog = { ...(prev[date] ?? {}), [id]: current - 1 }
      dbWrite({ table: 'habit_logs', operation: 'upsert', data: { id: date, logs: dayLog } })
      return { ...prev, [date]: dayLog }
    })
  }, [])

  const persistHabits = useCallback((next: WorkHabit[]) => {
    setHabits(next)
    dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: 'singleton', habits: next } })
  }, [])

  const addHabit = useCallback((h: Omit<WorkHabit, 'id' | 'order'>) => {
    setHabits(prev => {
      const next = [...prev, { ...h, id: `habit-${Date.now()}`, order: prev.length }]
      dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: 'singleton', habits: next } })
      return next
    })
  }, [])

  const updateHabit = useCallback((id: string, patch: Partial<Omit<WorkHabit, 'id' | 'order'>>) => {
    setHabits(prev => {
      const next = prev.map(h => h.id === id ? { ...h, ...patch } : h)
      dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: 'singleton', habits: next } })
      return next
    })
  }, [])

  const deleteHabit = useCallback((id: string) => {
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id).map((h, i) => ({ ...h, order: i }))
      dbWrite({ table: 'habit_definitions', operation: 'upsert', data: { id: 'singleton', habits: next } })
      return next
    })
  }, [])

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
