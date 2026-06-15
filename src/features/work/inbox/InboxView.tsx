'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, Send, Zap, Check, X, Pencil, Inbox, Plus, Sparkles, ChevronDown, Search, FileText } from 'lucide-react'
import { useInbox } from '@/shared/lib/inbox-context'
import { useWorkData } from '@/shared/lib/work-data-context'
import type { InboxItem, InboxArea, InboxEffort } from './data'
import type { Cycle, ChecklistItem, WorkArea } from '@/shared/types'

// ── Styling maps ──────────────────────────────────────────────────────────────
const areaStyle: Record<InboxArea, { chip: string; border: string; label: string; swipeBg: string }> = {
  finance: { chip: 'bg-finance/20 text-finance border-finance/30',  border: 'border-l-finance', label: 'Finance', swipeBg: 'bg-finance/15' },
  hr:      { chip: 'bg-hr/20 text-hr border-hr/30',                border: 'border-l-hr',      label: 'HR',      swipeBg: 'bg-hr/15'      },
  ops:     { chip: 'bg-ops/20 text-ops border-ops/30',             border: 'border-l-ops',     label: 'Ops',     swipeBg: 'bg-ops/15'     },
  others:  { chip: 'bg-others/20 text-others border-others/30',    border: 'border-l-others',  label: 'Others',  swipeBg: 'bg-others/15'  },
}
const AREAS: InboxArea[] = ['finance', 'hr', 'ops', 'others']

const effortStyle: Record<InboxEffort, string> = {
  quick:  'bg-green-500/15 text-green-400 border-green-500/25',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  heavy:  'bg-orange-500/15 text-orange-400 border-orange-500/25',
}
const effortLabel: Record<InboxEffort, string> = { quick: 'Quick', medium: 'Medium', heavy: 'Heavy' }
const EFFORTS: InboxEffort[] = ['quick', 'medium', 'heavy']

const sourceLabel: Record<string, string> = {
  email: 'Email', lark: 'Lark', wechat: 'WeChat',
  telegram: 'Telegram', whatsapp: 'WhatsApp', manual: 'Manual',
}

