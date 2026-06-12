'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Zap, Lock, Pencil } from 'lucide-react'
import type { Cycle, CyclePhase, Effort } from '@/shared/types'
import { ChecklistItem } from './ChecklistItem'
import { useWorkData } from '@/shared/lib/work-data-context'
import { type CycleFilter, filterToLeaves, CADENCE_FILTERS } from '@/shared/lib/filter-utils'

const effortColors: Record<Effort, { bg: string; text: string; border: string }> = {
  quick:  { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  heavy:  { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
}
const effortLabels: Record<Effort, string> = { quick: 'Quick', medium: 'Medium', heavy: 'Heavy' }

const phaseStatusColor: Record<string, string> = {
  locked: 'text-white/25', upcoming: 'text-white/50', active: 'text-navi-blue', complete: 'text-green-400',
}

function countItems(items: { status: string; subItems?: { status: string }[] }[]): { done: number; total: number } {
  let done = 0, total = 0
  for (const item of items) {
    total++
    if (item.status === 'done') done++
    if (item.subItems) for (const sub of item.subItems) { total++; if (sub.status === 'done') done++ }
  }
  return { done, total }
}

type WorkAreaLocal = 'finance' | 'hr' | 'ops' | 'others'

function PhaseSection({ phase, cycle, filter }: { phase: CyclePhase; cycle: Cycle; filter: CycleFilter }) {
  const [open, setOpen] = useState(phase.status === 'active')
  const { toggleItem, setItemLabel, setItemNote, setItemUrgent } = useWorkData()
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
  const [expanded, setExpanded] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [draft, setDraft] = useState(cycle.title)
  const [editMust, setEditMust] = useState(cycle.must)
  const [editUrgent, setEditUrgent] = useState(cycle.urgent ?? false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const { updateCycle, toggleItem, setItemLabel, setItemNote, setItemUrgent } = useWorkData()
  const area = cycle.area as WorkAreaLocal

  useEffect(() => { if (filter !== 'All') setExpanded(true) }, [filter])
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])

  const saveTitle = () => {
    const trimmed = draft.trim()
    updateCycle(area, cycle.id, { title: trimmed || cycle.title, must: editMust, urgent: editUrgent })
    if (!trimmed) setDraft(cycle.title)
    setEditingTitle(false)
  }

  const startEditing = () => {
    setDraft(cycle.title)
    setEditMust(cycle.must)
    setEditUrgent(cycle.urgent ?? false)
    setEditingTitle(true)
  }

  const effortStyle = effortColors[cycle.effort]
  const areaStyle: Record<string, { border: string; bg: string; progress: string }> = {
    finance: { border: 'border-finance/25', bg: 'bg-finance/5',  progress: 'bg-finance' },
    hr:      { border: 'border-hr/25',      bg: 'bg-hr/5',       progress: 'bg-hr' },
    ops:     { border: 'border-ops/25',     bg: 'bg-ops/5',      progress: 'bg-ops' },
    others:  { border: 'border-others/25',  bg: 'bg-others/5',   progress: 'bg-others' },
  }
  const style = areaStyle[cycle.area] ?? areaStyle.finance

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
    <div className={`rounded-xl border overflow-hidden transition-all group/card ${style.border} ${style.bg}`}>
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
            <div className="space-y-2">
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
              <button
                onClick={e => { e.stopPropagation(); startEditing() }}
                className="opacity-0 group-hover/card:opacity-100 p-0.5 rounded text-white/35 hover:text-white/70 transition-all"
                title="Edit cycle"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="text-[11px] text-white/35 mt-0.5">{cycle.triggerLabel}</div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-[11px] text-white/40 tabular-nums">{totals.done}/{totals.total}</div>
          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${style.progress}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-white/8 px-4 py-3 space-y-2">
          {cycle.phases ? (
            cycle.phases.map(phase => (
              <PhaseSection key={phase.id} phase={phase} cycle={cycle} filter={filter} />
            ))
          ) : (
            <div className="space-y-0.5">
              {visibleItems.length === 0 ? (
                <p className="text-xs text-white/25 py-1 px-2">No items match this filter</p>
              ) : (
                visibleItems.map(item => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onToggle={id => toggleItem(area, cycle.id, id)}
                    onNoteChange={(id, note) => setItemNote(area, cycle.id, id, note)}
                    onLabelChange={(id, label) => setItemLabel(area, cycle.id, id, label)}
                    onUrgentChange={(id, urgent) => setItemUrgent(area, cycle.id, id, urgent)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
