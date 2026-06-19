'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { financeCycles as initFinance } from '@/features/work/tasks/finance/data'
import { hrCycles as initHr } from '@/features/work/tasks/hr/data'
import { todayTaskData as initToday } from '@/features/work/tasks/today/data'
import type { Cycle, ChecklistItem, WorkArea } from '@/shared/types'
import type { TodayTaskData, TodaySubItem } from '@/features/work/tasks/today/data'
import { isRecurring, computeNextDue, allCycleDone, resetCycle } from '@/shared/lib/sort-utils'
import { useToast } from '@/shared/lib/toast-context'

// ── Server route helpers — bypass RLS using service role key ──────────────────
type DbOp = { table: string; operation: 'upsert' | 'insert' | 'delete'; data?: unknown; matchId?: string }

function dbWrite(op: DbOp) {
  fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op),
  }).catch(e => console.error('[dbWrite]', e))
}

async function dbRead(table: string, eq?: { col: string; val: string }): Promise<unknown[]> {
  const params = new URLSearchParams({ table })
  if (eq) { params.set('eqCol', eq.col); params.set('eqVal', eq.val) }
  try {
    const res = await fetch(`/api/db?${params}`, { cache: 'no-store' })
    const json = await res.json()
    return json.data ?? []
  } catch (e) {
    console.error('[dbRead]', e)
    return []
  }
}

// ── Supabase row mappers ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Cycle {
  return {
    id: r.id, area: r.area, title: r.title, effort: r.effort,
    must: r.must, urgent: r.urgent,
    subArea: r.sub_area ?? undefined,
    triggerLabel: r.trigger_label, status: r.status,
    items: r.items ?? undefined, phases: r.phases ?? undefined,
    notes: r.notes ?? undefined,
    lastCompletedAt: r.last_completed_at ?? undefined,
    nextDueAt: r.next_due_at ?? undefined,
  }
}

function toRow(c: Cycle) {
  const row: Record<string, unknown> = {
    id: c.id, area: c.area, title: c.title, effort: c.effort,
    must: c.must, urgent: c.urgent ?? false,
    sub_area: c.subArea ?? null,
    trigger_label: c.triggerLabel, status: c.status,
    items: c.items ?? null, phases: c.phases ?? null,
    last_completed_at: c.lastCompletedAt ?? null,
    next_due_at: c.nextDueAt ?? null,
    mode: 'work',
  }
  if (c.notes !== undefined) row.notes = c.notes
  return row
}

// Check and reset any cycles whose nextDueAt has passed
function applyRecurrenceResets(cycles: Cycle[], onReset: (c: Cycle) => void): Cycle[] {
  const today = new Date().toISOString().slice(0, 10)
  return cycles.map(c => {
    if (c.nextDueAt && c.nextDueAt <= today) {
      const fresh = resetCycle(c)
      onReset(fresh)
      return fresh
    }
    return c
  })
}

// ── Item patchers ─────────────────────────────────────────────────────────────
function patchItem(items: ChecklistItem[], id: string, fn: (i: ChecklistItem) => ChecklistItem): ChecklistItem[] {
  return items.map(item => {
    if (item.id === id) return fn(item)
    if (item.subItems) return { ...item, subItems: patchItem(item.subItems, id, fn) }
    return item
  })
}

function patchCycleItem(cycle: Cycle, itemId: string, fn: (i: ChecklistItem) => ChecklistItem): Cycle {
  if (cycle.items) return { ...cycle, items: patchItem(cycle.items, itemId, fn) }
  if (cycle.phases) return { ...cycle, phases: cycle.phases.map(p => ({ ...p, items: patchItem(p.items, itemId, fn) })) }
  return cycle
}

function removeItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items
    .filter(item => item.id !== id)
    .map(item => item.subItems ? { ...item, subItems: removeItem(item.subItems, id) } : item)
}

