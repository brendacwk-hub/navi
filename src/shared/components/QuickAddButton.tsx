'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, X, Zap, AlertTriangle, FileText, FolderOpen, Send, Calendar } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useWorkData } from '@/shared/lib/work-data-context'
import { useInbox } from '@/shared/lib/inbox-context'
import type { WorkArea, Effort } from '@/shared/types'

type TaskType = 'task' | 'task+' | 'cycle'

const SUB_AREAS: Partial<Record<WorkArea, string[]>> = {
  finance: ['Payments', 'Budgets', 'Administrative', 'Records', 'AI'],
  hr: ['Payroll & MPF', 'Insurance & VISA', 'Leave & Attendance', 'Onboarding & Offboarding', 'Tax', 'Records', 'AI'],
  ops: ['Vendor & Contracts', 'Expenses', 'Arrangements'],
}

const TYPE_CYCLE_ALL: TaskType[] = ['task', 'task+', 'cycle']
const TYPE_CYCLE_TODAY: TaskType[] = ['task', 'task+']
const TYPE_LABEL: Record<TaskType, string> = { task: 'Task', 'task+': 'Task+', cycle: 'Cycle' }
const TYPE_HINT: Record<TaskType, string> = {
  task: 'What needs to be done?',
  'task+': 'Task title...',
  cycle: 'Cycle name...',
}
const SUB_HINT: Record<TaskType, string> = { task: '', 'task+': 'Sub-task', cycle: 'Step' }

const areaColors: Record<WorkArea, string> = {
  finance: 'bg-finance/20 text-finance border-finance/40',
  hr:      'bg-hr/20 text-hr border-hr/40',
  ops:     'bg-ops/20 text-ops border-ops/40',
  others:  'bg-others/20 text-others border-others/40',
}

function pathnameArea(p: string): WorkArea {
  if (p.startsWith('/work/hr'))     return 'hr'
  if (p.startsWith('/work/ops'))    return 'ops'
  if (p.startsWith('/work/others')) return 'others'
  return 'finance'
}

