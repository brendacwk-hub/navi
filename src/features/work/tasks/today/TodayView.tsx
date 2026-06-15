'use client'

import { useState, useMemo } from 'react'
import { Zap, ChevronDown, Clock, ChevronRight, FileText, Pencil, X, Minus } from 'lucide-react'
import { useSearch } from '@/shared/lib/search-context'
import { useWorkData } from '@/shared/lib/work-data-context'
import { useInbox } from '@/shared/lib/inbox-context'
import { useToast } from '@/shared/lib/toast-context'
import { useHabits } from '@/shared/lib/habit-context'
import { fuzzyMatch } from '@/shared/lib/search-utils'
import { isTriggerDueToday, allCycleDone, isRecurring, computeSortDate } from '@/shared/lib/sort-utils'
import { CycleCard } from '@/shared/components/CycleCard'
import type { Cycle } from '@/shared/types'
import type { TodayTaskData } from './data'

const areaColor = {
  finance: 'border-l-finance bg-finance/5 border-finance/20',
  hr:      'border-l-hr      bg-hr/5      border-hr/20',
  ops:     'border-l-ops     bg-ops/5     border-ops/20',
  others:  'border-l-others  bg-others/5  border-others/20',
}

const areaAccent: Record<string, string> = {
  finance: 'text-finance', hr: 'text-hr', ops: 'text-ops', others: 'text-others',
}

const effortLabel: Record<string, string> = { quick: 'Quick', medium: 'Medium', heavy: 'Heavy' }
const effortDot: Record<string, string> = {
  quick: 'bg-green-500', medium: 'bg-yellow-500', heavy: 'bg-orange-500'
}

