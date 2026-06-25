'use client'

import { useState, useMemo, useEffect } from 'react'
import { isRecurring } from '@/shared/lib/sort-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompletedCycle {
  id: string; title: string; area: string; mode: 'work' | 'personal'
  triggerLabel: string | null; createdAt: string; lastCompletedAt: string
  effort: 'quick' | 'medium' | 'heavy'; must: boolean; urgent: boolean
  items: { status: string }[] | null
}

export interface OpenCycle {
  id: string; title: string; area: string; mode: 'work' | 'personal'
  triggerLabel: string | null; createdAt: string
  effort: 'quick' | 'medium' | 'heavy'; must: boolean; urgent: boolean
}

export interface TaskCompletion {
  title: string; area: string; effort: 'quick' | 'medium' | 'heavy'
  must: boolean; urgent: boolean; mode: 'work' | 'personal'
  completedAt: string
}

export interface HabitDef {
  id: string; name: string; emoji: string; goal: number; mode: 'work' | 'personal'
  frequency?: { type: string; days?: number[]; times?: number }
}

export interface AnalyticsData {
  cycles: CompletedCycle[]
  openCycles: OpenCycle[]
  taskCompletions: TaskCompletion[]
  habits: HabitDef[]
  habitLogsByDate: Record<string, Record<string, number>>
  diaryEntries: { date: string; mood: string }[]
}

type Period = 'week' | 'month' | 'year'
type FocusMode = 'output' | 'discipline' | 'clarity' | 'effort'

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 }
const MOOD_SCORE: Record<string, number> = { '😄': 5, '🙂': 4, '😐': 3, '😔': 2, '😢': 1 }

const FOCUS_LABELS: Record<FocusMode, string> = {
  output: 'Output', discipline: 'Discipline', clarity: 'Clarity', effort: 'Effort',
}
const FOCUS_FEATURES: Record<FocusMode, string[]> = {
  output:     ['completionRate', 'weeklyPace'],
  discipline: ['habitHitRate',   'mustHitRate'],
  clarity:    ['onTime',         'backlogAge'],
  effort:     ['effortMix',      'completionTime'],
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayHKT(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function datesInRange(days: number): string[] {
  const today = todayHKT()
  const result: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - i)
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

function prevRangeDates(days: number): string[] {
  const today = todayHKT()
  const result: string[] = []
  for (let i = days * 2 - 1; i >= days; i--) {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - i)
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

function weekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}

// ── Habit consistency (frequency-aware) ───────────────────────────────────────

function habitConsistency(
  h: HabitDef,
  logsByDate: Record<string, Record<string, number>>,
  dates: string[]
): { pct: number; hitLabel: string } {
  const f = h.frequency

  if (!f || f.type === 'daily' || f.type === 'weekdays' || f.type === 'days') {
    const scheduled = dates.filter(d => {
      if (!f || f.type === 'daily') return true
      const dow = new Date(d + 'T00:00:00').getDay()
      if (f.type === 'weekdays') return dow >= 1 && dow <= 5
      return (f.days ?? []).includes(dow)
    })
    const hit = scheduled.filter(d => (logsByDate[`${h.mode}-${d}`]?.[h.id] ?? 0) >= h.goal)
    return {
      pct: scheduled.length > 0 ? Math.round((hit.length / scheduled.length) * 100) : 0,
      hitLabel: `${hit.length}/${scheduled.length} days`,
    }
  }
  if (f.type === 'times_per_week') {
    const target = f.times ?? 1
    const byWeek: Record<string, number> = {}
    dates.forEach(d => {
      const wk = weekMonday(d)
      byWeek[wk] = (byWeek[wk] ?? 0) + (logsByDate[`${h.mode}-${d}`]?.[h.id] ?? 0)
    })
    const weeks = Object.values(byWeek)
    const hit = weeks.filter(t => t >= target).length
    return { pct: weeks.length > 0 ? Math.round((hit / weeks.length) * 100) : 0, hitLabel: `${hit}/${weeks.length} weeks` }
  }
  if (f.type === 'times_per_month') {
    const target = f.times ?? 1
    const byMonth: Record<string, number> = {}
    dates.forEach(d => {
      const mo = d.slice(0, 7)
      byMonth[mo] = (byMonth[mo] ?? 0) + (logsByDate[`${h.mode}-${d}`]?.[h.id] ?? 0)
    })
    const months = Object.values(byMonth)
    const hit = months.filter(t => t >= target).length
    return { pct: months.length > 0 ? Math.round((hit / months.length) * 100) : 0, hitLabel: `${hit}/${months.length} months` }
  }
  return { pct: 0, hitLabel: '—' }
}

// ── Chart components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = '#3b82f6', trend, noData }: {
  label: string; value: string | number; sub?: string; accent?: string
  trend?: { dir: 'up' | 'down' | 'same'; pct: number }
  noData?: string
}) {
  if (noData) return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>{noData}</p>
    </div>
  )
  const trendColor = trend?.dir === 'up' ? '#4ade80' : trend?.dir === 'down' ? '#f87171' : 'rgba(255,255,255,0.35)'
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="text-3xl font-bold leading-none" style={{ color: accent }}>{value}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {sub && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>}
        {trend && trend.pct > 0 && (
          <span className="text-[11px] font-semibold" style={{ color: trendColor }}>
            {trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '—'} {trend.pct}% vs prev
          </span>
        )}
      </div>
    </div>
  )
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{title}</p>
      {children}
    </div>
  )
}

