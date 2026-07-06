'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { Cycle, ChecklistItem, PersonalArea } from '@/shared/types'
import { isRecurring, computeNextDue, allCycleDone, resetCycle } from '@/shared/lib/sort-utils'
import { useToast } from '@/shared/lib/toast-context'
import { personalFinanceCycles as initPersonalFinance } from '@/features/personal/finance/data'

// ── DB helpers ────────────────────────────────────────────────────────────────
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

// ── Row mappers ───────────────────────────────────────────────────────────────
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
    mode: 'personal',
  }
  if (c.notes !== undefined) row.notes = c.notes
  return row
}

function applyRecurrenceResets(cycles: Cycle[], onReset: (c: Cycle) => void): Cycle[] {
  const _d = new Date(); const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`
  return cycles.map(c => {
    if (c.nextDueAt && c.nextDueAt <= today) {
      const fresh = resetCycle(c)
      onReset(fresh)
      return fresh
    }
    return c
  })
}

function mergePhases(staticPhases: Cycle['phases'], dbPhases: Cycle['phases']): Cycle['phases'] {
  if (!staticPhases) return dbPhases
  if (!dbPhases) return staticPhases
  const dbById = new Map(dbPhases.map(p => [p.id, p]))
  return staticPhases.map(sp => {
    const dbP = dbById.get(sp.id)
    if (!dbP) return sp
    const dbItemById = new Map(dbP.items.map(i => [i.id, i]))
    const mergedItems = sp.items.map(si => {
      const dbI = dbItemById.get(si.id)
      if (!dbI) return si
      const mergedSubs = si.subItems?.map(ss => {
        const dbS = dbI.subItems?.find(ds => ds.id === ss.id)
        return dbS ? { ...ss, status: dbS.status } : ss
      })
      return { ...si, status: dbI.status, ...(mergedSubs ? { subItems: mergedSubs } : {}) }
    })
    return { ...sp, status: dbP.status, items: mergedItems }
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
  return items.filter(i => i.id !== id).map(i => i.subItems ? { ...i, subItems: removeItem(i.subItems, id) } : i)
}

function removeCycleItem(cycle: Cycle, itemId: string): Cycle {
  if (cycle.items) return { ...cycle, items: removeItem(cycle.items, itemId) }
  if (cycle.phases) return { ...cycle, phases: cycle.phases.map(p => ({ ...p, items: removeItem(p.items, itemId) })) }
  return cycle
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface PersonalDataCtx {
  houseworkCycles: Cycle[]
  personalFinanceCycles: Cycle[]
  sidoiCycles: Cycle[]
  tobuyCycles: Cycle[]
  completedTitles: string[]
  addCycle: (area: PersonalArea, cycle: Cycle) => void
  updateCycle: (area: PersonalArea, id: string, patch: Partial<Pick<Cycle, 'title' | 'must' | 'urgent' | 'effort' | 'triggerLabel' | 'subArea' | 'status' | 'notes' | 'nextDueAt' | 'items'>>) => void
  deleteCycle: (area: PersonalArea, id: string) => void
  deleteItem: (area: PersonalArea, cycleId: string, itemId: string) => void
  addCycleItem: (area: PersonalArea, cycleId: string, label: string) => void
  toggleItem: (area: PersonalArea, cycleId: string, itemId: string) => void
  setItemLabel: (area: PersonalArea, cycleId: string, itemId: string, label: string) => void
  setItemNote: (area: PersonalArea, cycleId: string, itemId: string, note: string) => void
  setItemUrgent: (area: PersonalArea, cycleId: string, itemId: string, urgent: boolean) => void
  setItemDue: (area: PersonalArea, cycleId: string, itemId: string, due: string) => void
  refreshData: () => Promise<void>
}

export const PersonalDataContext = createContext<PersonalDataCtx | null>(null)

export function PersonalDataProvider({ children }: { children: React.ReactNode }) {
  const [houseworkCycles,       setHouseworkCycles]       = useState<Cycle[]>([])
  const [personalFinanceCycles, setPersonalFinanceCycles] = useState<Cycle[]>([])
  const [sidoiCycles,           setSidoiCycles]           = useState<Cycle[]>([])
  const [tobuyCycles,           setTobuyCycles]           = useState<Cycle[]>([])
  const [completedTitles,       setCompletedTitles]       = useState<string[]>([])
  const sbReady = useRef(false)
  const { showToast } = useToast()
  const pendingCompletions = useRef<Map<string, { cycle: Cycle; area: PersonalArea; timerId: ReturnType<typeof setTimeout> }>>(new Map())

  const cycleSetter = useCallback((area: PersonalArea) => {
    if (area === 'housework')         return setHouseworkCycles
    if (area === 'personal-finance')  return setPersonalFinanceCycles
    if (area === 'sidoi')             return setSidoiCycles
    return setTobuyCycles
  }, [])

  function syncCycle(cycle: Cycle) {
    if (sbReady.current) dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(cycle) })
  }

  const loadFromSupabase = useCallback(async () => {
    try {
      const rows = await dbRead('cycles', { col: 'mode', val: 'personal' }) as ReturnType<typeof fromRow>[]
      const dbIdSet = new Set(rows.map((r: { id: string }) => r.id))

      // Pre-seed defaults not yet in DB
      const toInsert = initPersonalFinance.filter(c => !dbIdSet.has(c.id))
      if (toInsert.length > 0) {
        dbWrite({ table: 'cycles', operation: 'upsert', data: toInsert.map(toRow) })
      }

      const staticById = new Map(initPersonalFinance.map(c => [c.id, c]))
      const all = [
        ...rows.map(r => {
          const row = fromRow(r)
          const s = staticById.get(row.id)
          return s?.phases ? { ...row, phases: mergePhases(s.phases, row.phases) } : row
        }),
        ...toInsert,
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doneTitles = rows.filter((r: any) => r.status === 'complete').map((r: any) => r.title as string).filter(Boolean)
      setCompletedTitles([...new Set(doneTitles)])

      const cycles = applyRecurrenceResets(all, c => dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(c) }))
      const active = cycles.filter(c => c.status !== 'complete')
      setHouseworkCycles(active.filter(c => c.area === 'housework'))
      setPersonalFinanceCycles(active.filter(c => c.area === 'personal-finance'))
      setSidoiCycles(active.filter(c => c.area === 'sidoi'))
      setTobuyCycles(active.filter(c => c.area === 'tobuy'))
    } catch (e) {
      console.error('[personal refreshData]', e)
    }
  }, [])

  useEffect(() => {
    loadFromSupabase().then(() => { sbReady.current = true })
  }, [loadFromSupabase])

  const addCycle = useCallback((area: PersonalArea, cycle: Cycle) => {
    cycleSetter(area)(prev => [cycle, ...prev])
    dbWrite({ table: 'cycles', operation: 'upsert', data: toRow(cycle) })
  }, [cycleSetter])

  const updateCycle = useCallback((area: PersonalArea, id: string, patch: Partial<Pick<Cycle, 'title' | 'must' | 'urgent' | 'effort' | 'triggerLabel' | 'subArea' | 'status' | 'notes' | 'nextDueAt' | 'items'>>) => {
    cycleSetter(area)(prev => {
      const target = prev.find(c => c.id === id)
      if (patch.status === 'complete' && target && !isRecurring(target.triggerLabel)) {
        const completedAt = new Date().toISOString()
        dbWrite({ table: 'cycles', operation: 'upsert', data: toRow({ ...target, status: 'complete', lastCompletedAt: completedAt }) })
        setCompletedTitles(ct => [...new Set([...ct, target.title])])
        return prev.filter(c => c.id !== id)
      }
      const next = prev.map(c => c.id === id ? { ...c, ...patch } : c)
      const changed = next.find(c => c.id === id); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteCycle = useCallback((area: PersonalArea, id: string) => {
    cycleSetter(area)(prev => prev.filter(c => c.id !== id))
    dbWrite({ table: 'cycles', operation: 'delete', matchId: id })
  }, [cycleSetter])

  const deleteItem = useCallback((area: PersonalArea, cycleId: string, itemId: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? removeCycleItem(c, itemId) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const addCycleItem = useCallback((area: PersonalArea, cycleId: string, label: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId
        ? { ...c, items: [...(c.items ?? []), { id: `i-${Date.now()}`, label, status: 'todo' as const }] }
        : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleItem = useCallback((area: PersonalArea, cycleId: string, itemId: string) => {
    cycleSetter(area)(prev => {
      const toggled = prev.map(c => c.id === cycleId
        ? patchCycleItem(c, itemId, i => ({ ...i, status: i.status === 'done' ? 'todo' : 'done' } as ChecklistItem))
        : c)
      const changed = toggled.find(c => c.id === cycleId)
      if (!changed) return toggled

      if (isRecurring(changed.triggerLabel) && changed.nextDueAt && !allCycleDone(changed)) {
        const withCleared = { ...changed, nextDueAt: undefined }
        syncCycle(withCleared)
        return toggled.map(c => c.id === cycleId ? withCleared : c)
      }
      if (isRecurring(changed.triggerLabel) && allCycleDone(changed)) {
        const nextDue = computeNextDue(changed.triggerLabel)
        if (nextDue) {
          const withDue = { ...changed, lastCompletedAt: new Date().toISOString(), nextDueAt: nextDue }
          syncCycle(withDue)
          return toggled.map(c => c.id === cycleId ? withDue : c)
        }
      }
      if (!isRecurring(changed.triggerLabel) && allCycleDone(changed)) {
        const completedAt = new Date().toISOString()
        dbWrite({ table: 'cycles', operation: 'upsert', data: toRow({ ...changed, status: 'complete', lastCompletedAt: completedAt }) })
        setCompletedTitles(ct => [...new Set([...ct, changed.title])])
        const timerId = setTimeout(() => { pendingCompletions.current.delete(cycleId) }, 5000)
        pendingCompletions.current.set(cycleId, { cycle: changed, area, timerId })
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
            },
          },
        })
        return toggled.filter(c => c.id !== cycleId)
      }
      syncCycle(changed)
      return toggled
    })
  }, [cycleSetter, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemLabel = useCallback((area: PersonalArea, cycleId: string, itemId: string, label: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, label })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemNote = useCallback((area: PersonalArea, cycleId: string, itemId: string, note: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, notes: note })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemUrgent = useCallback((area: PersonalArea, cycleId: string, itemId: string, urgent: boolean) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, urgent })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  const setItemDue = useCallback((area: PersonalArea, cycleId: string, itemId: string, due: string) => {
    cycleSetter(area)(prev => {
      const next = prev.map(c => c.id === cycleId ? patchCycleItem(c, itemId, i => ({ ...i, due })) : c)
      const changed = next.find(c => c.id === cycleId); if (changed) syncCycle(changed)
      return next
    })
  }, [cycleSetter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PersonalDataContext.Provider value={{
      houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles, completedTitles,
      addCycle, updateCycle, deleteCycle, deleteItem, addCycleItem,
      toggleItem, setItemLabel, setItemNote, setItemUrgent, setItemDue,
      refreshData: loadFromSupabase,
    }}>
      {children}
    </PersonalDataContext.Provider>
  )
}

export function usePersonalData() {
  const ctx = useContext(PersonalDataContext)
  if (!ctx) throw new Error('usePersonalData must be inside PersonalDataProvider')
  return ctx
}
