'use client'

import { useState } from 'react'
import { Play, X } from 'lucide-react'
import { useWorkData } from '@/shared/lib/work-data-context'
import type { WorkArea, Effort } from '@/shared/types'
import type { WorkTemplate } from './data'

// ── Area accent classes ────────────────────────────────────────────────────────

const AREA_ACCENT: Record<WorkArea, { badge: string; btn: string }> = {
  finance: {
    badge: 'bg-finance/10 text-finance/70 border-finance/20',
    btn:   'bg-finance/15 border-finance/30 text-finance hover:bg-finance/25',
  },
  hr: {
    badge: 'bg-hr/10 text-hr/70 border-hr/20',
    btn:   'bg-hr/15 border-hr/30 text-hr hover:bg-hr/25',
  },
  ops: {
    badge: 'bg-ops/10 text-ops/70 border-ops/20',
    btn:   'bg-ops/15 border-ops/30 text-ops hover:bg-ops/25',
  },
  others: {
    badge: 'bg-others/10 text-others/70 border-others/20',
    btn:   'bg-others/15 border-others/30 text-others hover:bg-others/25',
  },
}

const effortDot: Record<Effort, string> = {
  quick: 'bg-green-500', medium: 'bg-yellow-500', heavy: 'bg-orange-500',
}

const DUE_PRESETS = ['Today', 'Tomorrow', 'This Week', 'Next Week'] as const

// ── Run Modal ─────────────────────────────────────────────────────────────────

function RunModal({ template, area, onClose }: {
  template: WorkTemplate
  area: WorkArea
  onClose: () => void
}) {
  const { addCycle } = useWorkData()
  const [name, setName] = useState(template.title)
  const [due, setDue]   = useState<string>('')
  const [done, setDone] = useState(false)

  const accent = AREA_ACCENT[area]

  const handleCreate = () => {
    if (!name.trim()) return
    const ts = Date.now()
    addCycle(area, {
      id:           `cycle-${ts}`,
      area,
      title:        name.trim(),
      effort:       template.effort,
      must:         template.must,
      urgent:       false,
      subArea:      template.subArea,
      triggerLabel: due,
      status:       'active',
      items: template.items.map((item, i) => ({
        id:       `${ts}-i${i}`,
        label:    item.label,
        status:   'todo' as const,
        effort:   template.effort,
        must:     false,
        optional: item.optional,
      })),
    })
    setDone(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-6 sm:pb-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e1e] border border-white/12 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Run template</p>
            <h2 className="text-[15px] font-semibold text-white leading-tight">{template.title}</h2>
            {template.subArea && (
              <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full border ${accent.badge}`}>
                {template.subArea}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-white/25 hover:text-white/55 -mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Cycle name */}
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-2">Cycle name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-2">Due date</label>
            <div className="flex gap-2 flex-wrap">
              {DUE_PRESETS.map(d => (
                <button key={d}
                  onClick={() => setDue(prev => prev === d ? '' : d)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    due === d
                      ? `${accent.btn} font-semibold`
                      : 'border-white/10 text-white/45 hover:border-white/25 hover:text-white/65'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Steps preview */}
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-widest mb-2">
              {template.items.length} steps included
            </p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {template.items.map(item => (
                <div key={item.id} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0 mt-1.5" />
                  <span className={`text-xs leading-relaxed ${
                    item.optional ? 'text-white/30 italic' : 'text-white/55'
                  }`}>
                    {item.label}
                    {item.optional && <span className="ml-1 not-italic text-white/20">(optional)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2 border-t border-white/6 pt-4">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/65 hover:border-white/20 transition-all">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || done}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              done
                ? 'bg-green-500/80 text-white'
                : name.trim()
                  ? 'bg-navi-blue text-white hover:bg-blue-600'
                  : 'bg-white/8 text-white/25 cursor-not-allowed'
            }`}
          >
            {done ? '✓ Cycle created' : 'Create Cycle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, area, onRun }: {
  template: WorkTemplate
  area: WorkArea
  onRun: () => void
}) {
  const accent = AREA_ACCENT[area]

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden hover:bg-white/5 transition-colors">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-semibold text-white/90 leading-tight">{template.title}</h3>
            <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{template.description}</p>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {template.subArea && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${accent.badge}`}>
                  {template.subArea}
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <span className={`w-1.5 h-1.5 rounded-full ${effortDot[template.effort]}`} />
                {template.effort}
              </span>
              <span className="text-[10px] text-white/25">{template.items.length} steps</span>
              {template.must && <span className="text-[10px] text-red-400/70">Must</span>}
            </div>
          </div>

          <button
            onClick={onRun}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${accent.btn}`}
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            Run
          </button>
        </div>

        {/* Steps preview */}
        <div className="mt-3 space-y-1">
          {template.items.slice(0, 3).map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white/12 flex-shrink-0" />
              <span className={`text-[11px] ${item.optional ? 'text-white/22 italic' : 'text-white/38'}`}>
                {item.label}
              </span>
            </div>
          ))}
          {template.items.length > 3 && (
            <p className="text-[10px] text-white/18 pl-3">+{template.items.length - 3} more steps</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

interface TemplatesViewProps {
  templates: WorkTemplate[]
  area: WorkArea
}

export function TemplatesView({ templates, area }: TemplatesViewProps) {
  const [running, setRunning] = useState<WorkTemplate | null>(null)

  return (
    <div className="px-6 pb-8">
      <div className="space-y-3">
        {templates.map(tmpl => (
          <TemplateCard
            key={tmpl.id}
            template={tmpl}
            area={area}
            onRun={() => setRunning(tmpl)}
          />
        ))}
      </div>

      {running && (
        <RunModal
          template={running}
          area={area}
          onClose={() => setRunning(null)}
        />
      )}
    </div>
  )
}
