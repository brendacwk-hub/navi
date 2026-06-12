'use client'

import { useState } from 'react'
import { Zap, ChevronDown, Clock, ChevronRight, FileText, Pencil } from 'lucide-react'
import { useSearch } from '@/shared/lib/search-context'
import { useWorkData } from '@/shared/lib/work-data-context'
import { fuzzyMatch } from '@/shared/lib/search-utils'
import type { TodayTaskData } from './data'

const areaColor = {
  finance: 'border-l-finance bg-finance/5 border-finance/20',
  hr:      'border-l-hr      bg-hr/5      border-hr/20',
  ops:     'border-l-ops     bg-ops/5     border-ops/20',
  others:  'border-l-others  bg-others/5  border-others/20',
}

const effortLabel: Record<string, string> = { quick: 'Quick', medium: 'Medium', heavy: 'Heavy' }
const effortDot: Record<string, string> = {
  quick: 'bg-green-500', medium: 'bg-yellow-500', heavy: 'bg-orange-500'
}

// ── Inline editable label ─────────────────────────────────────────────────────
function EditableText({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
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

  const {
    toggleTodaySubItem,
    updateTodayTaskLabel,
    updateTodaySubItemLabel,
    setTodayTaskTags,
    toggleTodaySubItemUrgent,
  } = useWorkData()

  const subItems = task.subItems ?? []
  const doneCount = subItems.filter(s => s.done).length
  const allDone = subItems.length > 0 && doneCount === subItems.length

  return (
    <div className={`rounded-xl border border-l-4 overflow-hidden transition-all ${areaColor[task.area]}`}>
      {/* Main row */}
      <div className="px-4 py-3 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          {subItems.length > 0 && (
            <span className={`flex-shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${
              allDone ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-white/40'
            }`}>
              {doneCount}/{subItems.length}
            </span>
          )}

          <div className={`flex-1 min-w-0 text-sm font-medium ${allDone ? 'line-through text-white/35' : 'text-white/85'}`}>
            <EditableText value={task.label} onSave={v => updateTodayTaskLabel(task.id, v)} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
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
              className="opacity-20 hover:opacity-70 p-0.5 rounded text-white/50 hover:text-white/80 transition-all"
              title="Edit tags"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform ${expanded ? '' : '-rotate-90'}`} />
          </div>
        </div>

        {/* Tag edit row */}
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

      {/* Expanded body */}
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
                  {sub.urgent && <span className="text-orange-400 text-[11px] font-bold flex-shrink-0">⚠</span>}
                  <div className={`flex-1 min-w-0 text-[11.6px] ${sub.done ? 'line-through text-white/25' : 'text-white/60'}`}>
                    <EditableText value={sub.label} onSave={v => updateTodaySubItemLabel(task.id, sub.id, v)} />
                  </div>
                  <button
                    onClick={() => toggleTodaySubItemUrgent(task.id, sub.id)}
                    className={`opacity-0 group-hover/sub:opacity-60 hover:!opacity-100 text-[10px] px-1.5 py-0.5 rounded border transition-all flex-shrink-0 ${
                      sub.urgent ? 'opacity-100 bg-orange-500/20 text-orange-400 border-orange-500/30' : 'border-white/15 text-white/35'
                    }`}
                    title={sub.urgent ? 'Remove urgent' : 'Mark urgent'}
                  >
                    ⚠
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Monthly chain ─────────────────────────────────────────────────────────────
const chainStatus = [
  { label: 'Budgets',   done: false, active: true },
  { label: 'Payroll',   done: false, active: false },
  { label: 'MPF',       done: false, active: false },
  { label: 'Bank Stmts',done: false, active: false },
  { label: 'HR Cost',   done: false, active: false },
  { label: 'China Bgt', done: false, active: false },
  { label: 'Reap CC',   done: false, active: false },
]

// ── Main view ─────────────────────────────────────────────────────────────────
export function TodayView() {
  const { query } = useSearch()
  const { todayTasks } = useWorkData()

  const today = new Date()
  const dayOfMonth = today.getDate()
  const showChain = dayOfMonth >= 18 || dayOfMonth <= 5

  const visibleTasks = todayTasks.filter(t => {
    if (!query.trim()) return true
    return fuzzyMatch(t.label, query) || (t.subItems ?? []).some(s => fuzzyMatch(s.label, query))
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-8 space-y-6 max-w-2xl">

        <div>
          <p className="text-xs text-white/35 uppercase tracking-widest font-medium">
            {today.toLocaleDateString('en-HK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h2 className="text-xl font-bold text-white mt-1">Today</h2>
        </div>

        {showChain && (
          <div className="rounded-xl border border-navi-blue/25 bg-navi-blue/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-navi-blue uppercase tracking-wider">Monthly Chain</span>
              <span className="text-[11px] text-white/35">Starts 20th</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {chainStatus.map((step, i) => (
                <div key={step.label} className="flex items-center gap-1.5">
                  <div className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                    step.done ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : step.active ? 'bg-navi-blue/20 text-navi-blue border border-navi-blue/30'
                    : 'bg-white/5 text-white/30 border border-white/8'
                  }`}>
                    {step.done ? '✓ ' : step.active ? '● ' : '○ '}{step.label}
                  </div>
                  {i < chainStatus.length - 1 && <ChevronRight className="w-3 h-3 text-white/15 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-white/45 uppercase tracking-widest">Due Today</h3>
            <span className="text-[11px] text-white/25">
              {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''}
              {query && <span className="ml-1 text-white/40">— &quot;{query}&quot;</span>}
            </span>
          </div>
          <div className="space-y-2">
            {visibleTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/30">
                {query ? `No tasks match "${query}"` : 'No tasks for today'}
              </div>
            ) : (
              visibleTasks.map(task => <TodayTaskCard key={task.id} task={task} />)
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6 text-sm text-white/40">
          <span>📥</span>
          <span>Inbox is clear</span>
        </div>

      </div>
    </div>
  )
}
