'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { financeCycles as initFinance } from '@/features/work/tasks/finance/data'
import { hrCycles as initHr } from '@/features/work/tasks/hr/data'
import { todayTaskData as initToday } from '@/features/work/tasks/today/data'
import type { Cycle, ChecklistItem, WorkArea } from '@/shared/types'
import type { TodayTaskData, TodaySubItem } from '@/features/work/tasks/today/data'

// ── Recursive item patcher ────────────────────────────────────────────────────
function patchItem(
  items: ChecklistItem[],
  id: string,
  fn: (item: ChecklistItem) => ChecklistItem
): ChecklistItem[] {
  return items.map(item => {
    if (item.id === id) return fn(item)
    if (item.subItems) return { ...item, subItems: patchItem(item.subItems, id, fn) }
    return item
  })
}

function patchCycleItem(cycle: Cycle, itemId: string, fn: (i: ChecklistItem) => ChecklistItem): Cycle {
  if (cycle.items) return { ...cycle, items: patchItem(cycle.items, itemId, fn) }
  if (cycle.phases) return {
    ...cycle,
    phases: cycle.phases.map(p => ({ ...p, items: patchItem(p.items, itemId, fn) }))
  }
  return cycle
}

// ── Today helpers ─────────────────────────────────────────────────────────────
function patchTodayTask(
  tasks: TodayTaskData[],
  taskId: string,
  fn: (t: TodayTaskData) => TodayTaskData
): TodayTaskData[] {
  return tasks.map(t => t.id === taskId ? fn(t) : t)
}

function patchTodaySub(
  tasks: TodayTaskData[],
  taskId: string,
  subId: string,
  fn: (s: TodaySubItem) => TodaySubItem
): TodayTaskData[] {
  return patchTodayTask(tasks, taskId, t => ({
    ...t,
    subItems: (t.subItems ?? []).map(s => s.id === subId ? fn(s) : s),
  }))
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface WorkDataCtx {
  // Cycle data
  financeCycles: Cycle[]
  hrCycles: Cycle[]
  opsCycles: Cycle[]
  othersCycles: Cycle[]
  addCycle: (area: WorkArea, cycle: Cycle) => void
  updateCycle: (area: WorkArea, id: string, patch: Partial<Pick<Cycle, 'title' | 'must' | 'urgent'>>) => void
  toggleItem: (area: WorkArea, cycleId: string, itemId: string) => void
  setItemLabel: (area: WorkArea, cycleId: string, itemId: string, label: string) => void
  setItemNote: (area: WorkArea, cycleId: string, itemId: string, note: string) => void
  setItemUrgent: (area: WorkArea, cycleId: string, itemId: string, urgent: boolean) => void

  // Today data
  todayTasks: TodayTaskData[]
  toggleTodaySubItem: (taskId: string, subId: string) => void
  updateTodayTaskLabel: (taskId: string, label: string) => void
  updateTodaySubItemLabel: (taskId: string, subId: string, label: string) => void
  setTodayTaskTags: (taskId: string, must: boolean, urgent: boolean) => void
  toggleTodaySubItemUrgent: (taskId: string, subId: string) => void
}

const WorkDataContext = createContext<WorkDataCtx | null>(null)

export function WorkDataProvider({ children }: { children: React.ReactNode }) {
  const [financeCycles, setFinanceCycles] = useState<Cycle[]>(initFinance)
  const [hrCycles, setHrCycles] = useState<Cycle[]>(initHr)
  const [opsCycles, setOpsCycles] = useState<Cycle[]>([])
  const [othersCycles, setOthersCycles] = useState<Cycle[]>([])
  const [todayTasks, setTodayTasks] = useState<TodayTaskData[]>(initToday)

  const cycleSetter = useCallback((area: WorkArea) => {
    if (area === 'finance') return setFinanceCycles
    if (area === 'hr') return setHrCycles
    if (area === 'ops') return setOpsCycles
    return setOthersCycles
  }, [])

  const addCycle = useCallback((area: WorkArea, cycle: Cycle) => {
    cycleSetter(area)(prev => [cycle, ...prev])
  }, [cycleSetter])

  const updateCycle = useCallback((area: WorkArea, id: string, patch: Partial<Pick<Cycle, 'title' | 'must' | 'urgent'>>) => {
    cycleSetter(area)(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [cycleSetter])

  const toggleItem = useCallback((area: WorkArea, cycleId: string, itemId: string) => {
    cycleSetter(area)(prev => prev.map(c => c.id === cycleId
      ? patchCycleItem(c, itemId, i => ({ ...i, status: i.status === 'done' ? 'todo' : 'done' } as ChecklistItem))
      : c))
  }, [cycleSetter])

  const setItemLabel = useCallback((area: WorkArea, cycleId: string, itemId: string, label: string) => {
    cycleSetter(area)(prev => prev.map(c => c.id === cycleId
      ? patchCycleItem(c, itemId, i => ({ ...i, label }))
      : c))
  }, [cycleSetter])

  const setItemNote = useCallback((area: WorkArea, cycleId: string, itemId: string, note: string) => {
    cycleSetter(area)(prev => prev.map(c => c.id === cycleId
      ? patchCycleItem(c, itemId, i => ({ ...i, notes: note }))
      : c))
  }, [cycleSetter])

  const setItemUrgent = useCallback((area: WorkArea, cycleId: string, itemId: string, urgent: boolean) => {
    cycleSetter(area)(prev => prev.map(c => c.id === cycleId
      ? patchCycleItem(c, itemId, i => ({ ...i, urgent }))
      : c))
  }, [cycleSetter])

  // Today actions
  const toggleTodaySubItem = useCallback((taskId: string, subId: string) => {
    setTodayTasks(prev => patchTodaySub(prev, taskId, subId, s => ({ ...s, done: !s.done })))
  }, [])

  const updateTodayTaskLabel = useCallback((taskId: string, label: string) => {
    setTodayTasks(prev => patchTodayTask(prev, taskId, t => ({ ...t, label })))
  }, [])

  const updateTodaySubItemLabel = useCallback((taskId: string, subId: string, label: string) => {
    setTodayTasks(prev => patchTodaySub(prev, taskId, subId, s => ({ ...s, label })))
  }, [])

  const setTodayTaskTags = useCallback((taskId: string, must: boolean, urgent: boolean) => {
    setTodayTasks(prev => patchTodayTask(prev, taskId, t => ({ ...t, must, urgent })))
  }, [])

  const toggleTodaySubItemUrgent = useCallback((taskId: string, subId: string) => {
    setTodayTasks(prev => patchTodaySub(prev, taskId, subId, s => ({ ...s, urgent: !s.urgent })))
  }, [])

  return (
    <WorkDataContext.Provider value={{
      financeCycles, hrCycles, opsCycles, othersCycles,
      addCycle, updateCycle, toggleItem, setItemLabel, setItemNote, setItemUrgent,
      todayTasks,
      toggleTodaySubItem, updateTodayTaskLabel, updateTodaySubItemLabel,
      setTodayTaskTags, toggleTodaySubItemUrgent,
    }}>
      {children}
    </WorkDataContext.Provider>
  )
}

export function useWorkData() {
  const ctx = useContext(WorkDataContext)
  if (!ctx) throw new Error('useWorkData must be inside WorkDataProvider')
  return ctx
}
