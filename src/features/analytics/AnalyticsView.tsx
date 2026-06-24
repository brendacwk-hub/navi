'use client'

import { useState, useMemo } from 'react'
import { isRecurring } from '@/shared/lib/sort-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompletedCycle {
  id: string
  title: string
  area: string
  mode: 'work' | 'personal'
  triggerLabel: string | null
  createdAt: string
  lastCompletedAt: string
  effort: string
}

export interface HabitDef {
  id: string
  name: string
  emoji: string
  goal: number
  mode: 'work' | 'personal'
}

export interface AnalyticsData {
  cycles: CompletedCycle[]
  habits: HabitDef[]
  habitLogsByDate: Record<string, Record<string, number>>  // 'work-2026-06-24' → { habitId: count }
  diaryEntries: { date: string; mood: string }[]
}

type Period = 'week' | 'month' | 'year'
const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 }

const MOOD_SCORE: Record<string, number> = { '😄': 5, '🙂': 4, '😐': 3, '😔': 2, '😢': 1 }

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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = '#3b82f6', trend }: {
  label: string
  value: string | number
  sub?: string
  accent?: string
  trend?: { dir: 'up' | 'down' | 'same'; pct: number }
}) {
  const trendColor = trend?.dir === 'up' ? '#4ade80' : trend?.dir === 'down' ? '#f87171' : 'rgba(255,255,255,0.35)'
  const trendSymbol = trend?.dir === 'up' ? '↑' : trend?.dir === 'down' ? '↓' : '—'
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="text-3xl font-bold leading-none" style={{ color: accent }}>{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {sub && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>}
        {trend && trend.pct > 0 && (
          <span className="text-[11px] font-semibold" style={{ color: trendColor }}>
            {trendSymbol} {trend.pct}% vs prev
          </span>
        )}
      </div>
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, color = '#3b82f6', barHeight = 80, showValues = false }: {
  data: { label: string; value: number }[]
  color?: string
  barHeight?: number
  showValues?: boolean
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 w-full" style={{ height: barHeight + 20 }}>
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-0.5">
          {showValues && d.value > 0 && (
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{d.value}</span>
          )}
          {!showValues && <div style={{ height: 14 }} />}
          <div
            className="w-full rounded-sm transition-all"
            style={{
              height: `${Math.max((d.value / max) * barHeight, d.value > 0 ? 3 : 2)}px`,
              backgroundColor: d.value > 0 ? color : 'rgba(255,255,255,0.06)',
            }}
          />
          <span className="text-[9px] leading-none truncate w-full text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ completionsByDate, dates }: {
  completionsByDate: Record<string, number>
  dates: string[]
}) {
  const max = Math.max(...dates.map(d => completionsByDate[d] ?? 0), 1)

  if (dates.length <= 7) {
    return (
      <div className="flex gap-1">
        {dates.map(d => {
          const count = completionsByDate[d] ?? 0
          const intensity = count / max
          const day = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
          return (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded aspect-square"
                title={`${d}: ${count}`}
                style={{ backgroundColor: count > 0 ? `rgba(59,130,246,${0.15 + intensity * 0.85})` : 'rgba(255,255,255,0.04)' }}
              />
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

  const cellPx = dates.length > 60 ? 10 : 13

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]" style={{ width: `${weeks.length * (cellPx + 3)}px` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((d, di) => {
              if (!d) return <div key={di} style={{ width: cellPx, height: cellPx }} />
              const count = completionsByDate[d] ?? 0
              const intensity = count > 0 ? Math.min(count / max, 1) : 0
              return (
                <div
                  key={d}
                  className="rounded-[2px]"
                  title={`${d}: ${count} completed`}
                  style={{
                    width: cellPx, height: cellPx,
                    backgroundColor: count > 0 ? `rgba(59,130,246,${0.15 + intensity * 0.85})` : 'rgba(255,255,255,0.05)',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Dual line chart (mood vs productivity) ────────────────────────────────────

function DualLineChart({ dates, seriesA, seriesB, labelA, labelB, colorA, colorB }: {
  dates: string[]
  seriesA: number[]
  seriesB: number[]
  labelA: string
  labelB: string
  colorA: string
  colorB: string
}) {
  const W = 320
  const H = 80
  const PAD = { top: 8, right: 8, bottom: 20, left: 8 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const normalize = (arr: number[]) => {
    const mx = Math.max(...arr, 1)
    return arr.map(v => v / mx)
  }
  const nA = normalize(seriesA)
  const nB = normalize(seriesB)

  const points = (vals: number[]) =>
    vals.map((v, i) => {
      const x = PAD.left + (i / Math.max(vals.length - 1, 1)) * plotW
      const y = PAD.top + (1 - v) * plotH
      return `${x},${y}`
    }).join(' ')

  const labelStep = Math.ceil(dates.length / 6)
  const labelDates = dates.filter((_, i) => i % labelStep === 0)

  return (
    <div>
      <div className="flex gap-4 mb-2">
        <span className="text-[10px] flex items-center gap-1" style={{ color: colorA }}>
          <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: colorA }} />
          {labelA}
        </span>
        <span className="text-[10px] flex items-center gap-1" style={{ color: colorB }}>
          <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: colorB }} />
          {labelB}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
          <polyline points={points(nA)} fill="none" stroke={colorA} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          <polyline points={points(nB)} fill="none" stroke={colorB} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          {labelDates.map(d => {
            const i = dates.indexOf(d)
            const x = PAD.left + (i / Math.max(dates.length - 1, 1)) * plotW
            return (
              <text key={d} x={x} y={H - 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">
                {d.slice(5)}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Metric card wrapper ───────────────────────────────────────────────────────

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{title}</p>
      {children}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const [period, setPeriod] = useState<Period>('month')

  const { cycles, habits, habitLogsByDate, diaryEntries } = data

  const periodDays = PERIOD_DAYS[period]

  const dates = useMemo(() => datesInRange(periodDays), [periodDays])
  const dateSet = useMemo(() => new Set(dates), [dates])
  const prevDates = useMemo(() => prevRangeDates(periodDays), [periodDays])
  const prevDateSet = useMemo(() => new Set(prevDates), [prevDates])

  // ── Filtered cycles ──────────────────────────────────────────────────────

  const completedInPeriod = useMemo(
    () => cycles.filter(c => dateSet.has(c.lastCompletedAt.slice(0, 10))),
    [cycles, dateSet]
  )
  const completedInPrev = useMemo(
    () => cycles.filter(c => prevDateSet.has(c.lastCompletedAt.slice(0, 10))),
    [cycles, prevDateSet]
  )

  const adHocCompleted = useMemo(
    () => completedInPeriod.filter(c => !isRecurring(c.triggerLabel ?? undefined)),
    [completedInPeriod]
  )

  // ── Completion rate (count + trend) ──────────────────────────────────────

  const completionCount = completedInPeriod.length
  const prevCount = completedInPrev.length
  const completionTrend = useMemo((): { dir: 'up' | 'down' | 'same'; pct: number } => {
    if (prevCount === 0) return { dir: 'same', pct: 0 }
    const pct = Math.round(Math.abs((completionCount - prevCount) / prevCount) * 100)
    return { dir: completionCount > prevCount ? 'up' : completionCount < prevCount ? 'down' : 'same', pct }
  }, [completionCount, prevCount])

  // ── Efficiency score ──────────────────────────────────────────────────────

  const efficiencyScore = useMemo(() => {
    // On-time rate: cycles with date trigger completed <= due date
    const withDueDate = completedInPeriod.filter(c => c.triggerLabel && /^\d{4}-\d{2}-\d{2}$/.test(c.triggerLabel))
    const onTime = withDueDate.filter(c => c.lastCompletedAt.slice(0, 10) <= c.triggerLabel!)
    const onTimeRate = withDueDate.length > 0 ? onTime.length / withDueDate.length : 0.5

    // Habit consistency: avg days goal met / days in period
    const habitRates = habits.map(h => {
      let met = 0
      dates.forEach(d => {
        const key = `${h.mode}-${d}`
        const logs = habitLogsByDate[key] ?? {}
        if ((logs[h.id] ?? 0) >= h.goal) met++
      })
      return met / dates.length
    })
    const habitConsistency = habitRates.length > 0 ? habitRates.reduce((a, b) => a + b, 0) / habitRates.length : 0.5

    return Math.round((onTimeRate * 60 + habitConsistency * 40))
  }, [completedInPeriod, habits, habitLogsByDate, dates])

  // ── Activity heatmap ──────────────────────────────────────────────────────

  const completionsByDate = useMemo(() => {
    const map: Record<string, number> = {}
    completedInPeriod.forEach(c => {
      const d = c.lastCompletedAt.slice(0, 10)
      map[d] = (map[d] ?? 0) + 1
    })
    return map
  }, [completedInPeriod])

  // ── Grouped bar chart (tasks completed over time) ─────────────────────────

  const tasksOverTime = useMemo(() => {
    if (period === 'week') {
      const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      return dates.map(d => {
        const dow = (new Date(d + 'T00:00:00').getDay() + 6) % 7
        return { label: DAY_SHORT[dow], value: completionsByDate[d] ?? 0 }
      })
    }
    if (period === 'month') {
      // group into 6 buckets of 5 days
      const buckets: { label: string; value: number }[] = []
      for (let i = 0; i < dates.length; i += 5) {
        const slice = dates.slice(i, i + 5)
        const val = slice.reduce((s, d) => s + (completionsByDate[d] ?? 0), 0)
        buckets.push({ label: slice[0].slice(5), value: val })
      }
      return buckets
    }
    // Year: group by month
    const byMonth: Record<string, number> = {}
    dates.forEach(d => {
      const month = d.slice(0, 7)
      byMonth[month] = (byMonth[month] ?? 0) + (completionsByDate[d] ?? 0)
    })
    return Object.entries(byMonth).map(([m, v]) => ({
      label: new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' }),
      value: v,
    }))
  }, [period, dates, completionsByDate])

  // ── Most productive day of week ───────────────────────────────────────────

  const productiveByDow = useMemo(() => {
    const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const counts = Array(7).fill(0)
    completedInPeriod.forEach(c => {
      const dow = (new Date(c.lastCompletedAt.slice(0, 10) + 'T00:00:00').getDay() + 6) % 7
      counts[dow]++
    })
    return DAY_SHORT.map((label, i) => ({ label, value: counts[i] }))
  }, [completedInPeriod])

  // ── Most productive week of month ─────────────────────────────────────────

  const productiveByWeek = useMemo(() => {
    const labels = ['Wk 1\n1–7', 'Wk 2\n8–14', 'Wk 3\n15–21', 'Wk 4\n22+']
    const counts = [0, 0, 0, 0]
    completedInPeriod.forEach(c => {
      const day = parseInt(c.lastCompletedAt.slice(8, 10), 10)
      const bucket = Math.min(Math.floor((day - 1) / 7), 3)
      counts[bucket]++
    })
    return labels.map((label, i) => ({ label: label.split('\n')[0], value: counts[i] }))
  }, [completedInPeriod])

  // ── Avg completion time ───────────────────────────────────────────────────

  const completionTime = useMemo(() => {
    const withBoth = completedInPeriod.filter(c => c.createdAt)
    const creationLags = withBoth.map(c => daysBetween(c.createdAt.slice(0, 10), c.lastCompletedAt.slice(0, 10)))
    const avgCreationLag = creationLags.length > 0 ? Math.round(creationLags.reduce((a, b) => a + b, 0) / creationLags.length) : 0

    const withDueDate = completedInPeriod.filter(c => c.triggerLabel && /^\d{4}-\d{2}-\d{2}$/.test(c.triggerLabel))
    const deltas = withDueDate.map(c => daysBetween(c.triggerLabel!, c.lastCompletedAt.slice(0, 10)))
    const avgDelta = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null

    return { avgCreationLag, avgDelta, sampleSize: withDueDate.length }
  }, [completedInPeriod])

  // ── Mood vs productivity ──────────────────────────────────────────────────

  const moodData = useMemo(() => {
    const moodByDate: Record<string, number> = {}
    diaryEntries.forEach(e => { moodByDate[e.date] = MOOD_SCORE[e.mood] ?? 0 })
    const moodDates = dates.filter(d => moodByDate[d] > 0 || (completionsByDate[d] ?? 0) > 0)
    const moods = moodDates.map(d => moodByDate[d] ?? 0)
    const completions = moodDates.map(d => completionsByDate[d] ?? 0)
    return { dates: moodDates, moods, completions, hasData: moodDates.some(d => moodByDate[d] > 0) }
  }, [dates, diaryEntries, completionsByDate])

  // ── Habit consistency ─────────────────────────────────────────────────────

  const habitStats = useMemo(() => {
    return habits.map(h => {
      let met = 0
      dates.forEach(d => {
        const key = `${h.mode}-${d}`
        const logs = habitLogsByDate[key] ?? {}
        if ((logs[h.id] ?? 0) >= h.goal) met++
      })
      return { ...h, consistency: Math.round((met / dates.length) * 100), daysHit: met }
    }).sort((a, b) => b.consistency - a.consistency)
  }, [habits, habitLogsByDate, dates])

  // ── Render ─────────────────────────────────────────────────────────────────

  const periodLabel = { week: 'Last 7 days', month: 'Last 30 days', year: 'Last 365 days' }[period]
  const efficiencyColor = efficiencyScore >= 75 ? '#4ade80' : efficiencyScore >= 50 ? '#fbbf24' : '#f87171'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 pt-5 pb-10 space-y-5 max-w-3xl mx-auto">

        {/* Header */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Analytics</p>
          <h2 className="text-xl font-bold text-white mt-1">Your Productivity</h2>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {(['week', 'month', 'year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize"
              style={period === p
                ? { background: '#3b82f6', color: '#fff' }
                : { color: 'rgba(255,255,255,0.45)' }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Completed"
            value={completionCount}
            sub={periodLabel}
            accent="#3b82f6"
            trend={completionTrend}
          />
          <StatCard
            label="Efficiency"
            value={`${efficiencyScore}%`}
            sub="on-time + habits"
            accent={efficiencyColor}
          />
        </div>

        {/* Heatmap */}
        <MetricCard title={`Activity — ${periodLabel}`}>
          <Heatmap completionsByDate={completionsByDate} dates={dates} />
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {completionCount} completions · darker = more done
          </p>
        </MetricCard>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Tasks over time */}
          <MetricCard title="Completions over time">
            <BarChart data={tasksOverTime} color="#3b82f6" showValues barHeight={80} />
          </MetricCard>

          {/* Productive day of week */}
          <MetricCard title="Most productive day">
            <BarChart data={productiveByDow} color="#818cf8" barHeight={80} showValues />
            {productiveByDow.length > 0 && (() => {
              const best = productiveByDow.reduce((a, b) => b.value > a.value ? b : a)
              return best.value > 0 ? (
                <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  You complete most on <span className="text-white/70 font-semibold">{best.label}</span>
                </p>
              ) : null
            })()}
          </MetricCard>

          {/* Productive week of month */}
          <MetricCard title="Most productive week of month">
            <BarChart data={productiveByWeek} color="#a78bfa" barHeight={80} showValues />
            {productiveByWeek.length > 0 && (() => {
              const best = productiveByWeek.reduce((a, b) => b.value > a.value ? b : a)
              return best.value > 0 ? (
                <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Busiest around <span className="text-white/70 font-semibold">{best.label}</span>
                </p>
              ) : null
            })()}
          </MetricCard>

          {/* Avg completion time */}
          <MetricCard title="Task completion time">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Avg time from creation to done</p>
                <p className="text-2xl font-bold" style={{ color: '#38bdf8' }}>
                  {completionTime.avgCreationLag}
                  <span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>days</span>
                </p>
              </div>
              {completionTime.avgDelta !== null && (
                <div>
                  <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>On-time performance (+ = late)</p>
                  <p className="text-2xl font-bold" style={{ color: completionTime.avgDelta <= 0 ? '#4ade80' : '#f87171' }}>
                    {completionTime.avgDelta > 0 ? '+' : ''}{completionTime.avgDelta}
                    <span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>days vs due</span>
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    based on {completionTime.sampleSize} cycle{completionTime.sampleSize !== 1 ? 's' : ''} with due dates
                  </p>
                </div>
              )}
            </div>
          </MetricCard>

        </div>

        {/* Mood vs productivity — full width */}
        {moodData.hasData && moodData.dates.length > 2 && (
          <MetricCard title="Mood vs productivity">
            <DualLineChart
              dates={moodData.dates}
              seriesA={moodData.moods}
              seriesB={moodData.completions}
              labelA="Mood"
              labelB="Completions"
              colorA="#f0a8c8"
              colorB="#3b82f6"
            />
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Both lines normalised to 0–1 scale so they can be compared
            </p>
          </MetricCard>
        )}

        {/* Habit consistency — full width */}
        {habitStats.length > 0 && (
          <MetricCard title="Habit consistency">
            <div className="space-y-3">
              {habitStats.map(h => (
                <div key={h.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <span>{h.emoji}</span>
                      <span>{h.name}</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        ({h.mode === 'work' ? '💼' : '🏠'})
                      </span>
                    </span>
                    <span className="text-[12px] font-bold" style={{ color: h.consistency >= 75 ? '#4ade80' : h.consistency >= 50 ? '#fbbf24' : '#f87171' }}>
                      {h.consistency}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${h.consistency}%`,
                        backgroundColor: h.consistency >= 75 ? '#4ade80' : h.consistency >= 50 ? '#fbbf24' : '#f87171',
                      }}
                    />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {h.daysHit} of {dates.length} days hit goal
                  </p>
                </div>
              ))}
            </div>
          </MetricCard>
        )}

        {/* Ad-hoc insight */}
        {adHocCompleted.length > 0 && (
          <MetricCard title="One-off tasks completed">
            <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>
              {adHocCompleted.length}
              <span className="text-sm font-normal ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>non-recurring</span>
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {Math.round((adHocCompleted.length / Math.max(completionCount, 1)) * 100)}% of all completions this period
            </p>
          </MetricCard>
        )}

      </div>
    </div>
  )
}
