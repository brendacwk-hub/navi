'use client'

import { useState, useRef, useEffect } from 'react'
import { ExternalLink, MessageSquare, Clock, ChevronRight, Pencil, X, Calendar } from 'lucide-react'
import type { ChecklistItem as ChecklistItemType, Effort } from '@/shared/types'
import { resolveLabel } from '@/shared/lib/sort-utils'

const effortDot: Record<Effort, string> = {
  quick: 'bg-green-500',
  medium: 'bg-yellow-500',
  heavy: 'bg-orange-500',
}

const effortLabel: Record<Effort, string> = {
  quick: 'Quick',
  medium: 'Medium',
  heavy: 'Heavy',
}

const DUE_PRESETS = ['Today', 'Tomorrow', 'This Week', 'Next Week']

interface Props {
  item: ChecklistItemType
  depth?: number
  onToggle: (id: string) => void
  onNoteChange: (id: string, note: string) => void
  onLabelChange: (id: string, label: string) => void
  onUrgentChange?: (id: string, urgent: boolean) => void
  onDueChange?: (id: string, due: string) => void
  onDelete?: (id: string) => void
}

export function ChecklistItem({ item, depth = 0, onToggle, onNoteChange, onLabelChange, onUrgentChange, onDueChange, onDelete }: Props) {
  const [noteOpen, setNoteOpen]       = useState(false)
  const [dueOpen, setDueOpen]         = useState(false)
  const [subExpanded, setSubExpanded] = useState(true)
  const [editing, setEditing]         = useState(false)
  const [draft, setDraft]             = useState(item.label)
  const [localUrgent, setLocalUrgent] = useState(item.urgent ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalUrgent(item.urgent ?? false) }, [item.urgent])
  useEffect(() => { if (!editing) setDraft(item.label) }, [item.label, editing])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const saveEdit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== item.label) onLabelChange(item.id, trimmed)
    else setDraft(item.label)
    setEditing(false)
  }

  const toggleUrgent = () => {
    const next = !localUrgent
    setLocalUrgent(next)
    onUrgentChange?.(item.id, next)
  }

  const indent = depth * 20

  return (
    <div className="select-none">
      <div
        className="group flex items-start gap-2 py-[5.4px] px-2 rounded-md hover:bg-white/5 transition-colors"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {/* Checkbox */}
        <button
          onClick={() => onToggle(item.id)}
          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-all ${
            item.status === 'done'
              ? 'bg-navi-blue border-navi-blue'
              : 'border-white/30 hover:border-white/60'
          }`}
        >
          {item.status === 'done' && (
            <svg viewBox="0 0 12 12" className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>

        {/* Label area */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') { setDraft(item.label); setEditing(false) }
                }}
                className="w-full text-[13.6px] bg-white/8 border border-navi-blue/50 rounded px-1.5 py-0.5 text-white focus:outline-none"
              />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={toggleUrgent}
                className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                  localUrgent
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                    : 'border-white/15 text-white/30 hover:border-white/30 hover:text-white/55'
                }`}
              >
                {localUrgent ? '⚠ Urgent — click to remove' : '+ Mark Urgent'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {localUrgent && (
                <span className="text-orange-400 text-[11px] font-bold leading-none">⚠</span>
              )}
              <span
                className={`text-[13.6px] leading-relaxed ${
                  item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'
                } ${item.optional ? 'italic text-white/50' : ''}`}
              >
                {item.label}
              </span>
              {item.waitingOn && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  <Clock className="w-2.5 h-2.5" /> Waiting On
                </span>
              )}
              {item.due && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-navi-blue/15 text-navi-blue/80 border border-navi-blue/20">
                  <Calendar className="w-2.5 h-2.5" /> {item.due}
                </span>
              )}
              {item.effort && depth === 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
                  <span className={`w-1.5 h-1.5 rounded-full ${effortDot[item.effort]}`} />
                  {effortLabel[item.effort]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions — visible on mobile, hover on desktop */}
        {!editing && !confirmDelete && (
          <div className="flex items-center gap-1 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onUrgentChange && (
              <button
                onClick={toggleUrgent}
                className={`p-1 rounded transition-colors ${localUrgent ? 'text-orange-400' : 'text-white/40 hover:text-orange-400'}`}
                title={localUrgent ? 'Remove urgent' : 'Mark urgent'}
              >
                <span className="text-[12px] leading-none">⚠</span>
              </button>
            )}
            {onDueChange && (
              <button
                onClick={() => { setDueOpen(o => !o); setNoteOpen(false) }}
                className={`p-1 rounded transition-colors ${dueOpen || item.due ? 'text-navi-blue' : 'text-white/40 hover:text-navi-blue'}`}
                title="Set due date"
              >
                <Calendar className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => { setDraft(item.label); setEditing(true) }}
              className="p-1 rounded text-white/40 hover:text-white/70 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
            {item.url && (
              <button
                onClick={() => window.open(item.url!, '_blank', 'noopener,noreferrer')}
                className="p-1 rounded text-white/40 hover:text-navi-blue transition-colors"
                title={item.url}
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => { setNoteOpen(!noteOpen); setDueOpen(false) }}
              className={`p-1 rounded transition-colors ${noteOpen || item.notes ? 'text-navi-blue' : 'text-white/40 hover:text-white/70'}`}
              title="Add note"
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            {item.subItems && item.subItems.length > 0 && (
              <button
                onClick={() => setSubExpanded(!subExpanded)}
                className="p-1 rounded text-white/40 hover:text-white/70 transition-colors"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${subExpanded ? 'rotate-90' : ''}`} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Inline delete confirm */}
        {confirmDelete && (
          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            <span className="text-white/50">Delete?</span>
            <button
              onClick={() => { onDelete?.(item.id); setConfirmDelete(false) }}
              className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold transition-all"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-0.5 rounded text-white/40 hover:text-white/70 transition-colors"
            >
              No
            </button>
          </div>
        )}
      </div>

      {/* Due date picker */}
      {dueOpen && onDueChange && (
        <div style={{ paddingLeft: `${28 + indent}px` }} className="pb-2 pr-2 flex flex-wrap gap-1.5 items-center">
          {DUE_PRESETS.map(preset => (
            <button key={preset}
              onClick={() => { onDueChange(item.id, resolveLabel(preset)); setDueOpen(false) }}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                item.due === resolveLabel(preset)
                  ? 'bg-navi-blue/20 border-navi-blue/40 text-navi-blue font-semibold'
                  : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/75'
              }`}
            >
              {preset}
            </button>
          ))}
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(item.due ?? '') ? (item.due ?? '') : ''}
            onChange={e => { if (e.target.value) { onDueChange(item.id, e.target.value); setDueOpen(false) } }}
            className="text-[11px] px-2 py-0.5 rounded-lg border border-white/10 bg-transparent text-white/55 focus:outline-none focus:border-navi-blue/50 [color-scheme:dark]"
          />
          {item.due && (
            <button onClick={() => { onDueChange(item.id, ''); setDueOpen(false) }}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-white/10 text-white/30 hover:text-white/55">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Note field */}
      {noteOpen && (
        <div style={{ paddingLeft: `${28 + indent}px` }} className="pb-1 pr-2">
          <textarea
            value={item.notes || ''}
            onChange={(e) => onNoteChange(item.id, e.target.value)}
            placeholder="Quick note..."
            rows={2}
            className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 placeholder-white/25 focus:outline-none focus:border-navi-blue/50 resize-none"
            autoFocus
          />
        </div>
      )}

      {/* Sub-items */}
      {item.subItems && item.subItems.length > 0 && subExpanded && (
        <div>
          {item.subItems.map((sub) => (
            <ChecklistItem
              key={sub.id}
              item={sub}
              depth={depth + 1}
              onToggle={onToggle}
              onNoteChange={onNoteChange}
              onLabelChange={onLabelChange}
              onUrgentChange={onUrgentChange}
              onDueChange={onDueChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
