'use client'

import { useState, useEffect } from 'react'
import type { WeeklyReviewRecord } from './use-weekly-review'

/**
 * One thing that was actually finished, read from the completion log.
 *
 * `cycle` — a whole recurring/one-off cycle was completed
 * `task`  — a Today-tab task was completed
 * `step`  — a single checklist item inside a cycle or task was ticked
 */
export interface CompletionEntry {
  kind: 'cycle' | 'task' | 'step'
  id: string           // cycle_id / task_id — for a step, the step's own composite id
  parentId?: string    // for a step: the cycle or task it belongs to
  title: string
  area: string
  date: string         // YYYY-MM-DD, local calendar day
}

const KEY = { 'x-api-key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' }

// completed_at is stored in UTC. Convert to the LOCAL calendar day —
// toISOString() here would hand back the previous day in HKT.
function localDay(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function readTable(table: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
  try {
    const p = new URLSearchParams({ table, ...params })
    const res = await fetch(`/api/db?${p}`, { headers: KEY })
    const json = await res.json() as { data?: Record<string, unknown>[] }
    return json.data ?? []
  } catch (e) {
    console.error('[useReviewData]', table, e)
    return []
  }
}

export interface ReviewData {
  /** Everything finished on or after `from`, newest first. */
  log: CompletionEntry[]
  /** Last Monday's saved review, so this one can close the loop on it. */
  lastWeekReview: WeeklyReviewRecord | null
  loaded: boolean
}

/**
 * Loads the real completion history for the review window, plus last week's
 * saved review. Only called while the review modal is open, so nothing is
 * fetched on a normal Today load.
 */
export function useReviewData(
  mode: 'work' | 'personal',
  from: string,
  lastWeekStart: string,
): ReviewData {
  const [log, setLog] = useState<CompletionEntry[]>([])
  const [lastWeekReview, setLastWeekReview] = useState<WeeklyReviewRecord | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const reviewTable = mode === 'personal' ? 'personal_weekly_reviews' : 'weekly_reviews'
      const order = { orderCol: 'completed_at', orderDir: 'desc' }

      const [cycleRows, taskRows, reviewRows] = await Promise.all([
        readTable('cycle_completions', { eqCol: 'mode', eqVal: mode, ...order, limit: '400' }),
        readTable('task_completions', { eqCol: 'mode', eqVal: mode, ...order, limit: '800' }),
        readTable(reviewTable, { eqCol: 'week_start', eqVal: lastWeekStart }),
      ])
      if (cancelled) return

      const entries: CompletionEntry[] = []

      for (const r of cycleRows) {
        const ts = r.completed_at as string | null
        if (!ts) continue
        const date = localDay(ts)
        if (date < from) continue
        entries.push({
          kind: 'cycle',
          id: (r.cycle_id as string) ?? (r.id as string),
          title: (r.title as string) ?? '',
          area: (r.area as string) ?? '',
          date,
        })
      }

      for (const r of taskRows) {
        const ts = r.completed_at as string | null
        if (!ts) continue
        const date = localDay(ts)
        if (date < from) continue
        // Checklist items are logged as `${parentId}::${itemId}` (or with a
        // third segment for a sub-step). Anything else is a whole task.
        const taskId = (r.task_id as string) ?? ''
        const isStep = taskId.includes('::')
        entries.push({
          kind: isStep ? 'step' : 'task',
          id: taskId,
          parentId: isStep ? taskId.split('::')[0] : undefined,
          title: (r.title as string) ?? '',
          area: (r.area as string) ?? '',
          date,
        })
      }

      entries.sort((a, b) => b.date.localeCompare(a.date))

      const rr = reviewRows[0]
      setLastWeekReview(rr ? {
        id: rr.id as string,
        weekStart: rr.week_start as string,
        completedIds: (rr.completed_ids ?? []) as string[],
        deferred: (rr.deferred ?? []) as { id: string; toDate: string; reason: string }[],
        focusIds: (rr.focus_ids ?? []) as string[],
        notes: rr.notes as string | undefined,
      } : null)
      setLog(entries)
      setLoaded(true)
    }

    load()
    return () => { cancelled = true }
  }, [mode, from, lastWeekStart])

  return { log, lastWeekReview, loaded }
}
