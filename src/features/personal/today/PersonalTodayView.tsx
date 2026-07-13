'use client'

import { useMemo, useState } from 'react'
import { Minus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { useHabits, getHabitCount, type WorkHabit } from '@/shared/lib/habit-context'
import { isTriggerDueToday, isRecurring, hasTriggerFiredThisPeriod, allCycleDone } from '@/shared/lib/sort-utils'
import { useSearch } from '@/shared/lib/search-context'
import { fuzzyMatch } from '@/shared/lib/search-utils'
import { CycleCard } from '@/shared/components/CycleCard'
import { CycleDetailSheet } from '@/shared/components/CycleDetailSheet'
import type { Cycle } from '@/shared/types'

const PINK = '#f0a8c8'

const AREA_META = [
  { key: 'housework',        label: 'Housework', color: '#fb7185', href: '/personal/housework' },
  { key: 'personal-finance', label: 'Finance',   color: '#22d3ee', href: '/personal/finance'   },
  { key: 'sidoi',            label: 'Sidoi',     color: '#f9a8d4', href: '/personal/sidoi'     },
  { key: 'tobuy',            label: 'To Buy',    color: '#fcd34d', href: '/personal/tobuy'     },
] as const

// ── Habit helpers ─────────────────────────────────────────────────────────────

function isScheduledToday(habit: WorkHabit, dow: number): boolean {
  const f = habit.frequency
  if (!f || f.type === 'daily')        return true
  if (f.type === 'weekdays')           return dow >= 1 && dow <= 5
  if (f.type === 'days')               return f.days.includes(dow)
  if (f.type === 'times_per_week')     return true
  if (f.type === 'times_per_month')    return true
  return true
}

// ── Coming Up helpers ─────────────────────────────────────────────────────────

function getCycleNextDateStr(c: Cycle, todayStr: string): string | null {
  if (c.nextDueAt && c.nextDueAt > todayStr) return c.nextDueAt
  const trigger = c.triggerLabel ?? ''
  if (!isRecurring(trigger) && /^\d{4}-\d{2}-\d{2}$/.test(trigger) && trigger > todayStr) {
    return trigger
  }
  return null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDateBadge(dateStr: string): { day: string; num: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return { day: DAYS[dt.getDay()], num: String(d) }
}

function fmtChipDate(dateStr: string, todayStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const base = new Date(todayStr + 'T00:00:00')
  const diff = Math.round((dt.getTime() - base.getTime()) / 86400000)
  if (diff === 1) return 'Tomorrow'
  if (diff <= 6)  return `${DAYS[dt.getDay()]} · ${d} ${MONTHS[m - 1]}`
  return `${d} ${MONTHS[m - 1]}`
}

// ── Personal habit strip ──────────────────────────────────────────────────────

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
  const router = useRouter()
  const [sheetCycle, setSheetCycle] = useState<Cycle | null>(null)

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

  const comingUpCycles = useMemo(() => {
    const dueTodayIds = new Set(dueToday.map(c => c.id))
    return allCycles
      .filter(c => {
        if (c.status === 'complete') return false
        if (allCycleDone(c)) return false
        if (dueTodayIds.has(c.id)) return false
        return getCycleNextDateStr(c, todayStr) !== null
      })
      .sort((a, b) => {
        const da = getCycleNextDateStr(a, todayStr)!
        const db = getCycleNextDateStr(b, todayStr)!
        return da.localeCompare(db)
      })
      .slice(0, 5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCycles, dueToday, todayStr])

  const areaSnapshot = useMemo(() =>
    AREA_META.map(area => {
      const next = comingUpCycles.find(c => c.area === area.key) ?? null
      return { ...area, next, nextDateStr: next ? getCycleNextDateStr(next, todayStr) : null }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [comingUpCycles, todayStr])

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

        {/* Coming Up */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Coming Up
            </h3>
          </div>

          {/* Area snapshot chips 2×2 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {areaSnapshot.map(area => (
              <button
                key={area.key}
                onClick={() => router.push(area.href)}
                className="text-left rounded-[10px] active:scale-[0.98] transition-transform"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  padding: '9px 10px 9px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', inset: '0 auto 0 0',
                  width: '3.5px', background: area.color,
                  borderRadius: '10px 0 0 10px',
                }} />
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: `${area.color}99`, marginBottom: '4px' }}>
                  {area.label}
                </div>
                {area.next && area.nextDateStr ? (
                  <>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                      {area.next.title}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.28)' }}>
                      {fmtChipDate(area.nextDateStr, todayStr)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                    Nothing due
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Upcoming list */}
          {comingUpCycles.length > 0 && (
            <div>
              {comingUpCycles.map((c, i) => {
                const dateStr = getCycleNextDateStr(c, todayStr)!
                const { day, num } = fmtDateBadge(dateStr)
                const areaMeta = AREA_META.find(a => a.key === c.area)
                return (
                  <button
                    key={c.id}
                    onClick={() => setSheetCycle(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '11px',
                      padding: '9px 0',
                      borderBottom: i < comingUpCycles.length - 1 ? '1px solid rgba(255,255,255,0.045)' : 'none',
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '32px', flexShrink: 0, textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.24)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{day}</div>
                      <div style={{ fontSize: '17px', fontWeight: 600, color: 'rgba(255,255,255,0.44)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{num}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.76)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.25)', marginTop: '1.5px' }}>
                        {areaMeta?.label ?? c.area}
                      </div>
                    </div>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: areaMeta?.color ?? 'rgba(255,255,255,0.3)' }} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>

      <CycleDetailSheet
        cycle={sheetCycle ? (allCycles.find(c => c.id === sheetCycle.id) ?? sheetCycle) : null}
        onClose={() => setSheetCycle(null)}
      />
    </div>
  )
}
