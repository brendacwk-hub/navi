'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, Zap, AlertTriangle, FileText, FolderOpen, Calendar } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { resolveLabel } from '@/shared/lib/sort-utils'
import { RecurrencePicker, fmtRecurrDisplay } from './RecurrencePicker'
import type { PersonalArea, Effort } from '@/shared/types'

const PINK = '#f0a8c8'

const AREA_CONFIG: { value: PersonalArea; label: string; color: string }[] = [
  { value: 'housework',        label: 'Housework', color: '#fb7185' },
  { value: 'personal-finance', label: 'Finance',   color: '#22d3ee' },
  { value: 'sidoi',            label: 'Sidoi',     color: '#f9a8d4' },
  { value: 'tobuy',            label: 'To Buy',    color: '#fcd34d' },
  { value: 'personal-others',  label: 'Others',    color: '#fbbf24' },
]

const SIDOI_SUB_AREAS = ['Orders', 'Marketing', 'Planning']

type TaskType = 'task' | 'task+' | 'cycle' | 'pinned'
const TYPE_LABEL: Record<TaskType, string> = { task: 'Task', 'task+': 'Task+', cycle: 'Cycle', pinned: '📌 Pinned' }
const TYPE_HINT: Record<TaskType, string> = {
  task:    'What needs to be done?',
  'task+': 'Task title...',
  cycle:   'Cycle name...',
  pinned:  'Name this standing list...',
}
const SUB_HINT: Record<TaskType, string> = { task: '', 'task+': 'Sub-task', cycle: 'Step', pinned: 'Item' }

function pathnameArea(p: string): PersonalArea {
  if (p.startsWith('/personal/finance'))   return 'personal-finance'
  if (p.startsWith('/personal/sidoi'))     return 'sidoi'
  if (p.startsWith('/personal/tobuy'))     return 'tobuy'
  if (p.startsWith('/personal/others'))    return 'personal-others'
  return 'housework'
}

