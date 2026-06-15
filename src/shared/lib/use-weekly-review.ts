'use client'

import { useState, useEffect, useCallback } from 'react'

const REVIEW_DATE_KEY = 'navi-last-review-date'

export interface WeeklyReviewRecord {
  id: string
  weekStart: string
  completedIds: string[]
  deferred: { id: string; toDate: string; reason: string }[]
  focusIds: string[]
  notes?: string
}

function getMondayStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useWeeklyReview() {
  const [thisWeekFocus, setThisWeekFocus] = useState<string[]>([])
  const [thisWeekReview, setThisWeekReview] = useState<WeeklyReviewRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reviewDismissed, setReviewDismissed] = useState(true) // start true to avoid flash

  useEffect(() => {
    const todayStr = getTodayStr()
    const lastDone = localStorage.getItem(REVIEW_DATE_KEY)
    setReviewDismissed(lastDone === todayStr)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const weekStart = getMondayStr()
        const params = new URLSearchParams({ table: 'weekly_reviews', eqCol: 'week_start', eqVal: weekStart })
        const res = await fetch(`/api/db?${params}`)
        const json = await res.json() as { data?: Record<string, unknown>[] }
        const rows = json.data ?? []
        if (rows[0]) {
          const r = rows[0]
          const record: WeeklyReviewRecord = {
            id: r.id as string,
            weekStart: r.week_start as string,
            completedIds: (r.completed_ids ?? []) as string[],
            deferred: (r.deferred ?? []) as { id: string; toDate: string; reason: string }[],
            focusIds: (r.focus_ids ?? []) as string[],
            notes: r.notes as string | undefined,
          }
          setThisWeekReview(record)
          setThisWeekFocus(record.focusIds)
          localStorage.setItem(REVIEW_DATE_KEY, getTodayStr())
          setReviewDismissed(true)
        }
      } catch (e) {
        console.error('[useWeeklyReview]', e)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  const saveReview = useCallback(async (data: {
    completedIds: string[]
    deferred: { id: string; toDate: string; reason: string }[]
    focusIds: string[]
    notes?: string
  }) => {
    const weekStart = getMondayStr()
    const id = `review-${weekStart}`

    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'weekly_reviews',
        operation: 'upsert',
        data: {
          id,
          week_start: weekStart,
          completed_ids: data.completedIds,
          deferred: data.deferred,
          focus_ids: data.focusIds,
          notes: data.notes ?? null,
        }
      }),
    })

    const todayStr = getTodayStr()
    setThisWeekFocus(data.focusIds)
    setThisWeekReview({ id, weekStart, ...data })
    localStorage.setItem(REVIEW_DATE_KEY, todayStr)
    setReviewDismissed(true)
  }, [])

  const dismissReview = useCallback(() => {
    localStorage.setItem(REVIEW_DATE_KEY, getTodayStr())
    setReviewDismissed(true)
  }, [])

  const today = new Date()
  const isMonday = today.getDay() === 1
  const isReviewDue = isMonday && !reviewDismissed && loaded

  return { thisWeekFocus, thisWeekReview, isReviewDue, loaded, saveReview, dismissReview }
}
