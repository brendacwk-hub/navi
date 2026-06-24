'use client'

import { useState, useRef, useEffect, useContext } from 'react'
import { ChevronDown, ChevronRight, Zap, Lock, Pencil, X, FileText, Check, Plus, GripVertical } from 'lucide-react'
import type { Cycle, CyclePhase, Effort } from '@/shared/types'
import { ChecklistItem } from './ChecklistItem'
import { WorkDataContext } from '@/shared/lib/work-data-context'
import { PersonalDataContext } from '@/shared/lib/personal-data-context'
import { useToast } from '@/shared/lib/toast-context'
import { type CycleFilter, filterToLeaves, CADENCE_FILTERS } from '@/shared/lib/filter-utils'
import { allCycleDone, isRecurring, resolveLabel, computeSkipDate } from '@/shared/lib/sort-utils'
import { RecurrencePicker, isRecurrString, fmtRecurrDisplay } from './RecurrencePicker'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const effortColors: Record<Effort, { bg: string; text: string; border: string }> = {
  quick:  { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  heavy:  { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
}
const effortLabels: Record<Effort, string> = { quick: 'Quick', medium: 'Medium', heavy: 'Heavy' }

const SUB_AREAS_BY_AREA: Partial<Record<string, string[]>> = {
  finance: ['Payments', 'Budgets', 'Administrative', 'Records', 'AI'],
  hr: ['Payroll & MPF', 'Insurance & VISA', 'Leave & Attendance', 'Onboarding & Offboarding', 'Tax', 'Records', 'AI'],
  ops: ['Vendor & Contracts', 'Expenses', 'Arrangements', 'AI'],
}

function fmtTrigger(label: string | undefined): { display: string; overdue: boolean } {
  if (!label) return { display: '', overdue: false }
  // New recurrence pattern → friendly display, never overdue
  if (isRecurrString(label)) return { display: fmtRecurrDisplay(label), overdue: false }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(label + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) return { display: 'Due Today', overdue: false }
    if (d < today) {
      const days = Math.round((today.getTime() - d.getTime()) / 86400000)
      if (days === 0) return { display: 'Due Today', overdue: false }
      return { display: `Overdue · ${days}d`, overdue: true }
    }
    return { display: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), overdue: false }
  }
  return { display: label, overdue: false }
}

const phaseStatusColor: Record<string, string> = {
  locked: 'text-white/25', upcoming: 'text-white/50', active: 'text-navi-blue', complete: 'text-green-400',
}

function countItems(items: { status: string; subItems?: { status: string }[] }[]): { done: number; total: number } {
  let done = 0, total = 0
  for (const item of items) {
    if (item.subItems && item.subItems.length > 0) {
      for (const sub of item.subItems) { total++; if (sub.status === 'done') done++ }
    } else {
      total++
      if (item.status === 'done') done++
    }
  }
  return { done, total }
}