function BarChart({ data, barHeight = 80, showValues = false }: {
  data: { label: string; value: number; color?: string; dim?: boolean }[]
  barHeight?: number
  showValues?: boolean
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 w-full" style={{ height: barHeight + 20 }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          {showValues
            ? <span className="text-[9px]" style={{ color: d.value > 0 ? 'rgba(255,255,255,0.35)' : 'transparent' }}>{d.value}</span>
            : <div style={{ height: 14 }} />
          }
          <div
            className="w-full rounded-sm transition-all"
            style={{
              height: `${Math.max((d.value / max) * barHeight, 4)}px`,
              backgroundColor: d.value > 0 ? (d.color ?? '#3b82f6') : 'rgba(255,255,255,0.10)',
              opacity: d.dim ? 0.4 : d.value === 0 ? 0.35 : 1,
            }}
          />
          <span className="text-[9px] leading-none truncate w-full text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function Heatmap({ completionsByDate, dates }: {
  completionsByDate: Record<string, number>; dates: string[]
}) {
  const max = Math.max(...dates.map(d => completionsByDate[d] ?? 0), 1)

  if (dates.length <= 7) {
    return (
      <div className="flex gap-1">
        {dates.map(d => {
          const count = completionsByDate[d] ?? 0
          const day = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
          return (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded aspect-square" title={`${d}: ${count}`}
                style={{ backgroundColor: count > 0 ? `rgba(59,130,246,${0.15 + (count / max) * 0.85})` : 'rgba(255,255,255,0.04)' }} />
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{day}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const firstDow = (new Date(dates[0] + 'T00:00:00').getDay() + 6) % 7
  const padded: (string | null)[] = [...Array(firstDow).fill(null), ...dates]
  const weeks: (string | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))
  const cell = dates.length > 60 ? 10 : 13

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]" style={{ width: `${weeks.length * (cell + 3)}px` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((d, di) => {
              if (!d) return <div key={di} style={{ width: cell, height: cell }} />
              const count = completionsByDate[d] ?? 0
              return (
                <div key={d} className="rounded-[2px]" title={`${d}: ${count}`}
                  style={{ width: cell, height: cell, backgroundColor: count > 0 ? `rgba(59,130,246,${0.15 + (count / max) * 0.85})` : 'rgba(255,255,255,0.05)' }} />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DualLineChart({ dates, seriesA, seriesB, labelA, labelB, colorA, colorB }: {
  dates: string[]; seriesA: number[]; seriesB: number[]
  labelA: string; labelB: string; colorA: string; colorB: string
}) {
  const W = 320; const H = 80
  const PAD = { top: 8, right: 8, bottom: 20, left: 8 }
  const pW = W - PAD.left - PAD.right; const pH = H - PAD.top - PAD.bottom
  const norm = (arr: number[]) => { const mx = Math.max(...arr, 1); return arr.map(v => v / mx) }
  const pts = (vals: number[]) => vals.map((v, i) =>
    `${PAD.left + (i / Math.max(vals.length - 1, 1)) * pW},${PAD.top + (1 - v) * pH}`
  ).join(' ')
  const step = Math.ceil(dates.length / 6)
  return (
    <div>
      <div className="flex gap-4 mb-2">
        {[{ label: labelA, color: colorA }, { label: labelB, color: colorB }].map(s => (
          <span key={s.label} className="text-[10px] flex items-center gap-1" style={{ color: s.color }}>
            <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
          <polyline points={pts(norm(seriesA))} fill="none" stroke={colorA} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          <polyline points={pts(norm(seriesB))} fill="none" stroke={colorB} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          {dates.filter((_, i) => i % step === 0).map(d => {
            const i = dates.indexOf(d)
            return <text key={d} x={PAD.left + (i / Math.max(dates.length - 1, 1)) * pW} y={H - 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">{d.slice(5)}</text>
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const { cycles, openCycles, taskCompletions, habits, habitLogsByDate, diaryEntries } = data

  const [period, setPeriod] = useState<Period>('month')
  const [focus, setFocus] = useState<FocusMode>('output')

  useEffect(() => {
    const saved = localStorage.getItem('navi-analytics-focus') as FocusMode | null
    if (saved && saved in FOCUS_LABELS) setFocus(saved)
  }, [])

  const saveFocus = (f: FocusMode) => {
    setFocus(f)
    localStorage.setItem('navi-analytics-focus', f)
  }

  const days = PERIOD_DAYS[period]
  const dates = useMemo(() => datesInRange(days), [days])
  const dateSet = useMemo(() => new Set(dates), [dates])
  const prevDates = useMemo(() => prevRangeDates(days), [days])
  const prevDateSet = useMemo(() => new Set(prevDates), [prevDates])

  // ── Core filtered sets ────────────────────────────────────────────────────

  const completedInPeriod = useMemo(
    () => cycles.filter(c => dateSet.has(c.lastCompletedAt.slice(0, 10))),
    [cycles, dateSet]
  )
  const completedInPrev = useMemo(
    () => cycles.filter(c => prevDateSet.has(c.lastCompletedAt.slice(0, 10))),
    [cycles, prevDateSet]
  )
  const openCreatedInPeriod = useMemo(
    () => openCycles.filter(c => dateSet.has(c.createdAt.slice(0, 10))),
    [openCycles, dateSet]
  )
  const taskCompletionsInPeriod = useMemo(
    () => taskCompletions.filter(t => dateSet.has(t.completedAt.slice(0, 10))),
    [taskCompletions, dateSet]
  )

  // ── Fix 1: Completion rate with denominator ───────────────────────────────

  const completionCount = completedInPeriod.length
  const total = completionCount + openCreatedInPeriod.length
  const completionRate = total > 0 ? Math.round((completionCount / total) * 100) : null
  const prevCount = completedInPrev.length
  const completionTrend = useMemo((): { dir: 'up' | 'down' | 'same'; pct: number } => {
    if (prevCount === 0) return { dir: 'same', pct: 0 }
    const pct = Math.round(Math.abs((completionCount - prevCount) / prevCount) * 100)
    return { dir: completionCount > prevCount ? 'up' : completionCount < prevCount ? 'down' : 'same', pct }
  }, [completionCount, prevCount])

  // Sub-tasks from completed cycles
  const doneSubItems = useMemo(() =>
    completedInPeriod.reduce((s, c) => s + (c.items?.filter(i => i.status === 'done').length ?? 0), 0)
  , [completedInPeriod])
  const totalSubItems = useMemo(() =>
    completedInPeriod.reduce((s, c) => s + (c.items?.length ?? 0), 0)
  , [completedInPeriod])

  // ── Fix 2a: On-time rate ──────────────────────────────────────────────────

  const onTimeData = useMemo(() => {
    const withDue = completedInPeriod.filter(c => c.triggerLabel && /^\d{4}-\d{2}-\d{2}$/.test(c.triggerLabel))
    const onTime  = withDue.filter(c => c.lastCompletedAt.slice(0, 10) <= c.triggerLabel!)
    return { rate: withDue.length >= 3 ? Math.round((onTime.length / withDue.length) * 100) : null, n: onTime.length, total: withDue.length }
  }, [completedInPeriod])

  // ── Fix 2b: Habit hit rate (frequency-aware) ──────────────────────────────

  const habitHitRate = useMemo(() => {
    if (habits.length === 0) return null
    const rates = habits.map(h => habitConsistency(h, habitLogsByDate, dates).pct)
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
  }, [habits, habitLogsByDate, dates])

  // ── Completions heatmap ───────────────────────────────────────────────────

  const completionsByDate = useMemo(() => {
    const map: Record<string, number> = {}
    completedInPeriod.forEach(c => { const d = c.lastCompletedAt.slice(0, 10); map[d] = (map[d] ?? 0) + 1 })
    taskCompletionsInPeriod.forEach(t => { const d = t.completedAt.slice(0, 10); map[d] = (map[d] ?? 0) + 1 })
    return map
  }, [completedInPeriod, taskCompletionsInPeriod])

  // ── Weekly pace (always 8 full weeks, outside period filter) ─────────────

  const weeklyPaceData = useMemo(() => {
    const today = todayHKT()
    const todayD = new Date(today + 'T00:00:00')
    const dow = (todayD.getDay() + 6) % 7
    const currentMonday = new Date(todayD)
    currentMonday.setDate(todayD.getDate() - dow)

    return Array.from({ length: 8 }, (_, i) => {
      const wkStart = new Date(currentMonday)
      wkStart.setDate(currentMonday.getDate() - (7 - i) * 7)
      const wkEnd = new Date(wkStart)
      wkEnd.setDate(wkStart.getDate() + 6)
      const startStr = wkStart.toISOString().slice(0, 10)
      const endStr   = wkEnd.toISOString().slice(0, 10)
      const isCurrent = i === 7
      const label = wkStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const value = cycles.filter(c => {
        const d = c.lastCompletedAt.slice(0, 10)
        return d >= startStr && d <= endStr
      }).length + taskCompletions.filter(t => {
        const d = t.completedAt.slice(0, 10)
        return d >= startStr && d <= endStr
      }).length
      return { label, value, dim: isCurrent }
    })
  }, [cycles, taskCompletions])

  // ── Effort mix ────────────────────────────────────────────────────────────

  const effortMix = useMemo(() => {
    const counts = { quick: 0, medium: 0, heavy: 0 }
    completedInPeriod.forEach(c => { counts[c.effort] = (counts[c.effort] ?? 0) + 1 })
    taskCompletionsInPeriod.forEach(t => { counts[t.effort as keyof typeof counts] = (counts[t.effort as keyof typeof counts] ?? 0) + 1 })
    const total = counts.quick + counts.medium + counts.heavy
    return {
      data: [
        { label: 'Quick', value: counts.quick, color: '#4ade80' },
        { label: 'Medium', value: counts.medium, color: '#fbbf24' },
        { label: 'Heavy', value: counts.heavy, color: '#f87171' },
      ],
      heavyPct: total > 0 ? Math.round((counts.heavy / total) * 100) : 0,
      total,
    }
  }, [completedInPeriod, taskCompletionsInPeriod])

  // ── Must / Urgent hit rate ────────────────────────────────────────────────

  const mustUrgentRate = useMemo(() => {
    const mustDone = completedInPeriod.filter(c => c.must).length
    const mustOpen = openCreatedInPeriod.filter(c => c.must).length
    const mustTotal = mustDone + mustOpen
    const urgentDone = completedInPeriod.filter(c => c.urgent).length
    const urgentOpen = openCreatedInPeriod.filter(c => c.urgent).length
    const urgentTotal = urgentDone + urgentOpen
    return {
      must: { done: mustDone, total: mustTotal, pct: mustTotal > 0 ? Math.round((mustDone / mustTotal) * 100) : null },
      urgent: { done: urgentDone, total: urgentTotal, pct: urgentTotal > 0 ? Math.round((urgentDone / urgentTotal) * 100) : null },
    }
  }, [completedInPeriod, openCreatedInPeriod])

  // ── Completion time (excluding recurring, using creation lag) ─────────────

  const completionTime = useMemo(() => {
    const adHoc = completedInPeriod.filter(c => c.createdAt && !isRecurring(c.triggerLabel ?? undefined))
    const lags = adHoc.map(c => daysBetween(c.createdAt.slice(0, 10), c.lastCompletedAt.slice(0, 10)))
    const avgLag = lags.length > 0 ? Math.round(lags.reduce((a, b) => a + b, 0) / lags.length) : null

    const withDue = completedInPeriod.filter(c => c.triggerLabel && /^\d{4}-\d{2}-\d{2}$/.test(c.triggerLabel))
    const deltas  = withDue.map(c => daysBetween(c.triggerLabel!, c.lastCompletedAt.slice(0, 10)))
    const avgDelta = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null

    return { avgLag, avgDelta, lagSample: lags.length, deltaSample: withDue.length }
  }, [completedInPeriod])

  // ── Open backlog age ──────────────────────────────────────────────────────

  const backlogAge = useMemo(() => {
    if (openCycles.length === 0) return null
    const today = todayHKT()
    const ages = openCycles.map(c => daysBetween(c.createdAt.slice(0, 10), today))
    const avg = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
    const oldest = [...openCycles].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1).slice(0, 3)
    return { avg, count: openCycles.length, oldest }
  }, [openCycles])

  // ── Completions over time (period bar chart) ──────────────────────────────

  const tasksOverTime = useMemo(() => {
    const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    if (period === 'week') {
      return dates.map(d => ({
        label: DAY_SHORT[(new Date(d + 'T00:00:00').getDay() + 6) % 7],
        value: completionsByDate[d] ?? 0,
        color: '#3b82f6',
      }))
    }
    if (period === 'month') {
      const buckets: { label: string; value: number; color: string }[] = []
      for (let i = 0; i < dates.length; i += 5) {
        const slice = dates.slice(i, i + 5)
        buckets.push({ label: slice[0].slice(5), value: slice.reduce((s, d) => s + (completionsByDate[d] ?? 0), 0), color: '#3b82f6' })
      }
      return buckets
    }
    const byMonth: Record<string, number> = {}
    dates.forEach(d => { const m = d.slice(0, 7); byMonth[m] = (byMonth[m] ?? 0) + (completionsByDate[d] ?? 0) })
    return Object.entries(byMonth).map(([m, v]) => ({
      label: new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' }),
      value: v, color: '#3b82f6',
    }))
  }, [period, dates, completionsByDate])

  // ── Most productive day (month/year only — use last 90d) ──────────────────

  const productiveByDow = useMemo(() => {
    const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const ref90 = new Set(datesInRange(90))
    const counts = Array(7).fill(0)
    cycles.filter(c => ref90.has(c.lastCompletedAt.slice(0, 10))).forEach(c => {
      counts[(new Date(c.lastCompletedAt.slice(0, 10) + 'T00:00:00').getDay() + 6) % 7]++
    })
    return DAY_SHORT.map((label, i) => ({ label, value: counts[i], color: '#818cf8' }))
  }, [cycles])

  // ── Most productive week of month ─────────────────────────────────────────

  const productiveByWeek = useMemo(() => {
    const counts = [0, 0, 0, 0]
    completedInPeriod.forEach(c => {
      counts[Math.min(Math.floor((parseInt(c.lastCompletedAt.slice(8, 10), 10) - 1) / 7), 3)]++
    })
    return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'].map((label, i) => ({ label, value: counts[i], color: '#a78bfa' }))
  }, [completedInPeriod])

  // ── Mood vs productivity ──────────────────────────────────────────────────

  const moodData = useMemo(() => {
    const moodByDate: Record<string, number> = {}
    diaryEntries.forEach(e => { moodByDate[e.date] = MOOD_SCORE[e.mood] ?? 0 })
    const moodDates = dates.filter(d => moodByDate[d] > 0 || (completionsByDate[d] ?? 0) > 0)
    return {
      dates: moodDates,
      moods: moodDates.map(d => moodByDate[d] ?? 0),
      completions: moodDates.map(d => completionsByDate[d] ?? 0),
      hasData: moodDates.some(d => moodByDate[d] > 0),
    }
  }, [dates, diaryEntries, completionsByDate])

  // ── Habit consistency detail ──────────────────────────────────────────────

  const habitStats = useMemo(() =>
    habits.map(h => ({ ...h, ...habitConsistency(h, habitLogsByDate, dates) }))
      .sort((a, b) => b.pct - a.pct)
  , [habits, habitLogsByDate, dates])

  // ── Ad-hoc task count ─────────────────────────────────────────────────────

  const adHocCount = useMemo(() =>
    completedInPeriod.filter(c => !isRecurring(c.triggerLabel ?? undefined)).length
  , [completedInPeriod])

  // ── Render ─────────────────────────────────────────────────────────────────

  const featuredKeys = FOCUS_FEATURES[focus]
  const periodLabel = { week: 'Last 7 days', month: 'Last 30 days', year: 'Last 365 days' }[period]
  const ageColor = !backlogAge ? '#4ade80' : backlogAge.avg < 14 ? '#4ade80' : backlogAge.avg < 30 ? '#fbbf24' : '#f87171'

  const renderFeaturedCard = (key: string) => {
    switch (key) {
      case 'completionRate':
        return (
          <StatCard key={key}
            label="Completion rate"
            value={completionRate !== null ? `${completionRate}%` : `${completionCount}`}
            sub={completionRate !== null ? `${completionCount}/${total} cycles` : periodLabel}
            accent="#3b82f6"
            trend={completionTrend}
          />
        )
      case 'weeklyPace': {
        const best = weeklyPaceData.reduce((a, b) => b.value > a.value ? b : a, weeklyPaceData[0])
        return (
          <MetricCard key={key} title="Weekly pace — last 8 weeks">
            <BarChart data={weeklyPaceData} barHeight={70} showValues />
            {best.value > 0 && <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Best week: <span className="text-white/70 font-semibold">{best.value}</span> completions</p>}
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Dimmed bar = current incomplete week</p>
          </MetricCard>
        )
      }
      case 'habitHitRate':
        return (
          <StatCard key={key}
            label="Habit hit rate"
            value={habitHitRate !== null ? `${habitHitRate}%` : '—'}
            sub="avg across all habits"
            accent={habitHitRate !== null ? (habitHitRate >= 75 ? '#4ade80' : habitHitRate >= 50 ? '#fbbf24' : '#f87171') : '#3b82f6'}
            noData={habitHitRate === null ? 'No habits set up yet' : undefined}
          />
        )
      case 'mustHitRate':
        return (
          <MetricCard key={key} title="Must / Urgent hit rate">
            <div className="flex gap-4">
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Must</p>
                <p className="text-2xl font-bold" style={{ color: mustUrgentRate.must.pct !== null ? (mustUrgentRate.must.pct >= 80 ? '#4ade80' : mustUrgentRate.must.pct >= 60 ? '#fbbf24' : '#f87171') : 'rgba(255,255,255,0.3)' }}>
                  {mustUrgentRate.must.pct !== null ? `${mustUrgentRate.must.pct}%` : '—'}
                </p>
                {mustUrgentRate.must.total > 0 && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{mustUrgentRate.must.done}/{mustUrgentRate.must.total}</p>}
              </div>
              <div className="w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Urgent</p>
                <p className="text-2xl font-bold" style={{ color: mustUrgentRate.urgent.pct !== null ? (mustUrgentRate.urgent.pct >= 80 ? '#4ade80' : mustUrgentRate.urgent.pct >= 60 ? '#fbbf24' : '#f87171') : 'rgba(255,255,255,0.3)' }}>
                  {mustUrgentRate.urgent.pct !== null ? `${mustUrgentRate.urgent.pct}%` : '—'}
                </p>
                {mustUrgentRate.urgent.total > 0 && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{mustUrgentRate.urgent.done}/{mustUrgentRate.urgent.total}</p>}
              </div>
            </div>
          </MetricCard>
        )
      case 'onTime':
        return (
          <StatCard key={key}
            label="On-time rate"
            value={onTimeData.rate !== null ? `${onTimeData.rate}%` : '—'}
            sub={onTimeData.total >= 3 ? `${onTimeData.n}/${onTimeData.total} cycles with due dates` : onTimeData.total > 0 ? `Only ${onTimeData.total} due-date cycles (need 3+)` : 'No due-date cycles this period'}
            accent={onTimeData.rate !== null ? (onTimeData.rate >= 80 ? '#4ade80' : onTimeData.rate >= 60 ? '#fbbf24' : '#f87171') : '#3b82f6'}
            noData={onTimeData.rate === null && onTimeData.total === 0 ? 'No cycles with due dates this period' : undefined}
          />
        )
      case 'backlogAge':
        return (
          <MetricCard key={key} title="Open backlog age">
            {backlogAge ? (
              <div>
                <p className="text-3xl font-bold leading-none" style={{ color: ageColor }}>{backlogAge.avg}<span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>days avg · {backlogAge.count} open</span></p>
                <div className="mt-3 space-y-1">
                  {backlogAge.oldest.map(c => (
                    <p key={c.id} className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>{daysBetween(c.createdAt.slice(0, 10), todayHKT())}d · </span>
                      {c.title}
                    </p>
                  ))}
                  {backlogAge.oldest.length > 0 && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>↑ oldest open cycles</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No open cycles 🎉</p>
            )}
          </MetricCard>
        )
      case 'effortMix':
        return (
          <MetricCard key={key} title="Effort mix">
            <BarChart data={effortMix.data} barHeight={80} showValues />
            {effortMix.total > 0 && (
              <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ color: '#f87171' }}>{effortMix.heavyPct}%</span> heavy work this period
              </p>
            )}
          </MetricCard>
        )
      case 'completionTime':
        return (
          <MetricCard key={key} title="Completion time">
            <div className="space-y-3">
              {completionTime.avgLag !== null ? (
                <div>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Creation → done (one-off tasks, {completionTime.lagSample} cycles)</p>
                  <p className="text-2xl font-bold" style={{ color: '#38bdf8' }}>{completionTime.avgLag}<span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>days</span></p>
                </div>
              ) : <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No one-off cycles completed</p>}
              {completionTime.avgDelta !== null && (
                <div>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Due date delta ({completionTime.deltaSample} cycles) · + = late</p>
                  <p className="text-2xl font-bold" style={{ color: completionTime.avgDelta <= 0 ? '#4ade80' : '#f87171' }}>
                    {completionTime.avgDelta > 0 ? '+' : ''}{completionTime.avgDelta}<span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>days</span>
                  </p>
                </div>
              )}
            </div>
          </MetricCard>
        )
      default:
        return null
    }
  }

  // Non-featured cards (shown in grid below)
  const allKeys = ['completionRate', 'onTime', 'habitHitRate', 'weeklyPace', 'effortMix', 'mustHitRate', 'completionTime', 'backlogAge']
  const gridKeys = allKeys.filter(k => !featuredKeys.includes(k))

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ touchAction: 'pan-y' }}>
      <div className="px-5 pt-5 pb-10 space-y-5 max-w-3xl mx-auto w-full">

        {/* Header */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Analytics</p>
          <h2 className="text-xl font-bold text-white mt-1">Your Productivity</h2>
        </div>

        {/* Focus chips */}
        <div>
          <p className="text-[10px] mb-2 font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>What are you focusing on?</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(FOCUS_LABELS) as FocusMode[]).map(f => (
              <button key={f} onClick={() => saveFocus(f)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={focus === f
                  ? { background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f650' }
                  : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {FOCUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {(['week', 'month', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize"
              style={period === p ? { background: '#3b82f6', color: '#fff' } : { color: 'rgba(255,255,255,0.45)' }}>
              {p}
            </button>
          ))}
        </div>

        {/* Featured metrics (stacked on mobile, 2-col on wider screens) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {featuredKeys.map(k => renderFeaturedCard(k))}
        </div>

        {/* Secondary stat row: sub-tasks + today tasks */}
        {(totalSubItems > 0 || taskCompletionsInPeriod.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {totalSubItems > 0 && (
              <StatCard label="Sub-tasks done" value={`${doneSubItems}/${totalSubItems}`} sub="across completed cycles" accent="#22d3ee" />
            )}
            {taskCompletionsInPeriod.length > 0 && (
              <StatCard label="Today tasks done" value={taskCompletionsInPeriod.length} sub="from Today tab" accent="#fcd34d" />
            )}
          </div>
        )}

        {/* Activity heatmap */}
        <MetricCard title={`Activity — ${periodLabel}`}>
          <Heatmap completionsByDate={completionsByDate} dates={dates} />
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {completionCount + taskCompletionsInPeriod.length} completions (cycles + tasks) · darker = more done
          </p>
        </MetricCard>

        {/* Secondary metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gridKeys.map(k => renderFeaturedCard(k))}

          {/* Completions over time */}
          <MetricCard title="Completions over time">
            <BarChart data={tasksOverTime} barHeight={80} showValues />
          </MetricCard>

          {/* Productive day (month/year only) */}
          {period !== 'week' && (
            <MetricCard title="Most productive day (last 90 days)">
              <BarChart data={productiveByDow} barHeight={80} showValues />
              {(() => {
                const best = productiveByDow.reduce((a, b) => b.value > a.value ? b : a)
                return best.value > 0 ? <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Most completions on <span className="text-white/70 font-semibold">{best.label}</span></p> : null
              })()}
            </MetricCard>
          )}

          {/* Productive week of month */}
          <MetricCard title="Most productive week of month">
            <BarChart data={productiveByWeek} barHeight={80} showValues />
          </MetricCard>

          {/* Ad-hoc vs recurring split */}
          {completionCount > 0 && (
            <MetricCard title="One-off vs recurring">
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>One-off</p>
                  <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>{adHocCount}</p>
                </div>
                <div className="w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div>
                  <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Recurring</p>
                  <p className="text-2xl font-bold text-white/70">{completionCount - adHocCount}</p>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {Math.round((adHocCount / completionCount) * 100)}% of cycles this period were one-off
              </p>
            </MetricCard>
          )}
        </div>

        {/* Mood vs productivity */}
        {moodData.hasData && moodData.dates.length > 2 && (
          <MetricCard title="Mood vs productivity">
            <DualLineChart dates={moodData.dates} seriesA={moodData.moods} seriesB={moodData.completions}
              labelA="Mood" labelB="Completions" colorA="#f0a8c8" colorB="#3b82f6" />
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Both normalised to 0–1. Requires diary entries with mood.</p>
          </MetricCard>
        )}
        {!moodData.hasData && (
          <MetricCard title="Mood vs productivity">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Start writing diary entries with a mood to see this correlation.</p>
          </MetricCard>
        )}

        {/* Habit consistency detail */}
        {habitStats.length > 0 && (
          <MetricCard title="Habit consistency">
            <div className="space-y-3">
              {habitStats.map(h => (
                <div key={h.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <span>{h.emoji}</span><span>{h.name}</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>({h.mode === 'work' ? '💼' : '🏠'})</span>
                    </span>
                    <span className="text-[12px] font-bold" style={{ color: h.pct >= 75 ? '#4ade80' : h.pct >= 50 ? '#fbbf24' : '#f87171' }}>
                      {h.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${h.pct}%`, backgroundColor: h.pct >= 75 ? '#4ade80' : h.pct >= 50 ? '#fbbf24' : '#f87171' }} />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{h.hitLabel}</p>
                </div>
              ))}
            </div>
          </MetricCard>
        )}

      </div>
    </div>
  )
}