function removeCycleItem(cycle: Cycle, itemId: string): Cycle {
  if (cycle.items) return { ...cycle, items: removeItem(cycle.items, itemId) }
  if (cycle.phases) return { ...cycle, phases: cycle.phases.map(p => ({ ...p, items: removeItem(p.items, itemId) })) }
  return cycle
}

function patchTodayTask(tasks: TodayTaskData[], taskId: string, fn: (t: TodayTaskData) => TodayTaskData) {
  return tasks.map(t => t.id === taskId ? fn(t) : t)
}

function patchTodaySub(tasks: TodayTaskData[], taskId: string, subId: string, fn: (s: TodaySubItem) => TodaySubItem) {
  return patchTodayTask(tasks, taskId, t => ({
    ...t, subItems: (t.subItems ?? []).map(s => s.id === subId ? fn(s) : s),
  }))
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface WorkDataCtx {
  financeCycles: Cycle[]; hrCycles: Cycle[]; opsCycles: Cycle[]; othersCycles: Cycle[]
  completedTitles: string[]
  addCycle: (area: WorkArea, cycle: Cycle) => void
  updateCycle: (area: WorkArea, id: string, patch: Partial<Pick<Cycle, 'title' | 'must' | 'urgent' | 'effort' | 'triggerLabel' | 'subArea' | 'status' | 'notes' | 'nextDueAt' | 'items'>>) => void
  deleteCycle: (area: WorkArea, id: string) => void
  deleteItem: (area: WorkArea, cycleId: string, itemId: string) => void
  addCycleItem: (area: WorkArea, cycleId: string, label: string) => void
  toggleItem: (area: WorkArea, cycleId: string, itemId: string) => void
  setItemLabel: (area: WorkArea, cycleId: string, itemId: string, label: string) => void
  setItemNote: (area: WorkArea, cycleId: string, itemId: string, note: string) => void
  setItemUrgent: (area: WorkArea, cycleId: string, itemId: string, urgent: boolean) => void
  setItemDue: (area: WorkArea, cycleId: string, itemId: string, due: string) => void
  todayTasks: TodayTaskData[]
  todayLoaded: boolean
  addTodayTask: (task: Omit<TodayTaskData, 'id' | 'done'>) => void
  addTodaySubItem: (taskId: string, label: string) => void
  toggleTodayTask: (taskId: string) => void
  deleteTodayTask: (taskId: string) => void
  toggleTodaySubItem: (taskId: string, subId: string) => void
  deleteTodaySubItem: (taskId: string, subId: string) => void
  updateTodayTaskLabel: (taskId: string, label: string) => void
  updateTodaySubItemLabel: (taskId: string, subId: string, label: string) => void
  setTodayTaskTags: (taskId: string, must: boolean, urgent: boolean) => void
  toggleTodaySubItemUrgent: (taskId: string, subId: string) => void
  refreshData: () => Promise<void>
}

export const WorkDataContext = createContext<WorkDataCtx | null>(null)

export function WorkDataProvider({ children }: { children: React.ReactNode }) {
  const [financeCycles,   setFinanceCycles]   = useState<Cycle[]>(initFinance)
  const [hrCycles,        setHrCycles]        = useState<Cycle[]>(initHr)
  const [opsCycles,       setOpsCycles]       = useState<Cycle[]>([])
  const [othersCycles,    setOthersCycles]    = useState<Cycle[]>([])
  const [todayTasks,      setTodayTasks]      = useState<TodayTaskData[]>(initToday)
  const [todayLoaded,     setTodayLoaded]     = useState(false)
  const [completedTitles, setCompletedTitles] = useState<string[]>([])
  const sbReady = useRef(false)
  const { showToast } = useToast()
  const pendingCompletions = useRef<Map<string, { cycle: Cycle; area: WorkArea; timerId: ReturnType<typeof setTimeout>; archiveId: string }>>(new Map())

  // ── Load from DB on mount ─────────────────────────────────────────────────
  const loadFromSupabase = useCallback(async () => {
    try {
      let rows = await dbRead('cycles', { col: 'mode', val: 'work' }) as ReturnType<typeof fromRow>[]

      // Fallback: mode column may not be migrated yet — read all cycles and treat
      // non-personal ones as work cycles, then backfill mode='work' in DB.
      if (rows.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allRows = await dbRead('cycles') as any[]
        if (allRows.length > 0) {
          rows = allRows.filter((r: any) => !r.mode || r.mode === 'work')
          const toFix = rows.filter((r: any) => !r.mode)
          if (toFix.length > 0) {
            dbWrite({ table: 'cycles', operation: 'upsert', data: toFix.map((r: any) => ({ ...toRow(fromRow(r)), mode: 'work' })) })
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTodayRows = await dbRead('today_tasks') as { id: string; data: any }[]

      if (rows.length > 0) {
        const allStatic = [...initFinance, ...initHr]
        const staticById = new Map(allStatic.map(c => [c.id, c]))
        const dbIdSet = new Set(rows.map(r => r.id))

        // Cycles whose area changed in static data (e.g. payroll finance→hr)
        const toMigrate = rows.filter(r => {
          const s = staticById.get(r.id)
          return s && s.area !== r.area
        })
        const migrateIdSet = new Set(toMigrate.map(r => r.id))
        toMigrate.forEach(r => dbWrite({ table: 'cycles', operation: 'delete', matchId: r.id }))

        // New static cycles not yet in DB, plus any being migrated
        const toInsert = allStatic.filter(c => !dbIdSet.has(c.id) || migrateIdSet.has(c.id))
        if (toInsert.length > 0) {
          dbWrite({ table: 'cycles', operation: 'upsert', data: toInsert.map(toRow) })
        }

        // Merge: DB rows (minus migrated) + fresh static inserts
        // For static cycles, triggerLabel/effort/must always come from code —
        // DB only owns item states, nextDueAt, lastCompletedAt, notes.
        const merged = [
          ...rows.filter(r => !migrateIdSet.has(r.id)).map(r => {
            const row = fromRow(r)
            const s = staticById.get(row.id)
            if (!s) return row
            return {
              ...row,
              triggerLabel: s.triggerLabel,
              effort:       s.effort,
              must:         s.must,
              title:        s.title,
              subArea:      s.subArea,
              area:         s.area,
            }
          }),
          ...toInsert,
        ]
        const allCycles = applyRecurrenceResets(merged, c => dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(c) }))

        // Show all cycles in work tabs — completed ones are visible so the user
        // can untick/retick them. The Settings archive detects completion directly
        // from item state, so no hiding is needed here.
        const activeCycles = allCycles
        setFinanceCycles(activeCycles.filter(c => c.area === 'finance'))
        setHrCycles(activeCycles.filter(c => c.area === 'hr'))
        setOpsCycles(activeCycles.filter(c => c.area === 'ops'))
        setOthersCycles(activeCycles.filter(c => c.area === 'others'))
      } else {
        // First ever load — seed the DB with initial data and show cycles immediately
        const initCycles = [...initFinance, ...initHr]
        dbWrite({ table: 'cycles', operation: 'upsert', data: initCycles.map(toRow) })
        setFinanceCycles(initFinance)
        setHrCycles(initHr)
      }

      // Completed titles: primary from today_tasks archive, fallback from cycles status=complete
      const archiveTitles = allTodayRows
        .filter(r => r.id.startsWith('completed-'))
        .map(r => r.data?.title as string | undefined)
        .filter(Boolean) as string[]
      let allCompletedTitles = [...archiveTitles]
      try {
        const completedRows = await dbRead('cycles', { col: 'status', val: 'complete' }) as { title: string }[]
        const cyclesTitles = completedRows.map(r => r.title).filter(Boolean)
        if (cyclesTitles.length > 0) allCompletedTitles = [...new Set([...archiveTitles, ...cyclesTitles])]
      } catch { /* status column may not exist */ }
      setCompletedTitles(allCompletedTitles)

      // Today tasks — use already-read allTodayRows (avoids a second round-trip)
      const singletonRow = allTodayRows.find(r => r.id === 'singleton')
      if (singletonRow) {
        setTodayTasks(singletonRow.data)
      } else {
        dbWrite({ table: 'today_tasks', operation: 'upsert', data: { id: 'singleton', data: initToday } })
      }
    } finally {
      sbReady.current = true
      setTodayLoaded(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFromSupabase() }, [loadFromSupabase])

  // ── Refresh (pull-to-refresh) ─────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    try {
      let rows = await dbRead('cycles', { col: 'mode', val: 'work' }) as ReturnType<typeof fromRow>[]
      if (rows.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allRows = await dbRead('cycles') as any[]
        if (allRows.length > 0) {
          rows = allRows.filter((r: any) => !r.mode || r.mode === 'work')
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTodayRows = await dbRead('today_tasks') as { id: string; data: any }[]
      if (rows.length > 0) {
        const allStatic = [...initFinance, ...initHr]
        const staticById = new Map(allStatic.map(c => [c.id, c]))
        const hydrated = rows.map(r => {
          const row = fromRow(r)
          const s = staticById.get(row.id)
          if (!s) return row
          return { ...row, triggerLabel: s.triggerLabel, effort: s.effort, must: s.must, title: s.title, subArea: s.subArea, area: s.area }
        })
        const refreshed = applyRecurrenceResets(hydrated, c => dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(c) }))
        setFinanceCycles(refreshed.filter(c => c.area === 'finance'))
        setHrCycles(refreshed.filter(c => c.area === 'hr'))
        setOpsCycles(refreshed.filter(c => c.area === 'ops'))
        setOthersCycles(refreshed.filter(c => c.area === 'others'))
      }
      const singletonRow = allTodayRows.find(r => r.id === 'singleton')
      if (singletonRow) setTodayTasks(singletonRow.data)
    } catch (e) {
      console.error('[refreshData]', e)
    }
  }, [])

  // ── Sync helpers ──────────────────────────────────────────────────────────
  function syncCycle(cycle: Cycle) {
    if (sbReady.current) dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(cycle) })
  }
  function syncToday(tasks: TodayTaskData[]) {
    if (sbReady.current) dbWrite({ table: 'today_tasks', operation: 'upsert', data: { id: 'singleton', data: tasks } })
  }

  // ── Setters ───────────────────────────────────────────────────────────────
  const cycleSetter = useCallback((area: WorkArea) => {
    if (area === 'finance') return setFinanceCycles
    if (area === 'hr')      return setHrCycles
    if (area === 'ops')     return setOpsCycles
    return setOthersCycles
  }, [])

  const addCycle = useCallback((area: WorkArea, cycle: Cycle) => {
    cycleSetter(area)(prev => [cycle, ...prev])
    dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(cycle) })
  }, [cycleSetter])

  const updateCycle = useCallback((area: WorkArea, id: string, patch: Partial<Pick<Cycle, 'title' | 'must' | 'urgent' | 'effort' | 'triggerLabel' | 'subArea' | 'status' | 'notes' | 'nextDueAt' | 'items'>>) => {
    cycleSetter(area)(prev => {
      const target = prev.find(c => c.id === id)
      // Mark non-recurring cycles complete — archive immediately in today_tasks
      if (patch.status === 'complete' && target && !isRecurring(target.triggerLabel)) {
        const completedAt = new Date().toISOString()
        const archiveId = `completed-${target.id}`
        dbWrite({
          table: 'today_tasks', operation: 'upsert',
          data: { id: archiveId, data: { id: target.id, title: target.title, area: target.area,
            effort: target.effort ?? '', sub_area: target.subArea ?? null,
            items: target.items ?? null, completed_at: completedAt, notes: target.notes ?? null } },
        })
        dbWrite({ table: 'cycles', operation: 'upsert', data: toRow({ ...target, status: 'complete', lastCompletedAt: completedAt }) })
        setCompletedTitles(ct => [...new Set([...ct, target.title])])
        return prev.filter(c => c.id !== id)
      }
      const next = prev.map(c => c.id === id ? { ...c, ...patch } : c)
      const changed = next.find(c => c.id === id); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleItem = useCallback((area: WorkArea, cycleId: string, itemId: string) => {
    cycleSetter(area)(prev => {
      const toggled = prev.map(c => c.id === cycleId
        ? patchCycleItem(c, itemId, i => ({ ...i, status: i.status === 'done' ? 'todo' : 'done' } as ChecklistItem))
        : c)
      const changed = toggled.find(c => c.id === cycleId)
      if (!changed) return toggled
      // If recurring and was marked done but items are now incomplete → un-done it
      if (isRecurring(changed.triggerLabel) && changed.nextDueAt && !allCycleDone(changed)) {
        const withCleared = { ...changed, nextDueAt: undefined }
        syncCycle(withCleared)
        return toggled.map(c => c.id === cycleId ? withCleared : c)
      }
      // If recurring and now fully done → record completion + next due date
      if (isRecurring(changed.triggerLabel) && allCycleDone(changed)) {
        const nextDue = computeNextDue(changed.triggerLabel)
        if (nextDue) {
          const withDue = { ...changed, lastCompletedAt: new Date().toISOString(), nextDueAt: nextDue }
          syncCycle(withDue)
          return toggled.map(c => c.id === cycleId ? withDue : c)
        }
      }
      // If non-recurring and now fully done → archive immediately in today_tasks, 5s undo window
      if (!isRecurring(changed.triggerLabel) && allCycleDone(changed)) {
        const completedAt = new Date().toISOString()
        const archiveId = `completed-${cycleId}`
        // Write archive entry immediately — today_tasks always exists (unlike completed_tasks or status column)
        dbWrite({
          table: 'today_tasks', operation: 'upsert',
          data: { id: archiveId, data: { id: cycleId, title: changed.title, area: changed.area,
            effort: changed.effort ?? '', sub_area: changed.subArea ?? null,
            items: changed.items ?? null, completed_at: completedAt, notes: changed.notes ?? null } },
        })
        // Also attempt status='complete' in cycles (silent no-op if column doesn't exist)
        dbWrite({ table: 'cycles', operation: 'upsert', data: toRow({ ...changed, status: 'complete', lastCompletedAt: completedAt }) })
        setCompletedTitles(ct => [...new Set([...ct, changed.title])])
        const timerId = setTimeout(() => {
          pendingCompletions.current.delete(cycleId)
        }, 5000)
        pendingCompletions.current.set(cycleId, { cycle: changed, area, timerId, archiveId })
        showToast(`"${changed.title}" completed`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              const pending = pendingCompletions.current.get(cycleId)
              if (!pending) return
              clearTimeout(pending.timerId)
              pendingCompletions.current.delete(cycleId)
              const restored = patchCycleItem(pending.cycle, itemId, i => ({ ...i, status: 'todo' }))
              cycleSetter(area)(prev => [...prev, restored])
              syncCycle(restored)
              // Delete archive entry so the cycle reappears on next load
              dbWrite({ table: 'today_tasks', operation: 'delete', matchId: archiveId })
            },
          },
        })
        return toggled.filter(c => c.id !== cycleId)
      }
      syncCycle(changed)
      return toggled
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemLabel = useCallback((area: WorkArea, cycleId: string, itemId: string, label: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, label })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemNote = useCallback((area: WorkArea, cycleId: string, itemId: string, note: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, notes: note })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemUrgent = useCallback((area: WorkArea, cycleId: string, itemId: string, urgent: boolean) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, urgent })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemDue = useCallback((area: WorkArea, cycleId: string, itemId: string, due: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, due: due || undefined })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const addCycleItem = useCallback((area: WorkArea, cycleId: string, label: string) => {
    const newSubItem: ChecklistItem = { id: `item-${Date.now()}`, label, status: 'todo' }
    cycleSetter(area)(prev => {
      const next = prev.map(c => {
        if (c.id !== cycleId) return c
        if (c.phases) {
          const target = c.phases.find(p => p.status === 'active' || p.status === 'upcoming') ?? c.phases[c.phases.length - 1]
          return { ...c, phases: c.phases.map(p => p.id === target.id ? { ...p, items: [...p.items, newSubItem] } : p) }
        }
        // Task form: first item's label matches cycle title → add as subItem (indented)
        const firstItem = c.items?.[0]
        if (firstItem && firstItem.label === c.title) {
          const updated = { ...firstItem, subItems: [...(firstItem.subItems ?? []), newSubItem] }
          return { ...c, items: [updated, ...(c.items?.slice(1) ?? [])] }
        }
        return { ...c, items: [...(c.items ?? []), newSubItem] }
      })
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const addTodaySubItem = useCallback((taskId: string, label: string) => {
    const newSub: TodaySubItem = { id: `sub-${Date.now()}`, label, done: false }
    setTodayTasks(prev => {
      const next = patchTodayTask(prev, taskId, t => ({ ...t, subItems: [...(t.subItems ?? []), newSub] }))
      syncToday(next); return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addTodayTask = useCallback((task: Omit<TodayTaskData, 'id' | 'done'>) => {
    const newTask: TodayTaskData = { ...task, id: `t-${Date.now()}`, done: false }
    setTodayTasks(prev => { const next = [newTask, ...prev]; syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTodayTask = useCallback((taskId: string) => {
    setTodayTasks(prev => { const next = patchTodayTask(prev, taskId, t => ({ ...t, done: !t.done })); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteTodayTask = useCallback((taskId: string) => {
    setTodayTasks(prev => { const next = prev.filter(t => t.id !== taskId); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTodaySubItem = useCallback((taskId: string, subId: string) => {
    setTodayTasks(prev => { const next = patchTodaySub(prev, taskId, subId, s => ({ ...s, done: !s.done })); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteTodaySubItem = useCallback((taskId: string, subId: string) => {
    setTodayTasks(prev => {
      const next = patchTodayTask(prev, taskId, t => ({ ...t, subItems: (t.subItems ?? []).filter(s => s.id !== subId) }))
      syncToday(next); return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateTodayTaskLabel = useCallback((taskId: string, label: string) => {
    setTodayTasks(prev => { const next = patchTodayTask(prev, taskId, t => ({ ...t, label })); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateTodaySubItemLabel = useCallback((taskId: string, subId: string, label: string) => {
    setTodayTasks(prev => { const next = patchTodaySub(prev, taskId, subId, s => ({ ...s, label })); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setTodayTaskTags = useCallback((taskId: string, must: boolean, urgent: boolean) => {
    setTodayTasks(prev => { const next = patchTodayTask(prev, taskId, t => ({ ...t, must, urgent })); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTodaySubItemUrgent = useCallback((taskId: string, subId: string) => {
    setTodayTasks(prev => { const next = patchTodaySub(prev, taskId, subId, s => ({ ...s, urgent: !s.urgent })); syncToday(next); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteCycle = useCallback((area: WorkArea, id: string) => {
    cycleSetter(area)(prev => prev.filter(c => c.id !== id))
    dbWrite({ table: 'cycles', operation: 'delete', matchId: id })
  }, [cycleSetter])

  const deleteItem = useCallback((area: WorkArea, cycleId: string, itemId: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? removeCycleItem(c, itemId) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WorkDataContext.Provider value={{
      financeCycles, hrCycles, opsCycles, othersCycles, completedTitles,
      addCycle, updateCycle, deleteCycle, deleteItem, addCycleItem, toggleItem, setItemLabel, setItemNote, setItemUrgent, setItemDue,
      todayTasks, todayLoaded, addTodayTask, addTodaySubItem, toggleTodayTask, deleteTodayTask,
      toggleTodaySubItem, deleteTodaySubItem, updateTodayTaskLabel, updateTodaySubItemLabel,
      setTodayTaskTags, toggleTodaySubItemUrgent, refreshData,
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