export function QuickAddButton() {
  const pathname = usePathname()
  const { addCycle, addTodayTask, financeCycles, hrCycles, opsCycles, othersCycles } = useWorkData()
  const { addItem: addInboxItem } = useInbox()

  const isToday  = pathname === '/work'
  const typeCycle = TYPE_CYCLE_ALL

  const [open, setOpen]               = useState(false)
  const [type, setType]               = useState<TaskType>('task')
  const [title, setTitle]             = useState('')
  const [area, setArea]               = useState<WorkArea>(pathnameArea(pathname))
  const [subArea, setSubArea]         = useState('')
  const [effort, setEffort]           = useState<Effort>('medium')
  const [must, setMust]               = useState(false)
  const [urgent, setUrgent]           = useState(false)
  const [notes, setNotes]             = useState('')
  const [notesOpen, setNotesOpen]     = useState(false)
  const [subs, setSubs]               = useState<string[]>([''])
  const [dueLabel, setDueLabel]       = useState<string>(isToday ? 'Today' : '')
  const [saved, setSaved]             = useState(false)
  const [inboxSent, setInboxSent]     = useState(false)
  const [activePanel, setActivePanel] = useState<'subarea' | 'due' | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const subRefs  = useRef<(HTMLInputElement | null)[]>([])

  // Build suggestion corpus from all cycle titles and checklist item labels
  const corpus = useMemo(() => {
    const all = [...financeCycles, ...hrCycles, ...opsCycles, ...othersCycles]
    const seen = new Set<string>()
    const result: { label: string; area: WorkArea; subArea?: string }[] = []
    for (const c of all) {
      if (!seen.has(c.title)) {
        seen.add(c.title)
        result.push({ label: c.title, area: c.area as WorkArea, subArea: c.subArea })
      }
      for (const item of c.items ?? []) {
        if (item.label && !seen.has(item.label)) {
          seen.add(item.label)
          result.push({ label: item.label, area: c.area as WorkArea, subArea: c.subArea })
        }
      }
    }
    return result
  }, [financeCycles, hrCycles, opsCycles, othersCycles])

  const suggestions = useMemo(() => {
    if (!open || title.length < 2) return []
    const q = title.toLowerCase()
    return corpus
      .filter(s => s.label.toLowerCase().includes(q) && s.label.toLowerCase() !== q)
      .slice(0, 5)
  }, [title, corpus, open])

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    const last = subRefs.current[subs.length - 1]
    if (last && subs[subs.length - 1] === '' && subs.length > 1) last.focus()
  }, [subs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSubArea(prev => {
      const opts = SUB_AREAS[area] ?? []
      return opts.includes(prev) ? prev : ''
    })
  }, [area])

  if (pathname === '/work/inbox') return null

  const showSubs = type === 'task+' || type === 'cycle'

  const handleSubChange = (idx: number, val: string) => {
    const next = [...subs]
    next[idx] = val
    if (idx === next.length - 1 && val.trim() !== '') next.push('')
    setSubs(next)
  }

  const reset = () => {
    setTitle(''); setSubs(['']); setType('task')
    setMust(false); setUrgent(false); setEffort('medium')
    setArea(pathnameArea(pathname)); setSubArea('')
    setNotes(''); setNotesOpen(false)
    setDueLabel(isToday ? 'Today' : '')
    setActivePanel(null)
  }

  const handleClose = () => { setOpen(false); reset() }

  const handleSave = () => {
    if (!title.trim()) return
    const filled = subs.filter(s => s.trim())
    const ts = Date.now()
    const id = `cycle-${ts}`
    const base = {
      id, area, title: title.trim(), effort, must, urgent,
      subArea: subArea || undefined,
      triggerLabel: dueLabel,
      status: 'active' as const,
      notes: notes.trim() || undefined,
    }

    if (type === 'task') {
      addCycle(area, {
        ...base,
        items: [{ id: `item-${ts}`, label: title.trim(), status: 'todo', effort, must }],
      })
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

    // Also add a today_task so it appears in the Due Today list on the Today view
    if (isToday && dueLabel === 'Today') {
      addTodayTask({
        label: title.trim(), area, effort, must, urgent,
        due: 'Today',
        notes: notes.trim() || undefined,
        subItems: showSubs && filled.length > 0
          ? filled.map((s, i) => ({ id: `sub-t-${ts}-${i}`, label: s, done: false }))
          : undefined,
      })
    }

    setSaved(true)
    setTimeout(() => { setSaved(false); handleClose() }, 700)
  }

  const handleSendToInbox = () => {
    if (!title.trim()) return
    addInboxItem(title.trim())
    setInboxSent(true)
    setTimeout(() => { setInboxSent(false); handleClose() }, 700)
  }

  const togglePanel = (panel: 'subarea' | 'due') => {
    setActivePanel(p => p === panel ? null : panel)
  }

  const toolbarBtn = (active: boolean, activeClass: string) =>
    `flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
      active ? activeClass : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
    }`

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-navi-blue shadow-lg shadow-navi-blue/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus className="w-5 h-5 text-white" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          {/* Content: suggestion strip + card, stacked at bottom */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center px-4 pb-6">
            <div className="w-full max-w-lg flex flex-col gap-2">

              {/* AI suggestion strip — floats above the card while typing */}
              {suggestions.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-none px-0.5 pb-0.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTitle(s.label)
                        setArea(s.area)
                        if (s.subArea) setSubArea(s.subArea)
                        setTimeout(() => titleRef.current?.focus(), 0)
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1c1c1c] border border-navi-blue/20 text-[11px] text-white/60 hover:border-navi-blue/40 hover:text-white/85 transition-all whitespace-nowrap shadow-lg"
                    >
                      <span className="text-navi-blue text-[9px]">✦</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Main card */}
              <div
                className="w-full bg-[#1e1e1e] border border-white/12 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header: type tabs + close */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
                  <div className="flex items-center gap-1">
                    {typeCycle.map(t => (
                      <button key={t} onClick={() => setType(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          type === t
                            ? 'bg-navi-blue/20 text-navi-blue border border-navi-blue/40'
                            : 'text-white/35 hover:text-white/60 border border-transparent'
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

                {/* Body: title, notes, sub-items */}
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
                      placeholder="Notes, context, amounts..."
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
                          onChange={e => handleSubChange(idx, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (val.trim() === '') { handleSave(); return }
                              subRefs.current[idx + 1]?.focus()
                            }
                          }}
                          placeholder={`${SUB_HINT[type]} ${idx + 1}`}
                          className="w-full bg-transparent text-sm text-white/70 placeholder-white/25 focus:outline-none"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Action toolbar — TickTick-style icon row */}
                <div className="px-5 pb-3 border-t border-white/6 pt-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">

                    <button onClick={() => setUrgent(u => !u)}
                      className={toolbarBtn(urgent, 'bg-orange-500/20 border-orange-500/30 text-orange-400')}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Urgent
                    </button>

                    <button onClick={() => togglePanel('due')}
                      className={toolbarBtn(!!dueLabel, 'bg-navi-blue/20 border-navi-blue/40 text-navi-blue')}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {dueLabel || 'Date'}
                    </button>

                    {(SUB_AREAS[area]?.length ?? 0) > 0 && (
                      <button onClick={() => togglePanel('subarea')}
                        className={toolbarBtn(!!subArea, areaColors[area])}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        {subArea || 'Sub-area'}
                      </button>
                    )}

                    <button onClick={() => { setNotesOpen(o => !o); setActivePanel(null) }}
                      className={toolbarBtn(notesOpen || !!notes, 'bg-navi-blue/15 border-navi-blue/30 text-navi-blue')}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Notes
                    </button>
                  </div>

                  {/* Due date inline panel */}
                  {activePanel === 'due' && (
                    <div className="pt-3 flex flex-wrap gap-2">
                      {(['Today', 'Tomorrow', 'This Week', 'Next Week'] as const).map(d => (
                        <button key={d}
                          onClick={() => { setDueLabel(prev => prev === d ? '' : d); setActivePanel(null) }}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                            dueLabel === d
                              ? 'bg-navi-blue/20 border-navi-blue/40 text-navi-blue font-semibold'
                              : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                      {dueLabel && (
                        <button
                          onClick={() => { setDueLabel(''); setActivePanel(null) }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/35 hover:border-white/25 hover:text-white/55 transition-all"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* Sub-area inline panel */}
                  {activePanel === 'subarea' && (
                    <div className="pt-3 flex flex-wrap gap-2">
                      {SUB_AREAS[area]?.map(s => (
                        <button key={s}
                          onClick={() => { setSubArea(prev => prev === s ? '' : s); setActivePanel(null) }}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                            subArea === s
                              ? areaColors[area] + ' font-semibold'
                              : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                </div>

                {/* Meta row: area, effort, must */}
                <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-white/6 pt-3">
                  <select
                    value={area}
                    onChange={e => setArea(e.target.value as WorkArea)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent cursor-pointer focus:outline-none ${areaColors[area]}`}
                  >
                    <option value="finance">Finance</option>
                    <option value="hr">HR</option>
                    <option value="ops">Ops</option>
                    <option value="others">Others</option>
                  </select>

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

                  <button onClick={() => setMust(m => !m)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                      must ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'border-white/10 text-white/35 hover:border-white/25'
                    }`}
                  >
                    <Zap className="w-2.5 h-2.5" /> Must
                  </button>
                </div>

                {/* Footer: Inbox link + Cancel + Add */}
                <div className="px-5 pb-4 flex items-center gap-2 border-t border-white/6 pt-3">
                  <button onClick={handleSendToInbox} disabled={!title.trim()}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      !title.trim() ? 'text-white/20 cursor-not-allowed' : 'text-white/35 hover:text-white/60'
                    }`}
                  >
                    <Send className="w-3 h-3" />
                    {inboxSent ? 'Sent!' : 'Inbox'}
                  </button>
                  <div className="flex-1" />
                  <button onClick={handleClose}
                    className="text-xs px-4 py-2 rounded-lg text-white/40 hover:text-white/65 transition-colors"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={!title.trim()}
                    className={`text-xs px-5 py-2 rounded-lg font-semibold transition-all ${
                      saved           ? 'bg-green-500 text-white'
                      : title.trim() ? 'bg-navi-blue text-white hover:bg-blue-600'
                      :                'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
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