export function PersonalQuickAddButton() {
  const pathname = usePathname()
  const { addCycle } = usePersonalData()

  const [open, setOpen]               = useState(false)
  const [type, setType]               = useState<TaskType>('task')
  const [title, setTitle]             = useState('')
  const [area, setArea]               = useState<PersonalArea>(pathnameArea(pathname))
  const [subArea, setSubArea]         = useState('')
  const [effort, setEffort]           = useState<Effort>('medium')
  const [must, setMust]               = useState(false)
  const [urgent, setUrgent]           = useState(false)
  const [notes, setNotes]             = useState('')
  const [notesOpen, setNotesOpen]     = useState(false)
  const [subs, setSubs]               = useState<string[]>([''])
  const [dueLabel, setDueLabel]       = useState('')
  const [recurrLabel, setRecurrLabel] = useState('')
  const [saved, setSaved]             = useState(false)
  const [activePanel, setActivePanel] = useState<'subarea' | 'due' | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const subRefs  = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    const last = subRefs.current[subs.length - 1]
    if (last && subs[subs.length - 1] === '' && subs.length > 1) last.focus()
  }, [subs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (area !== 'sidoi') setSubArea('')
  }, [area])

  // Hide on pages that don't need an add button
  const hidden = /^\/(personal\/calendar|personal\/settings|personal\/diary|personal\/analytics|personal\/habits|personal\/ideas)/.test(pathname)
  if (hidden) return null

  const showSubs = type === 'task+' || type === 'cycle' || type === 'pinned'

  const reset = () => {
    setTitle(''); setSubs(['']); setType('task')
    setMust(false); setUrgent(false); setEffort('medium')
    setArea(pathnameArea(pathname)); setSubArea('')
    setNotes(''); setNotesOpen(false)
    setDueLabel(''); setRecurrLabel('')
    setActivePanel(null)
  }

  const handleClose = () => { setOpen(false); reset() }

  const handleSave = () => {
    if (!title.trim()) return
    const filled = subs.filter(s => s.trim())
    const ts     = Date.now()
    const id     = `${area}-${ts}`
    const base   = {
      id, area, title: title.trim(), effort, must, urgent,
      subArea: subArea || undefined,
      triggerLabel: recurrLabel || resolveLabel(dueLabel) || undefined,
      status: 'active' as const,
      notes: notes.trim() || undefined,
    }

    if (type === 'pinned') {
      addCycle(area, {
        ...base,
        triggerLabel: undefined,
        pinned: true,
        items: filled.length > 0
          ? filled.map((s, i) => ({ id: `item-${ts}-${i}`, label: s, status: 'todo' as const, effort, must: false }))
          : [],
      })
    } else if (type === 'task') {
      addCycle(area, { ...base, items: [{ id: `item-${ts}`, label: title.trim(), status: 'todo', effort, must }] })
    } else if (type === 'task+') {
      addCycle(area, {
        ...base,
        items: [{
          id: `item-${ts}`, label: title.trim(), status: 'todo', effort, must,
          subItems: filled.map((s, i) => ({ id: `sub-${ts}-${i}`, label: s, status: 'todo' as const })),
        }],
      })
    } else {
      addCycle(area, {
        ...base,
        items: filled.length > 0
          ? filled.map((s, i) => ({ id: `item-${ts}-${i}`, label: s, status: 'todo' as const, effort, must }))
          : [{ id: `item-${ts}`, label: title.trim(), status: 'todo', effort, must }],
      })
    }

    setSaved(true)
    setTimeout(() => { setSaved(false); handleClose() }, 700)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-6 w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
        style={{ backgroundColor: PINK, boxShadow: `0 4px 24px ${PINK}4d`, bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="w-5 h-5 text-white" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!title.trim()) handleClose() }} />

          <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-6">
            <div className="w-full max-w-lg">
              <div
                className="w-full bg-[#1e1e1e] border border-white/12 rounded-2xl shadow-2xl [overflow:clip]"
                onClick={e => e.stopPropagation()}
              >
                {/* Type tabs + close */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
                  <div className="flex items-center gap-1">
                    {(pathname === '/personal/today'
                      ? (['task', 'task+', 'cycle', 'pinned'] as TaskType[])
                      : (['task', 'task+', 'cycle'] as TaskType[])
                    ).map(t => (
                      <button key={t} onClick={() => setType(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all border ${
                          type === t
                            ? 'border-[#f0a8c8]/40 text-white bg-[#f0a8c8]/15'
                            : 'text-white/35 hover:text-white/60 border-transparent'
                        }`}
                      >
                        {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleClose} className="p-1 text-white/30 hover:text-white/60">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Title + subs */}
                <div className="px-5 pt-4 pb-3 space-y-3">
                  <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !showSubs) handleSave() }}
                    placeholder={TYPE_HINT[type]}
                    className="w-full bg-transparent text-white text-base font-medium placeholder-white/25 focus:outline-none"
                  />
                  {notesOpen && (
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Notes..."
                      rows={2}
                      autoFocus
                      className="w-full bg-transparent text-sm text-white/55 placeholder-white/25 focus:outline-none resize-none border-l-2 border-white/10 pl-3"
                    />
                  )}
                  {showSubs && (
                    <div className="border-l-2 border-white/10 pl-3 space-y-1.5">
                      {subs.map((val, idx) => (
                        <input
                          key={idx}
                          ref={el => { subRefs.current[idx] = el }}
                          type="text"
                          value={val}
                          onChange={e => { const next = [...subs]; next[idx] = e.target.value; setSubs(next) }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (val.trim() === '') { handleSave(); return }
                              if (idx === subs.length - 1) setSubs(prev => [...prev, ''])
                              else subRefs.current[idx + 1]?.focus()
                            }
                          }}
                          placeholder={`${SUB_HINT[type]} ${idx + 1}`}
                          className="w-full bg-transparent text-sm text-white/70 placeholder-white/25 focus:outline-none"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                <div className="px-5 pb-3 border-t border-white/6 pt-3 space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <button
                      onClick={() => setUrgent(u => !u)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        urgent ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Urgent
                    </button>

                    {type !== 'pinned' && (
                    <button
                      onClick={() => setActivePanel(p => p === 'due' ? null : 'due')}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        dueLabel || recurrLabel
                          ? 'border-[#f0a8c8]/40 text-[#f0a8c8] bg-[#f0a8c8]/10'
                          : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {recurrLabel ? fmtRecurrDisplay(recurrLabel) : dueLabel || 'Date'}
                    </button>
                    )}

                    {area === 'sidoi' && (
                      <button
                        onClick={() => setActivePanel(p => p === 'subarea' ? null : 'subarea')}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          subArea
                            ? 'border-[#f9a8d4]/40 text-[#f9a8d4] bg-[#f9a8d4]/10'
                            : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        {subArea || 'Sub-area'}
                      </button>
                    )}

                    <button
                      onClick={() => { setNotesOpen(o => !o); setActivePanel(null) }}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        notesOpen || notes
                          ? 'border-[#f0a8c8]/40 text-[#f0a8c8] bg-[#f0a8c8]/10'
                          : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Notes
                    </button>
                  </div>

                  {/* Due date panel */}
                  {activePanel === 'due' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        {(['Today', 'Tomorrow', 'In 2 Days'] as const).map(d => (
                          <button key={d}
                            onClick={() => { setDueLabel(resolveLabel(d)); setRecurrLabel(''); setActivePanel(null) }}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                              !recurrLabel && dueLabel === resolveLabel(d)
                                ? 'bg-[#f0a8c8]/20 border-[#f0a8c8]/40 text-[#f0a8c8] font-semibold'
                                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
                            }`}
                          >{d}</button>
                        ))}
                        <input
                          type="date"
                          value={!recurrLabel && /^\d{4}-\d{2}-\d{2}$/.test(dueLabel) ? dueLabel : ''}
                          onChange={e => { if (e.target.value) { setDueLabel(e.target.value); setRecurrLabel(''); setActivePanel(null) } }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-white/50 focus:outline-none focus:border-[#f0a8c8]/40 [color-scheme:dark]"
                        />
                        {(dueLabel || recurrLabel) && (
                          <button
                            onClick={() => { setDueLabel(''); setRecurrLabel(''); setActivePanel(null) }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/35 hover:border-white/25 hover:text-white/55 transition-all"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <RecurrencePicker
                        value={recurrLabel}
                        onChange={val => { setRecurrLabel(val); if (val) { setDueLabel(''); setActivePanel(null) } }}
                      />
                    </div>
                  )}

                  {/* Sidoi sub-area panel */}
                  {activePanel === 'subarea' && area === 'sidoi' && (
                    <div className="flex flex-wrap gap-2">
                      {SIDOI_SUB_AREAS.map(s => (
                        <button key={s}
                          onClick={() => { setSubArea(prev => prev === s ? '' : s); setActivePanel(null) }}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                            subArea === s
                              ? 'bg-[#f9a8d4]/20 border-[#f9a8d4]/40 text-[#f9a8d4] font-semibold'
                              : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
                          }`}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Area + effort + must */}
                <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-white/6 pt-3">
                  {AREA_CONFIG.map(ac => (
                    <button
                      key={ac.value}
                      onClick={() => setArea(ac.value)}
                      className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all"
                      style={area === ac.value
                        ? { borderColor: `${ac.color}66`, color: ac.color, backgroundColor: `${ac.color}1a` }
                        : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }
                      }
                    >
                      {ac.label}
                    </button>
                  ))}
                </div>

                <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-white/6 pt-2">
                  {(['quick', 'medium', 'heavy'] as Effort[]).map(e => (
                    <button key={e} onClick={() => setEffort(e)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium capitalize ${
                        effort === e
                          ? e === 'quick'  ? 'bg-green-500/20 text-green-400 border-green-500/40'
                          : e === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                          :                  'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          : 'border-white/10 text-white/35 hover:border-white/25'
                      }`}
                    >{e}</button>
                  ))}
                  <button
                    onClick={() => setMust(m => !m)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                      must ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'border-white/10 text-white/35 hover:border-white/25'
                    }`}
                  >
                    <Zap className="w-2.5 h-2.5" /> Must
                  </button>
                </div>

                {/* Footer */}
                <div className="px-5 pb-4 flex items-center gap-2 border-t border-white/6 pt-3">
                  <div className="flex-1" />
                  <button onClick={handleClose}
                    className="text-xs px-4 py-2 rounded-lg text-white/40 hover:text-white/65 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!title.trim()}
                    className="text-xs px-5 py-2 rounded-lg font-semibold transition-all"
                    style={saved
                      ? { backgroundColor: '#22c55e', color: '#fff' }
                      : title.trim()
                        ? { backgroundColor: PINK, color: '#fff' }
                        : { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }
                    }
                  >
                    {saved ? '✓ Saved' : `Add ${TYPE_LABEL[type]}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
