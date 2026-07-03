'use client'

import { useMemo } from 'react'
import { Minus } from 'lucide-react'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { useHabits, getHabitCount, type WorkHabit, type HabitLog } from '@/shared/lib/habit-context'
import { isTriggerDueToday, isRecurring, hasTriggerFiredThisPeriod, allCycleDone } from '@/shared/lib/sort-utils'
import { useSearch } from '@/shared/lib/search-context'
import { fuzzyMatch } from '@/shared/lib/search-utils'
import { CycleCard } from '@/shared/components/CycleCard'
import type { Cycle } from '@/shared/types'

const PINK = '#f0a8c8'

// ── Habit helpers ─────────────────────────────────────────────────────────────

function isScheduledToday(habit: WorkHabit, dow: number): boolean {
  const f = habit.frequency
  if (!f || f.type === 'daily')            return true
  if (f.type === 'weekdays')               return dow >= 1 && dow <= 5
  if (f.type === 'days')                   return f.days.includes(dow)
  if (f.type === 'times_per_week')         return true  // show every day, track weekly
  if (f.type === 'times_per_month')        return true  // show every day, track monthly
  return true
}

// ── Personal habit strip for Today ───────────────────────────────────────────

function PersonalHabitStrip() {
  const { habits, todayLogs, weekLogs, logHabit, unlogHabit } = useHabits()

  const today = new Date()
  const dow   = today.getDay()

  const todayHabits = [...habits]
    .filter(h => isScheduledToday(h, dow))
    .sort((a, b) => a.order - b.order)

  if (todayHabits.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {todayHabits.map(habit => {
        const { count, suffix } = getHabitCount(habit, todayLogs, weekLogs, today)
        const done = count >= habit.goal
        return (
          <div
            key={habit.id}
            onClick={() => logHabit(habit.id)}
            className="flex-shrink-0 flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-xl border transition-all cursor-pointer active:scale-95"
            style={done
              ? { borderColor: '#22c55e4d', backgroundColor: '#22c55e14' }
              : { borderColor: `${PINK}33`, backgroundColor: `${PINK}0d` }
            }
          >
            <span className="text-base leading-none">{habit.emoji}</span>
            <span className="text-[11px] font-medium tabular-nums" style={{ color: done ? '#4ade80' : PINK }}>
              {count}/{habit.goal}{suffix ? ` ${suffix}` : ''}
            </span>
            <button
              onClick={e => { e.stopPropagation(); logHabit(habit.id) }}
              className="text-[10px] px-1.5 py-0.5 rounded-lg font-semibold transition-all"
              style={{ color: done ? '#4ade8099' : PINK }}
            >
              +
            </button>
            {count > 0 && (
              <button
                onClick={e => { e.stopPropagation(); unlogHabit(habit.id) }}
                className="text-white/20 hover:text-white/45 transition-colors pr-0.5"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PersonalTodayView() {
  const { houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles } = usePersonalData()
  const { query } = useSearch()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const allCycles = useMemo(
    () => [...houseworkCycles, ...personalFinanceCycles, ...sidoiCycles, ...tobuyCycles] as Cycle[],
    [houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles]
  )

  const dueToday = useMemo(() => {
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return allCycles
      .filter(c => {
        if (c.status === 'complete') return false
        if (allCycleDone(c)) return false
        const trigger = c.triggerLabel ?? ''
        if (c.nextDueAt) {
          if (isRecurring(trigger)) {
            const [ndy, ndm, ndd] = c.nextDueAt.split('-').map(Number)
            const nextDue = new Date(ndy, ndm - 1, ndd)
            if (nextDue > todayDate) return false
          } else {
            return false
          }
        }
        const allItems = c.items
          ? c.items.flatMap(i => [i, ...(i.subItems ?? [])])
          : (c.phases ?? []).flatMap(p => p.items.flatMap(i => [i, ...(i.subItems ?? [])]))
        const hasItems    = allItems.length > 0
        const allHaveDue  = hasItems && allItems.every(i => !!i.due)
        const noneHaveDue = !hasItems || allItems.every(i => !i.due)

        if (allHaveDue) return allItems.some(i => i.status !== 'done' && i.due! <= todayStr)

        const hasStarted = allItems.some(i => i.status === 'done')
        const isStickyActive = c.must && isRecurring(trigger) && !c.nextDueAt &&
          hasStarted && hasTriggerFiredThisPeriod(trigger, todayDate)

        if (noneHaveDue) return isTriggerDueToday(trigger, todayDate) || isStickyActive
        return isTriggerDueToday(trigger, todayDate) ||
          allItems.some(i => i.status !== 'done' && !!i.due && i.due <= todayStr) ||
          isStickyActive
      })
      .filter(c => !query.trim() || fuzzyMatch(c.title, query))
      .sort((a, b) => {
        const aRec = isRecurring(a.triggerLabel) ? 1 : 0
        const bRec = isRecurring(b.triggerLabel) ? 1 : 0
        if (aRec !== bRec) return aRec - bRec
        const score = (c: Cycle) => (c.must ? 2 : 0) + ((c.urgent ?? false) ? 1 : 0)
        return score(b) - score(a)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCycles, todayStr, query])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-8 space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {today.toLocaleDateString('en-HK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h2 className="text-xl font-bold text-white mt-1">Today</h2>
          </div>
          <PersonalHabitStrip />
        </div>

        {/* Due Today */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Due Today
            </h3>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {dueToday.length} {dueToday.length === 1 ? 'cycle' : 'cycles'}
            </span>
          </div>
          {dueToday.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Nothing due today — enjoy your day 🌿
            </div>
          ) : (
            <div className="space-y-3">
              {dueToday.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