// ── Inline editable label ─────────────────────────────────────────────────────
function EditableText({
  value, onSave, className, showIcon = true,
}: {
  value: string; onSave: (v: string) => void; className?: string; showIcon?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const v = draft.trim()
    if (v) onSave(v)
    else setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
        className="flex-1 text-sm bg-white/8 border border-navi-blue/50 rounded px-2 py-0.5 text-white focus:outline-none"
      />
    )
  }

  if (!showIcon) {
    return (
      <span
        className={`cursor-pointer ${className ?? ''}`}
        onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true) }}
      >
        {value}
      </span>
    )
  }

  return (
    <span className={`group/et flex items-center gap-1.5 ${className ?? ''}`}>
      {value}
      <button
        onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true) }}
        className="opacity-20 group-hover/et:opacity-70 hover:!opacity-100 p-0.5 rounded text-white/50 hover:text-white/80 transition-all flex-shrink-0"
        title="Edit"
      >
        <Pencil className="w-2.5 h-2.5" />
      </button>
    </span>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TodayTaskCard({ task }: { task: TodayTaskData }) {
  const [expanded, setExpanded] = useState(true)
  const [editingTags, setEditingTags] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { showToast } = useToast()

  const {
    toggleTodayTask, deleteTodayTask, toggleTodaySubItem, deleteTodaySubItem,
    updateTodayTaskLabel, updateTodaySubItemLabel, setTodayTaskTags, toggleTodaySubItemUrgent,
  } = useWorkData()

  const subItems = task.subItems ?? []
  const doneCount = subItems.filter(s => s.done).length
  const allDone = subItems.length > 0 ? doneCount === subItems.length : task.done

  return (
    <div className={`rounded-xl border border-l-4 overflow-hidden transition-all group/task ${areaColor[task.area]}`}>
      <div className="px-4 py-3 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2">
          {subItems.length > 0 ? (
            <span className={`flex-shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${
              allDone ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-white/40'
            }`}>
              {doneCount}/{subItems.length}
            </span>
          ) : (
            <div
              className={`flex-shrink-0 w-4 h-4 rounded border cursor-pointer flex items-center justify-center ${
                task.done ? 'bg-white/40 border-white/40' : 'border-white/25'
              }`}
              onClick={e => { e.stopPropagation(); toggleTodayTask(task.id) }}
            >
              {task.done && (
                <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
          )}
          <div className={`flex-1 min-w-0 text-sm font-bold ${allDone ? 'line-through text-white/35' : 'text-white/85'}`}>
            <EditableText value={task.label} onSave={v => updateTodayTaskLabel(task.id, v)} showIcon={false} />
          </div>
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            className="opacity-30 sm:opacity-0 sm:group-hover/task:opacity-60 hover:!opacity-100 p-0.5 rounded text-white/35 hover:text-red-400 transition-all flex-shrink-0"
            title="Delete task"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <ChevronDown className={`flex-shrink-0 w-3.5 h-3.5 text-white/25 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </div>

        <div className="flex items-center gap-2 mt-1.5 ml-0.5">
          {task.urgent && <span className="text-[10px] text-orange-400 font-bold">⚠</span>}
          {task.must && (
            <span className="text-[10px] text-red-400 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Must
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
            <span className={`w-1.5 h-1.5 rounded-full ${effortDot[task.effort] ?? 'bg-white/30'}`} />
            {effortLabel[task.effort]}
          </span>
          <span className="text-[11px] text-white/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {task.due}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setEditingTags(t => !t) }}
            className="opacity-20 hover:opacity-70 p-0.5 rounded text-white/50 hover:text-white/80 transition-all ml-auto"
            title="Edit tags"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        {editingTags && (
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={e => { e.stopPropagation(); setTodayTaskTags(task.id, !task.must, task.urgent ?? false) }}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                task.must ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'
              }`}
            >
              {task.must ? '● Must (on)' : '○ Must'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setTodayTaskTags(task.id, task.must, !(task.urgent ?? false)) }}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                task.urgent ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'
              }`}
            >
              {task.urgent ? '⚠ Urgent (on)' : '○ Urgent'}
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-white/8 px-4 py-3 space-y-2">
          {task.notes && (
            <p className="text-xs text-white/50 flex items-start gap-2">
              <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {task.notes}
            </p>
          )}
          {subItems.length > 0 && (
            <div className="space-y-[3.5px]">
              {subItems.map(sub => (
                <div key={sub.id} className="group/sub flex items-center gap-2 py-[3.6px] pl-1">
                  <div
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 cursor-pointer ${sub.done ? 'bg-white/40 border-white/40' : 'border-white/25'}`}
                    onClick={() => toggleTodaySubItem(task.id, sub.id)}
                  >
                    {sub.done && (
                      <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 text-[11.6px] ${sub.done ? 'line-through text-white/25' : 'text-white/60'}`}>
                    <EditableText value={sub.label} onSave={v => updateTodaySubItemLabel(task.id, sub.id, v)} />
                  </div>
                  {/* Urgent toggle */}
                  <button
                    onClick={() => toggleTodaySubItemUrgent(task.id, sub.id)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-all flex-shrink-0 ${
                      sub.urgent
                        ? 'opacity-100 bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : 'opacity-0 group-hover/sub:opacity-60 hover:!opacity-100 border-white/15 text-white/35'
                    }`}
                    title={sub.urgent ? 'Remove urgent' : 'Mark urgent'}
                  >
                    ⚠
                  </button>
                  {/* Delete sub-item */}
                  <button
                    onClick={() => deleteTodaySubItem(task.id, sub.id)}
                    className="opacity-0 group-hover/sub:opacity-40 hover:!opacity-100 p-0.5 rounded text-white/35 hover:text-red-400 transition-all flex-shrink-0"
                    title="Delete step"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmDelete(false)}>
          <div
            className="bg-[#1e1e1e] border border-white/12 rounded-2xl shadow-2xl w-80 p-6"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-white mb-1">Delete task?</p>
            <p className="text-xs text-white/45 mb-5 leading-relaxed">
              &ldquo;{task.label}&rdquo; will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-4 py-2 rounded-lg text-white/45 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteTodayTask(task.id); setConfirmDelete(false); showToast(`"${task.label}" deleted`) }}
                className="text-xs px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── "Coming up" — first cycle with todo items, when today list is empty ───────