type WorkAreaLocal = 'finance' | 'hr' | 'ops' | 'others'

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className="flex items-start gap-1">
      <button {...attributes} {...listeners} className="touch-none flex-shrink-0 cursor-grab active:cursor-grabbing mt-1 text-white/20 hover:text-white/45 transition-colors p-0.5" tabIndex={-1}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function PhaseSection({ phase, cycle, filter }: { phase: CyclePhase; cycle: Cycle; filter: CycleFilter }) {
  const [open, setOpen] = useState(phase.status === 'active')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (useContext(WorkDataContext) ?? useContext(PersonalDataContext)) as any
  const { toggleItem, setItemLabel, setItemNote, setItemUrgent, setItemDue, deleteItem } = ctx
  const area = cycle.area as WorkAreaLocal
  const cycleId = cycle.id

  const isFiltering = filter !== 'All' && !CADENCE_FILTERS.has(filter)
  const visibleItems = isFiltering
    ? filterToLeaves(phase.items, cycle, filter)
    : phase.items

  const { done, total } = countItems(phase.items) // always full count

  if (isFiltering && visibleItems.length === 0) return null

  return (
    <div className="border border-white/8 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        {phase.status === 'locked' ? (
          <Lock className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
        ) : (
          <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform text-white/50 ${open ? 'rotate-90' : ''}`} />
        )}
        <span className={`text-sm font-bold flex-1 text-left ${phaseStatusColor[phase.status]}`}>{phase.title}</span>
        <span className="text-[11px] text-white/30 mr-2">{phase.triggerLabel}</span>
        {phase.status !== 'locked' && <span className="text-[11px] text-white/40 tabular-nums">{done}/{total}</span>}
      </button>

      {open && phase.status !== 'locked' && (
        <div className="border-t border-white/8 py-1">
          {visibleItems.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={id => toggleItem(area, cycleId, id)}
              onNoteChange={(id, note) => setItemNote(area, cycleId, id, note)}
              onLabelChange={(id, label) => setItemLabel(area, cycleId, id, label)}
              onUrgentChange={(id, urgent) => setItemUrgent(area, cycleId, id, urgent)}
              onDueChange={(id, due) => setItemDue(area, cycleId, id, due)}
              onDelete={id => deleteItem(area, cycleId, id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  cycle: Cycle
  filter?: CycleFilter
}

export function CycleCard({ cycle, filter = 'All' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [draft, setDraft] = useState(cycle.title)
  const [editMust, setEditMust] = useState(cycle.must)
  const [editUrgent, setEditUrgent] = useState(cycle.urgent ?? false)
  const [editEffort, setEditEffort] = useState<Effort>(cycle.effort)
  const initTrigger = cycle.triggerLabel ?? ''
  const [editDue,    setEditDue]    = useState(isRecurrString(initTrigger) ? '' : initTrigger)
  const [editRecurr, setEditRecurr] = useState(isRecurrString(initTrigger) ? initTrigger : '')
  const [editSubArea, setEditSubArea] = useState(cycle.subArea ?? '')
  const [editNotes, setEditNotes] = useState(cycle.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingStep, setAddingStep] = useState(false)
  const [newStep, setNewStep] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const newStepRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (useContext(WorkDataContext) ?? useContext(PersonalDataContext)) as any
  const { updateCycle, deleteCycle, deleteItem, toggleItem, setItemLabel, setItemNote, setItemUrgent, setItemDue, addCycleItem } = ctx
  const { showToast } = useToast()
  const area = cycle.area as WorkAreaLocal

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !cycle.items) return
    const oldIndex = cycle.items.findIndex(i => i.id === active.id)
    const newIndex = cycle.items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    updateCycle(area, cycle.id, { items: arrayMove(cycle.items, oldIndex, newIndex) })
  }

  useEffect(() => { if (filter !== 'All') setExpanded(true) }, [filter])
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])
  useEffect(() => { if (addingStep) newStepRef.current?.focus() }, [addingStep])

  const saveTitle = () => {
    const trimmed = draft.trim()
    updateCycle(area, cycle.id, {
      title: trimmed || cycle.title,
      must: editMust,
      urgent: editUrgent,
      effort: editEffort,
      triggerLabel: editRecurr || resolveLabel(editDue),
      subArea: editSubArea || undefined,
      notes: editNotes.trim() || undefined,
    })
    if (!trimmed) setDraft(cycle.title)
    setEditingTitle(false)
  }

  const startEditing = () => {
    setDraft(cycle.title)
    setEditMust(cycle.must)
    setEditUrgent(cycle.urgent ?? false)
    setEditEffort(cycle.effort)
    const trigger = cycle.triggerLabel ?? ''
    setEditDue(isRecurrString(trigger) ? '' : trigger)
    setEditRecurr(isRecurrString(trigger) ? trigger : '')
    setEditSubArea(cycle.subArea ?? '')
    setEditNotes(cycle.notes ?? '')
    setEditingTitle(true)
  }

  const effortStyle = effortColors[cycle.effort]
  const areaStyle: Record<string, { border: string; bg: string; progress: string }> = {
    finance: { border: 'border-finance/25', bg: 'bg-finance/5',  progress: 'bg-finance' },
    hr:      { border: 'border-hr/25',      bg: 'bg-hr/5',       progress: 'bg-hr' },
    ops:     { border: 'border-ops/25',     bg: 'bg-ops/5',      progress: 'bg-ops' },
    others:  { border: 'border-others/25',  bg: 'bg-others/5',   progress: 'bg-others' },
  }
  const personalAreaColor: Record<string, string> = {
    housework:          '#fb7185',
    'personal-finance': '#22d3ee',
    sidoi:              '#f9a8d4',
    tobuy:              '#fcd34d',
  }
  const personalColor = personalAreaColor[cycle.area]
  const style = areaStyle[cycle.area] ?? areaStyle.finance

  const { display: dueLabelDisplay, overdue: isOverdue } = fmtTrigger(cycle.triggerLabel)
  const isDone = cycle.status === 'complete' || !!cycle.nextDueAt
  const hasNoItems = !cycle.phases && !(cycle.items?.length)
  const showMarkDone = !isDone && !isRecurring(cycle.triggerLabel) && (allCycleDone(cycle) || hasNoItems)

  // Leaf-only filtered view for non-phased cycles
  const isFiltering = filter !== 'All' && !CADENCE_FILTERS.has(filter)
  const visibleItems = isFiltering
    ? filterToLeaves(cycle.items ?? [], cycle, filter)
    : (cycle.items ?? [])

  // Progress always uses full unfiltered item tree
  const totals = cycle.phases
    ? cycle.phases.reduce((acc, p) => {
        const { done, total } = countItems(p.items)
        return { done: acc.done + done, total: acc.total + total }
      }, { done: 0, total: 0 })
    : countItems(cycle.items ?? [])

  const pct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all group/card ${personalColor ? '' : `${style.border} ${style.bg}`}`}
      style={personalColor ? { borderColor: personalColor + '40', backgroundColor: personalColor + '0d' } : {}}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-shrink-0">
          <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </div>

        <div className="flex-1 min-w-0" onClick={editingTitle ? (e => e.stopPropagation()) : undefined}>
          {editingTitle ? (
            <div className="space-y-2" onClick={e => e.stopPropagation()}>
              <input
                ref={titleInputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveTitle()
                  if (e.key === 'Escape') { setDraft(cycle.title); setEditingTitle(false) }
                }}
                className="w-full text-sm font-bold bg-white/8 border border-navi-blue/50 rounded px-2 py-0.5 text-white focus:outline-none"
              />
              {/* Effort */}
              <div className="flex gap-1.5 flex-wrap">
                {(['quick', 'medium', 'heavy'] as Effort[]).map(e => (
                  <button key={e} onMouseDown={ev => ev.preventDefault()} onClick={() => setEditEffort(e)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all capitalize ${
                      editEffort === e
                        ? e === 'quick'  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : e === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        :                  'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'
                    }`}>
                    {e}
                  </button>
                ))}
              </div>
              {/* Due date — one-time */}
              <div className="flex gap-1.5 flex-wrap items-center">
                {(['Today', 'Tomorrow', 'In 2 Days'] as const).map(d => (
                  <button key={d} onMouseDown={ev => ev.preventDefault()} onClick={() => { setEditDue(d); setEditRecurr('') }}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                      !editRecurr && editDue === d ? 'bg-navi-blue/20 text-navi-blue border-navi-blue/40' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'
                    }`}>
                    {d}
                  </button>
                ))}
                <input
                  type="date"
                  value={!editRecurr && /^\d{4}-\d{2}-\d{2}$/.test(editDue) ? editDue : ''}
                  onChange={e => { setEditDue(e.target.value); setEditRecurr('') }}
                  className="text-[10px] px-2 py-0.5 rounded border border-white/15 bg-transparent text-white/55 focus:outline-none focus:border-navi-blue/50 [color-scheme:dark]"
                />
              </div>
              {/* Recurring */}
              <RecurrencePicker
                value={editRecurr}
                onChange={val => { setEditRecurr(val); if (val) setEditDue('') }}
                small
              />
              {/* Sub-area */}
              {(SUB_AREAS_BY_AREA[cycle.area] ?? []).length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button onMouseDown={e => e.preventDefault()} onClick={() => setEditSubArea('')}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${!editSubArea ? 'bg-white/10 text-white/55 border-white/20' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'}`}>
                    No sub-area
                  </button>
                  {SUB_AREAS_BY_AREA[cycle.area]!.map(s => (
                    <button key={s} onMouseDown={e => e.preventDefault()} onClick={() => setEditSubArea(s)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                        editSubArea === s ? 'bg-navi-blue/20 text-navi-blue border-navi-blue/40' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Notes */}
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                placeholder="Notes, context, amounts…"
                rows={2}
                className="w-full text-[11px] bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/60 placeholder-white/25 focus:outline-none focus:border-white/20 resize-none"
              />
              {/* Must / Urgent / Save */}
              <div className="flex gap-2">
                <button onMouseDown={e => e.preventDefault()} onClick={() => setEditMust(m => !m)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-all ${editMust ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'}`}>
                  {editMust ? '● Must (on)' : '○ Must'}
                </button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => setEditUrgent(u => !u)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-all ${editUrgent ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'}`}>
                  {editUrgent ? '⚠ Urgent (on)' : '○ Urgent'}
                </button>
                <button onMouseDown={e => e.preventDefault()} onClick={saveTitle}
                  className="text-[10px] px-2 py-0.5 rounded border border-navi-blue/40 text-navi-blue hover:bg-navi-blue/10 transition-all ml-auto">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {cycle.urgent && <span className="text-orange-400 text-[11px] font-bold">⚠</span>}
              <span className="font-bold text-white text-sm">{cycle.title}</span>
              {cycle.must && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                  <Zap className="w-2.5 h-2.5" /> MUST
                </span>
              )}
              {cycle.urgent && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border-orange-500/30 font-medium">
                  ⚠ URGENT
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${effortStyle.bg} ${effortStyle.text} ${effortStyle.border}`}>
                {effortLabels[cycle.effort]}
              </span>
              {cycle.status === 'complete' && (
                <button
                  onClick={e => { e.stopPropagation(); updateCycle(area, cycle.id, { status: 'active' }); showToast('Reopened') }}
                  className="opacity-30 sm:opacity-0 sm:group-hover/card:opacity-100 px-1.5 py-0.5 rounded text-[10px] text-white/35 hover:text-navi-blue border border-transparent hover:border-navi-blue/30 transition-all"
                  title="Reopen cycle"
                >
                  Reopen
                </button>
              )}
              {showMarkDone && (
                <button
                  onClick={e => { e.stopPropagation(); updateCycle(area, cycle.id, { status: 'complete' }); showToast(`"${cycle.title}" marked done`) }}
                  className="opacity-30 sm:opacity-0 sm:group-hover/card:opacity-100 p-0.5 rounded text-white/35 hover:text-green-400 transition-all"
                  title="Mark done"
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); startEditing() }}
                className="opacity-30 sm:opacity-0 sm:group-hover/card:opacity-100 p-0.5 rounded text-white/35 hover:text-white/70 transition-all"
                title="Edit cycle"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                className="opacity-30 sm:opacity-0 sm:group-hover/card:opacity-100 p-0.5 rounded text-white/35 hover:text-red-400 transition-all"
                title="Delete cycle"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {dueLabelDisplay && (
              isOverdue ? (
                <>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-medium">{dueLabelDisplay}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const d = new Date(); d.setDate(d.getDate() + 1)
                      updateCycle(area, cycle.id, { triggerLabel: d.toISOString().slice(0, 10) })
                    }}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    title="Push to tomorrow"
                  >
                    → Tomorrow
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const d = new Date()
                      const daysToFri = (5 - d.getDay() + 7) % 7 || 7
                      d.setDate(d.getDate() + daysToFri)
                      updateCycle(area, cycle.id, { triggerLabel: d.toISOString().slice(0, 10) })
                    }}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    title="Push to this Friday"
                  >
                    → This Fri
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const d = new Date(); d.setDate(d.getDate() + 7)
                      updateCycle(area, cycle.id, { triggerLabel: d.toISOString().slice(0, 10) })
                    }}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    title="Push one week"
                  >
                    → Next wk
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-white/35">{dueLabelDisplay}</span>
              )
            )}
            {cycle.subArea && (
              <span className="text-[10px] text-white/25 px-1.5 py-0.5 rounded border border-white/10">{cycle.subArea}</span>
            )}
            {cycle.notes && <FileText className="w-3 h-3 text-white/25 flex-shrink-0" />}
          </div>
          {/* Skip button — recurring cycles only, when not already done */}
          {!isDone && isRecurring(cycle.triggerLabel) && (
            <button
              onClick={e => {
                e.stopPropagation()
                const skip = computeSkipDate(cycle.triggerLabel)
                if (skip) updateCycle(area, cycle.id, { nextDueAt: skip })
              }}
              className="text-[10px] text-white/25 hover:text-white/55 transition-colors mt-0.5 flex items-center gap-1"
              title="Skip this occurrence — resurfaces next cycle"
            >
              ↩ Skip
            </button>
          )}
          {cycle.nextDueAt && (
            <div className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400/70 border border-green-500/15 w-fit">
              ✓ Resets {new Date(cycle.nextDueAt + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isDone ? (
            <div className="text-[10px] text-green-400/60 font-medium">Done ✓</div>
          ) : (
            <>
              <div className="text-[11px] text-white/40 tabular-nums">{totals.done}/{totals.total}</div>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${personalColor ? '' : style.progress}`}
                  style={{ width: `${pct}%`, ...(personalColor ? { backgroundColor: personalColor } : {}) }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmDelete(false)}>
          <div
            className="bg-[#1e1e1e] border border-white/12 rounded-2xl shadow-2xl w-80 p-6"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-white mb-1">Delete cycle?</p>
            <p className="text-xs text-white/45 mb-5 leading-relaxed">
              &ldquo;{cycle.title}&rdquo; will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-4 py-2 rounded-lg text-white/45 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteCycle(area, cycle.id); setConfirmDelete(false); showToast(`"${cycle.title}" deleted`) }}
                className="text-xs px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="border-t border-white/8 px-4 py-3 space-y-2">
          {cycle.notes && (
            <p className="text-xs text-white/50 flex items-start gap-2 pb-1 border-b border-white/6">
              <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-white/35" />
              {cycle.notes}
            </p>
          )}
          {cycle.phases ? (
            cycle.phases.map(phase => (
              <PhaseSection key={phase.id} phase={phase} cycle={cycle} filter={filter} />
            ))
          ) : (
            <div className="space-y-0.5">
              {visibleItems.length === 0 && !addingStep ? (
                <p className="text-xs text-white/25 py-1 px-2">No items match this filter</p>
              ) : editingTitle ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                  <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {visibleItems.map(item => (
                      <SortableItemRow key={item.id} id={item.id}>
                        <ChecklistItem
                          item={item}
                          onToggle={id => toggleItem(area, cycle.id, id)}
                          onNoteChange={(id, note) => setItemNote(area, cycle.id, id, note)}
                          onLabelChange={(id, label) => setItemLabel(area, cycle.id, id, label)}
                          onUrgentChange={(id, urgent) => setItemUrgent(area, cycle.id, id, urgent)}
                          onDueChange={(id, due) => setItemDue(area, cycle.id, id, due)}
                          onDelete={id => deleteItem(area, cycle.id, id)}
                        />
                      </SortableItemRow>
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                visibleItems.map(item => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onToggle={id => toggleItem(area, cycle.id, id)}
                    onNoteChange={(id, note) => setItemNote(area, cycle.id, id, note)}
                    onLabelChange={(id, label) => setItemLabel(area, cycle.id, id, label)}
                    onUrgentChange={(id, urgent) => setItemUrgent(area, cycle.id, id, urgent)}
                    onDueChange={(id, due) => setItemDue(area, cycle.id, id, due)}
                    onDelete={id => deleteItem(area, cycle.id, id)}
                  />
                ))
              )}
            </div>
          )}
          {/* Add sub-task / step — only for non-phase cycles */}
          {!cycle.phases && (() => {
            const isTaskForm = (cycle.items?.length ?? 0) > 0 && cycle.items![0].label === cycle.title
            const label = isTaskForm ? 'Add sub-task' : 'Add step'
            const ph    = isTaskForm ? 'Sub-task label…' : 'Step label…'
            return addingStep ? (
              <input
                ref={newStepRef}
                value={newStep}
                onChange={e => setNewStep(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newStep.trim()) {
                    addCycleItem(area, cycle.id, newStep.trim())
                    setNewStep('')
                    setAddingStep(false)
                  }
                  if (e.key === 'Escape') { setNewStep(''); setAddingStep(false) }
                }}
                onBlur={() => { setNewStep(''); setAddingStep(false) }}
                placeholder={ph}
                className="w-full text-xs bg-white/5 border border-navi-blue/30 rounded px-2 py-1 text-white/70 placeholder-white/25 focus:outline-none focus:border-navi-blue/60"
              />
            ) : (
              <button
                onClick={() => setAddingStep(true)}
                className="mt-1 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors"
              >
                <Plus className="w-3 h-3" /> {label}
              </button>
            )
          })()}
        </div>
      )}
    </div>
  )
}
