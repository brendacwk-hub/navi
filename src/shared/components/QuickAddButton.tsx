'use client'

import { useState } from 'react'
import { Plus, X, Zap } from 'lucide-react'
import { usePathname } from 'next/navigation'

type Area = 'finance' | 'hr' | 'ops' | 'others'
type Effort = 'quick' | 'medium' | 'heavy'

interface NewTask {
  title: string
  area: Area
  effort: Effort
  must: boolean
  due: string
  notes: string
}

const defaultTask: NewTask = {
  title: '',
  area: 'finance',
  effort: 'medium',
  must: false,
  due: '',
  notes: '',
}

const areaColors: Record<Area, string> = {
  finance: 'bg-finance/20 text-finance border-finance/40',
  hr: 'bg-hr/20 text-hr border-hr/40',
  ops: 'bg-ops/20 text-ops border-ops/40',
  others: 'bg-others/20 text-others border-others/40',
}

export function QuickAddButton({ defaultArea = 'finance' }: { defaultArea?: Area }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState<NewTask>({ ...defaultTask, area: defaultArea })
  const [saved, setSaved] = useState(false)

  if (pathname === '/work/inbox') return null

  const handleSave = () => {
    if (!task.title.trim()) return
    // TODO: POST to /api/tasks when backend is ready
    console.log('New task:', task)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setOpen(false)
      setTask({ ...defaultTask, area: defaultArea })
    }, 800)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-navi-blue shadow-lg shadow-navi-blue/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
        title="Add task (⌘N)"
      >
        <Plus className="w-5 h-5 text-white" />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-[#1e1e1e] border border-white/12 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
              <span className="text-sm font-semibold text-white/80">New Task</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded text-white/30 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <input
                autoFocus
                type="text"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="What needs to be done?"
                className="w-full bg-transparent text-white text-base font-medium placeholder-white/25 focus:outline-none"
              />

              {/* Row: Area + Effort + Must */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Area */}
                <select
                  value={task.area}
                  onChange={(e) => setTask({ ...task, area: e.target.value as Area })}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent cursor-pointer focus:outline-none ${areaColors[task.area]}`}
                >
                  <option value="finance">Finance</option>
                  <option value="hr">HR</option>
                  <option value="ops">Ops</option>
                  <option value="others">Others</option>
                </select>

                {/* Effort */}
                {(['quick', 'medium', 'heavy'] as Effort[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setTask({ ...task, effort: e })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium capitalize ${
                      task.effort === e
                        ? e === 'quick' ? 'bg-green-500/20 text-green-400 border-green-500/40'
                          : e === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                        : 'border-white/10 text-white/35 hover:border-white/25'
                    }`}
                  >
                    {e}
                  </button>
                ))}

                {/* Must toggle */}
                <button
                  onClick={() => setTask({ ...task, must: !task.must })}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                    task.must
                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'border-white/10 text-white/35 hover:border-white/25'
                  }`}
                >
                  <Zap className="w-2.5 h-2.5" /> Must
                </button>
              </div>

              {/* Due date */}
              <input
                type="text"
                value={task.due}
                onChange={(e) => setTask({ ...task, due: e.target.value })}
                placeholder="Due date — e.g. Friday, end of month, 20th"
                className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-xs text-white/60 placeholder-white/25 focus:outline-none focus:border-white/20"
              />

              {/* Notes */}
              <input
                type="text"
                value={task.notes}
                onChange={(e) => setTask({ ...task, notes: e.target.value })}
                placeholder="Notes (optional)"
                className="w-full bg-transparent text-xs text-white/40 placeholder-white/20 focus:outline-none"
              />
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-4 py-2 rounded-lg text-white/40 hover:text-white/65 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!task.title.trim()}
                className={`text-xs px-5 py-2 rounded-lg font-semibold transition-all ${
                  saved ? 'bg-green-500 text-white'
                  : task.title.trim() ? 'bg-navi-blue text-white hover:bg-blue-600'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                {saved ? '✓ Saved' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