function ComingUpSection({ cycles }: { cycles: Cycle[] }) {
  const upcoming = cycles
    .filter(c => c.status === 'active')
    .map(c => {
      const allItems = c.items
        ? c.items.flatMap(i => [i, ...(i.subItems ?? [])])
        : (c.phases ?? []).flatMap(p => p.items.flatMap(i => [i, ...(i.subItems ?? [])]))
      const pending = allItems.filter(i => i.status !== 'done')
      return { cycle: c, pending }
    })
    .filter(x => x.pending.length > 0)
    .sort((a, b) => {
      const score = (c: Cycle) => (c.must ? 2 : 0) + (c.urgent ? 1 : 0)
      return score(b.cycle) - score(a.cycle)
    })

  if (upcoming.length === 0) return null

  const { cycle, pending } = upcoming[0]
  const preview = pending.slice(0, 3)

  return (
    <div>
      <h3 className="text-[11px] font-semibold text-white/45 uppercase tracking-widest mb-3">Coming Up</h3>
      <div className={`rounded-xl border border-l-4 overflow-hidden ${areaColor[cycle.area as keyof typeof areaColor] ?? 'border-l-white/20 bg-white/3 border-white/10'}`}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {cycle.must && <Zap className={`w-3 h-3 flex-shrink-0 ${areaAccent[cycle.area] ?? 'text-white/40'}`} />}
            <span className="text-sm font-bold text-white/75 truncate">{cycle.title}</span>
            <span className={`ml-auto text-[10px] font-semibold ${areaAccent[cycle.area] ?? 'text-white/35'}`}>
              {cycle.area.charAt(0).toUpperCase() + cycle.area.slice(1)}
            </span>
          </div>
          <div className="space-y-1.5 pl-1">
            {preview.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-[11.5px] text-white/45">
                <span className="w-1 h-1 rounded-full bg-white/25 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
            {pending.length > 3 && (
              <p className="text-[10px] text-white/25 pl-3">+{pending.length - 3} more items</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Monthly chain ─────────────────────────────────────────────────────────────
// Computed dynamically from actual Finance + HR recurring cycles


// ── Main view ─────────────────────────────────────────────────────────────────
function HabitStrip() {
  const { habits, todayLogs, isWorkday, logHabit, unlogHabit } = useHabits()
  if (!isWorkday || habits.length === 0) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[...habits].sort((a, b) => a.order - b.order).map(habit => {
        const count = todayLogs[habit.id] ?? 0
        const done = count >= habit.goal
        return (
          <div key={habit.id}
            onClick={() => logHabit(habit.id)}
            className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
              done
                ? 'border-green-500/30 bg-green-500/8'
                : 'border-white/10 bg-white/4'
            }`}
          >
            <span className="text-base leading-none">{habit.emoji}</span>
            <span className={`text-[11px] font-medium tabular-nums ${done ? 'text-green-400' : 'text-white/55'}`}>
              {count}/{habit.goal}
            </span>
            <button
              onClick={e => { e.stopPropagation(); logHabit(habit.id) }}
              className={`text-[10px] px-1.5 py-0.5 rounded-lg font-semibold transition-all ${
                done
                  ? 'text-green-400/60 hover:bg-green-500/15'
                  : 'text-navi-blue hover:bg-navi-blue/15'
              }`}
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

export function TodayView() {
  const { query } = useSearch()
  const { todayTasks, todayLoaded, financeCycles, hrCycles, opsCycles, othersCycles } = useWorkData()
  const { items: inboxItems } = useInbox()

  const today = new Date()
  const dayOfMonth = today.getDate()
  const showChain = dayOfMonth >= 17 || dayOfMonth <= 5

  // Dynamic monthly chain from actual Finance + HR recurring cycles
  // Exclude pure weekday patterns (Every Monday etc.) — those are weekly, not monthly close
  const chainItems = useMemo(() => {
    const weekdayPattern = /^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i
    return [...financeCycles, ...hrCycles]
      .filter(c => {
        if (!isRecurring(c.triggerLabel)) return false
        if (weekdayPattern.test((c.triggerLabel ?? '').trim())) return false
        return true
      })
      .sort((a, b) => computeSortDate(a.triggerLabel) - computeSortDate(b.triggerLabel))
      .map(c => ({
        id: c.id,
        label: c.title.split(/\s+/).slice(0, 2).join(' '),
        done: !!c.nextDueAt || c.status === 'complete' || allCycleDone(c),
        active: isTriggerDueToday(c.triggerLabel, today),
      }))
  }, [financeCycles, hrCycles]) // eslint-disable-line react-hooks/exhaustive-deps

  // YYYY-MM-DD in local time for overdue comparison
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const visibleTasks = todayTasks
    .filter(t => {
      if (!query.trim()) return true
      return fuzzyMatch(t.label, query) || (t.subItems ?? []).some(s => fuzzyMatch(s.label, query))
    })
    .sort((a, b) => {
      // plain tasks first, then tasks with sub-items
      const aHas = (a.subItems?.length ?? 0) > 0 ? 1 : 0
      const bHas = (b.subItems?.length ?? 0) > 0 ? 1 : 0
      return aHas - bHas
    })

  // Cycles from all areas that are due today (including recurring patterns)
  const cyclesToday = useMemo(() => {
    const todayDate = new Date(todayStr + 'T00:00:00')
    const all = [...financeCycles, ...hrCycles, ...opsCycles, ...othersCycles]
    return all
      .filter(c => {
        if (c.nextDueAt) {
          if (isRecurring(c.triggerLabel)) {
            // Recurring: hide until nextDueAt arrives, then resurface on matching trigger day
            const nextDue = new Date(c.nextDueAt + 'T00:00:00')
            if (nextDue > todayDate) return false
            // nextDueAt has passed — fall through to isTriggerDueToday below
          } else {
            return false  // one-off: permanently hidden once nextDueAt set
          }
        }
        if (c.status === 'complete') return false
        if (allCycleDone(c)) return false
        return isTriggerDueToday(c.triggerLabel, todayDate)
      })
      .filter(c => !query.trim() || fuzzyMatch(c.title, query))
      .sort((a, b) => {
        const score = (c: Cycle) => (c.must ? 2 : 0) + (c.urgent ? 1 : 0)
        return score(b) - score(a)
      })
  }, [financeCycles, hrCycles, opsCycles, othersCycles, todayStr, query])

  const allCycles = [...financeCycles, ...hrCycles, ...opsCycles, ...othersCycles]
  const totalDueToday = visibleTasks.length + cyclesToday.length

  if (!todayLoaded) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-8 space-y-6">
          <div>
            <div className="h-3 w-36 bg-white/8 rounded animate-pulse mb-2" />
            <div className="h-6 w-16 bg-white/8 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-8 space-y-6">

        <div className="space-y-3">
          <div>
            <p className="text-xs text-white/35 uppercase tracking-widest font-medium">
              {today.toLocaleDateString('en-HK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h2 className="text-xl font-bold text-white mt-1">Today</h2>
          </div>
          <HabitStrip />
        </div>

        {showChain && chainItems.length > 0 && (
          <div className="rounded-xl border border-navi-blue/25 bg-navi-blue/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-navi-blue uppercase tracking-wider">Monthly Chain</span>
              <span className="text-[11px] text-white/35">{chainItems.filter(s => s.done).length}/{chainItems.length} done</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {chainItems.map((step, i) => (
                <div key={step.id} className="flex items-center gap-1.5">
                  <div className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                    step.done ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : step.active ? 'bg-navi-blue/20 text-navi-blue border border-navi-blue/30'
                    : 'bg-white/5 text-white/30 border border-white/8'
                  }`}>
                    {step.done ? '✓ ' : step.active ? '● ' : '○ '}{step.label}
                  </div>
                  {i < chainItems.length - 1 && <ChevronRight className="w-3 h-3 text-white/15 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-white/45 uppercase tracking-widest">Due Today</h3>
            <span className="text-[11px] text-white/25">
              {totalDueToday} task{totalDueToday !== 1 ? 's' : ''}
              {query && <span className="ml-1 text-white/40">— &quot;{query}&quot;</span>}
            </span>
          </div>
          <div className="space-y-2">
            {totalDueToday === 0 ? (
              <div className="py-4 text-center text-sm text-white/30">
                {query ? `No tasks match "${query}"` : 'No tasks for today'}
              </div>
            ) : (
              <>
                {visibleTasks.map(task => <TodayTaskCard key={task.id} task={task} />)}
                {cyclesToday.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
              </>
            )}
          </div>
        </div>

        {/* Coming up — shown when today list is empty and no search active */}
        {totalDueToday === 0 && !query && (
          <ComingUpSection cycles={allCycles} />
        )}

        {inboxItems.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6 text-sm text-white/40">
            <span>📥</span>
            <span>Inbox is clear</span>
          </div>
        )}

      </div>
    </div>
  )
}