const DUE_PRESETS = ['Today', 'This week', 'Next week', 'End of month']
const SWIPE_THRESHOLD = 80

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ items }: { items: InboxItem[] }) {
  const must  = items.filter(i => i.must).length
  const quick = items.filter(i => i.effort === 'quick').length
  const med   = items.filter(i => i.effort === 'medium').length
  const heavy = items.filter(i => i.effort === 'heavy').length

  const suggestion = must > 0
    ? `Review ${must} Must item${must > 1 ? 's' : ''} first`
    : quick >= 2
    ? `${quick} Quick tasks clear in ~${quick * 5} min`
    : 'No urgent items — take your time'

  return (
    <div className="rounded-xl border border-navi-blue/20 bg-navi-blue/8 px-4 py-2.5 flex items-center gap-4">
      <div className="flex items-center gap-3 text-[10px]">
        {heavy > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" /><span className="text-white/50">{heavy} Heavy</span></span>}
        {med   > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" /><span className="text-white/50">{med} Medium</span></span>}
        {quick > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /><span className="text-white/50">{quick} Quick</span></span>}
      </div>
      <span className="text-[10px] text-navi-blue font-medium ml-auto">{suggestion}</span>
    </div>
  )
}

// ── Editable title ────────────────────────────────────────────────────────────
function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  const commit = () => {
    const v = draft.trim()
    if (v) onSave(v)
    else setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className="w-full text-[12.6px] font-medium bg-white/8 border border-navi-blue/40 rounded px-2 py-0.5 text-white focus:outline-none"
      />
    )
  }

  return (
    <div className="group/title flex items-start gap-1.5">
      <p className="flex-1 text-[12.6px] font-medium text-white/85 leading-snug">{value}</p>
      <button
        onClick={() => { setDraft(value); setEditing(true) }}
        className="opacity-30 sm:opacity-0 sm:group-hover/title:opacity-60 hover:!opacity-100 mt-0.5 flex-shrink-0 p-0.5 rounded text-white/40 hover:text-white/70 transition-all"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Editable due date with presets ────────────────────────────────────────────
function EditableDue({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const commit = (v: string) => { onSave(v.trim()); setOpen(false) }

  if (open) {
    return (
      <div className="space-y-1.5 flex-1" onClick={e => e.stopPropagation()}>
        <div className="flex gap-1 flex-wrap">
          {DUE_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => commit(p)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/45 hover:border-navi-blue/40 hover:text-navi-blue transition-all"
            >
              {p}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={e => { if (e.key === 'Enter') commit(draft); if (e.key === 'Escape') setOpen(false) }}
          placeholder="Or type custom date..."
          className="text-[10px] bg-white/8 border border-white/15 rounded px-2 py-0.5 text-white/70 focus:outline-none focus:border-navi-blue/40 w-full"
        />
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setDraft(value); setOpen(true) }}
      className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/55 transition-colors"
    >
      <Clock className="w-2.5 h-2.5" />
      <span>{value || 'Set due date'}</span>
    </button>
  )
}

// ── Review panel ──────────────────────────────────────────────────────────────
type ReviewPanelProps = {
  item: InboxItem
  onConfirm: (subtasks: string[]) => void
  onCancel: () => void
  onDismiss: () => void
}

function ReviewPanel({ item, onConfirm, onCancel, onDismiss }: ReviewPanelProps) {
  const naviSuggestsTaskPlus = item.effort === 'heavy'
  const [showSubtasks, setShowSubtasks] = useState(naviSuggestsTaskPlus)
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (showSubtasks) inputRef.current?.focus() }, [showSubtasks])

  const addSubtask = () => {
    const v = input.trim()
    if (!v) return
    setSubtasks(prev => [...prev, v])
    setInput('')
    inputRef.current?.focus()
  }

  const removeSubtask = (i: number) => setSubtasks(prev => prev.filter((_, idx) => idx !== i))
  const isTaskPlus = subtasks.length > 0

  return (
    <div className="border-t border-white/8 px-3.5 pt-3 pb-3 space-y-3">
      {naviSuggestsTaskPlus && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-navi-blue/8 border border-navi-blue/20">
          <Sparkles className="w-3 h-3 text-navi-blue flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-navi-blue/80 leading-relaxed">
            Navi thinks this is a multi-step task. Add steps below, or confirm as-is.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
          {isTaskPlus ? 'Task+' : 'Task'} structure
        </span>
        {!showSubtasks && (
          <button
            onClick={() => setShowSubtasks(true)}
            className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />Add steps
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-white/60">
        <div className="w-3 h-3 rounded border border-white/20 flex-shrink-0" />
        <span className="flex-1 truncate">{item.title}</span>
      </div>

      {showSubtasks && (
        <div className="pl-5 space-y-1.5">
          {subtasks.map((sub, i) => (
            <div key={i} className="flex items-center gap-2 group/sub">
              <div className="w-2.5 h-2.5 rounded border border-white/15 flex-shrink-0" />
              <span className="flex-1 text-[11px] text-white/55">{sub}</span>
              <button
                onClick={() => removeSubtask(i)}
                className="opacity-0 group-hover/sub:opacity-60 hover:!opacity-100 text-white/30 hover:text-white/70 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded border border-navi-blue/30 flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addSubtask()
                if (e.key === 'Escape') setShowSubtasks(subtasks.length > 0)
              }}
              placeholder="Add a step..."
              className="flex-1 text-[11px] bg-transparent text-white/70 placeholder-white/20 focus:outline-none"
            />
            {input.trim() && (
              <button onClick={addSubtask} className="text-navi-blue/70 hover:text-navi-blue transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/6">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">
            Back
          </button>
          <button
            onClick={onDismiss}
            className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Dismiss
          </button>
        </div>
        <button
          onClick={() => onConfirm(subtasks)}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-navi-blue/15 border border-navi-blue/30 text-navi-blue hover:bg-navi-blue/25 font-semibold transition-all"
        >
          <Check className="w-3 h-3" />
          Confirm → {areaStyle[item.area].label}
          {isTaskPlus && <span className="text-[9px] text-navi-blue/60 ml-0.5">+{subtasks.length} steps</span>}
        </button>
      </div>
    </div>
  )
}

// ── Inbox card ────────────────────────────────────────────────────────────────
type CardMode = 'view' | 'review' | 'confirming' | 'dismissing'

function InboxCard({ item }: { item: InboxItem }) {
  const { updateItem, approveItem, dismissItem } = useInbox()
  const { addCycle } = useWorkData()
  const [mode, setMode]             = useState<CardMode>('view')
  const [flashed, setFlashed]       = useState<string | null>(null)
  const [showNotes, setShowNotes]   = useState(!!item.notes)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '')

  // Swipe
  const [swipeX, setSwipeX]         = useState(0)
  const touchStartX                  = useRef(0)
  const touchStartY                  = useRef(0)
  const swipeLocked                  = useRef<'h' | 'v' | null>(null)

  const flash = (key: string, fn: () => void) => {
    fn()
    setFlashed(key)
    setTimeout(() => setFlashed(null), 300)
  }

  const cycleArea = () => flash('area', () => {
    const next = AREAS[(AREAS.indexOf(item.area) + 1) % AREAS.length]
    updateItem(item.id, { area: next })
  })

  const cycleEffort = () => flash('effort', () => {
    const next = EFFORTS[(EFFORTS.indexOf(item.effort) + 1) % EFFORTS.length]
    updateItem(item.id, { effort: next })
  })

  const handleConfirm = (subtasks: string[]) => {
    setMode('confirming')
    const items: ChecklistItem[] = subtasks.length > 0
      ? subtasks.map((label, i) => ({ id: `sub-${item.id}-${i}`, label, status: 'todo' as const }))
      : [{ id: `task-${item.id}`, label: item.title, status: 'todo' as const, effort: item.effort, urgent: item.urgent, must: item.must }]

    const newCycle: Cycle = {
      id: `inbox-${item.id}-${Date.now()}`,
      title: item.title, area: item.area, effort: item.effort,
      must: item.must, urgent: item.urgent,
      triggerLabel: item.dueText || undefined,
      items, status: 'active',
    }
    setTimeout(() => { addCycle(item.area as WorkArea, newCycle); approveItem(item.id) }, 380)
  }

  const handleDismiss = useCallback(() => {
    setMode('dismissing')
    setTimeout(() => dismissItem(item.id), 280)
  }, [dismissItem, item.id])

  const commitNotes = () => {
    updateItem(item.id, { notes: notesDraft.trim() || undefined })
    setEditingNotes(false)
    setShowNotes(!!notesDraft.trim())
  }

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'view') return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swipeLocked.current = null
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (mode !== 'view') return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    if (!swipeLocked.current) {
      if (Math.abs(dx) > Math.abs(dy) + 5) swipeLocked.current = 'h'
      else if (Math.abs(dy) > Math.abs(dx) + 5) swipeLocked.current = 'v'
    }
    if (swipeLocked.current === 'h') {
      setSwipeX(Math.max(-SWIPE_THRESHOLD * 1.4, Math.min(SWIPE_THRESHOLD * 1.4, dx)))
    }
  }

  const onTouchEnd = () => {
    if (mode !== 'view') return
    if (swipeX < -SWIPE_THRESHOLD) handleDismiss()
    else if (swipeX > SWIPE_THRESHOLD) setMode('review')
    setSwipeX(0)
    swipeLocked.current = null
  }

  const area = areaStyle[item.area]
  const isExiting = mode === 'confirming' || mode === 'dismissing'
  const swipeProgress = Math.abs(swipeX) / SWIPE_THRESHOLD
  const swipingLeft = swipeX < -10
  const swipingRight = swipeX > 10

  return (
    <div className={`transition-all duration-300 overflow-hidden ${isExiting ? 'max-h-0 opacity-0' : 'max-h-[800px] opacity-100'}`}>
      <div className="relative rounded-xl overflow-hidden mb-1.5">
        {/* Swipe hint background */}
        {swipingLeft && (
          <div className="absolute inset-0 rounded-xl bg-red-500/20 flex items-center justify-end pr-5 pointer-events-none" style={{ opacity: Math.min(swipeProgress, 1) }}>
            <X className="w-5 h-5 text-red-400" />
          </div>
        )}
        {swipingRight && (
          <div className="absolute inset-0 rounded-xl bg-navi-blue/15 flex items-center justify-start pl-5 pointer-events-none" style={{ opacity: Math.min(swipeProgress, 1) }}>
            <Check className="w-5 h-5 text-navi-blue" />
          </div>
        )}

        {/* Card */}
        <div
          className={`border border-l-4 border-white/8 bg-white/3 rounded-xl overflow-hidden touch-pan-y ${area.border}`}
          style={{ transform: swipeX !== 0 ? `translateX(${swipeX}px)` : 'none', transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="px-3.5 pt-3 pb-2.5 space-y-[10px]">
            {/* Meta chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Area chip — chevron shows it's tappable */}
              <button
                onClick={cycleArea}
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold transition-all hover:opacity-80 ${area.chip} ${flashed === 'area' ? 'scale-110 brightness-125' : ''}`}
              >
                {area.label}
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              {/* Effort chip */}
              <button
                onClick={cycleEffort}
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-all hover:opacity-80 ${effortStyle[item.effort]} ${flashed === 'effort' ? 'scale-110 brightness-125' : ''}`}
              >
                {effortLabel[item.effort]}
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>

              <button
                onClick={() => updateItem(item.id, { must: !item.must })}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-all ${
                  item.must ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'border-white/10 text-white/25 hover:border-white/25 hover:text-white/45'
                }`}
              >
                <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" />Must</span>
              </button>

              <button
                onClick={() => updateItem(item.id, { urgent: !item.urgent })}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-all ${
                  item.urgent ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'border-white/10 text-white/25 hover:border-white/25 hover:text-white/45'
                }`}
              >
                ⚠ Urgent
              </button>

              <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/20">
                <span>{sourceLabel[item.source] ?? item.source}</span>
                <span>·</span>
                <span>{item.capturedAt}</span>
              </div>
            </div>

            {/* Title */}
            <EditableTitle value={item.title} onSave={title => updateItem(item.id, { title })} />

            {/* Notes */}
            {showNotes && !editingNotes && (
              <div className="flex items-start gap-1.5 group/notes">
                <FileText className="w-3 h-3 text-white/25 mt-0.5 flex-shrink-0" />
                <p className="flex-1 text-[11px] text-white/40 leading-relaxed">{item.notes || notesDraft || 'Add a note...'}</p>
                <button
                  onClick={() => { setNotesDraft(item.notes ?? ''); setEditingNotes(true) }}
                  className="opacity-0 group-hover/notes:opacity-60 hover:!opacity-100 p-0.5 rounded text-white/30 hover:text-white/60 transition-all flex-shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}

            {editingNotes && (
              <div className="space-y-1">
                <textarea
                  autoFocus
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  onBlur={commitNotes}
                  onKeyDown={e => { if (e.key === 'Escape') { setEditingNotes(false); setNotesDraft(item.notes ?? '') } }}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full text-[11px] bg-white/8 border border-navi-blue/30 rounded px-2 py-1.5 text-white/70 placeholder-white/20 focus:outline-none resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditingNotes(false); setNotesDraft(item.notes ?? '') }} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">Cancel</button>
                  <button onClick={commitNotes} className="text-[10px] text-navi-blue hover:text-blue-400 transition-colors">Save</button>
                </div>
              </div>
            )}

            {/* Due + actions */}
            {mode === 'view' && (
              <div className="flex items-center justify-between pt-1.5 border-t border-white/6 gap-2">
                <EditableDue value={item.dueText} onSave={dueText => updateItem(item.id, { dueText })} />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!showNotes && (
                    <button
                      onClick={() => { setShowNotes(true); setEditingNotes(true) }}
                      className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/45 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={handleDismiss}
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    <X className="w-3 h-3" />Dismiss
                  </button>
                  <button
                    onClick={() => setMode('review')}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border font-semibold bg-navi-blue/15 text-navi-blue border-navi-blue/30 hover:bg-navi-blue/25 transition-all"
                  >
                    <Check className="w-3 h-3" />
                    Review →
                  </button>
                </div>
              </div>
            )}
          </div>

          {mode === 'review' && (
            <ReviewPanel
              item={item}
              onConfirm={handleConfirm}
              onCancel={() => setMode('view')}
              onDismiss={handleDismiss}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function InboxView() {
  const { items, unreadCount, addItem, approveItem } = useInbox()
  const { addCycle } = useWorkData()
  const [capture, setCapture]               = useState('')
  const [confirmApproveAll, setConfirmApproveAll] = useState(false)
  const [searchQuery, setSearchQuery]        = useState('')
  const captureRef = useRef<HTMLInputElement>(null)

  const filteredItems = items.filter(i =>
    !searchQuery.trim() || i.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort must items: urgent+must first
  const mustItems    = filteredItems.filter(i => i.must).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
  const regularItems = filteredItems.filter(i => !i.must)

  const handleCapture = () => {
    if (!capture.trim()) return
    addItem(capture.trim())
    setCapture('')
    captureRef.current?.focus()
  }

  const handleApproveAll = () => {
    items.forEach((item, idx) => {
      setTimeout(() => {
        const newCycle: Cycle = {
          id: `inbox-${item.id}-${Date.now() + idx}`,
          title: item.title, area: item.area, effort: item.effort,
          must: item.must, urgent: item.urgent,
          triggerLabel: item.dueText || undefined,
          items: [{ id: `task-${item.id}`, label: item.title, status: 'todo', effort: item.effort, urgent: item.urgent, must: item.must }],
          status: 'active',
        }
        addCycle(item.area as WorkArea, newCycle)
        approveItem(item.id)
      }, idx * 80)
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-6 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2.5">
                Inbox
                {unreadCount > 0 && (
                  <span className="text-xs font-bold bg-navi-blue text-white px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h2>
              <p className="text-xs text-white/35 mt-0.5">
                {unreadCount === 0
                  ? 'All clear — nothing to review'
                  : `${unreadCount} item${unreadCount > 1 ? 's' : ''} awaiting review`}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => setConfirmApproveAll(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
              >
                Approve all
              </button>
            )}
          </div>

          {/* Search */}
          {unreadCount > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search inbox..."
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-4 py-2 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-white/15 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {unreadCount === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-navi-blue/10 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-navi-blue/60" />
              </div>
              <p className="text-sm text-white/35">Inbox is clear</p>
              <p className="text-xs text-white/20">Use the bar below to add new items</p>
            </div>
          )}

          {/* Summary bar */}
          {unreadCount > 0 && <SummaryBar items={items} />}

          {/* Swipe hint — shown once when items exist */}
          {unreadCount > 0 && (
            <p className="text-[10px] text-white/20 text-center">
              Swipe right to review · Swipe left to dismiss
            </p>
          )}

          {/* No search results */}
          {unreadCount > 0 && filteredItems.length === 0 && (
            <div className="py-6 text-center text-sm text-white/30">
              No items match &ldquo;{searchQuery}&rdquo;
            </div>
          )}

          {/* Must section */}
          {mustItems.length > 0 && (
            <div className="space-y-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Must do first</span>
                <div className="flex-1 h-px bg-red-500/15" />
                <span className="text-[10px] text-white/25">{mustItems.length}</span>
              </div>
              {mustItems.map(item => <InboxCard key={item.id} item={item} />)}
            </div>
          )}

          {/* Regular items */}
          {regularItems.length > 0 && (
            <div className="space-y-0">
              {mustItems.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Other items</span>
                  <div className="flex-1 h-px bg-white/6" />
                  <span className="text-[10px] text-white/25">{regularItems.length}</span>
                </div>
              )}
              {regularItems.map(item => <InboxCard key={item.id} item={item} />)}
            </div>
          )}

        </div>
      </div>

      {/* Approve all confirm modal */}
      {confirmApproveAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmApproveAll(false)}>
          <div className="bg-[#1e1e1e] border border-white/12 rounded-2xl shadow-2xl w-80 p-6" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white mb-1">Approve all {unreadCount} items?</p>
            <p className="text-xs text-white/45 mb-5 leading-relaxed">
              Each item will be moved to its assigned tab without individual review. Sub-tasks won&apos;t be added. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmApproveAll(false)} className="text-xs px-4 py-2 rounded-lg text-white/45 hover:text-white/70 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { handleApproveAll(); setConfirmApproveAll(false) }}
                className="text-xs px-4 py-2 rounded-lg bg-navi-blue/20 text-navi-blue border border-navi-blue/30 hover:bg-navi-blue/30 font-semibold transition-all"
              >
                Approve all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capture bar */}
      <div className="flex-shrink-0 border-t border-white/8 bg-[#171717] px-6 py-3.5">
        <div className="flex items-center gap-3">
          <input
            ref={captureRef}
            type="text"
            value={capture}
            onChange={e => setCapture(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCapture()}
            placeholder="Capture a task..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-base text-white/80 placeholder-white/25 focus:outline-none focus:border-navi-blue/40 focus:bg-white/8 transition-all"
          />
          <button
            onClick={handleCapture}
            disabled={!capture.trim()}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              capture.trim() ? 'bg-navi-blue text-white hover:bg-blue-600' : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
