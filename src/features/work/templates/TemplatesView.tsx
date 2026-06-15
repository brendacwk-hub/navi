'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, X, Plus, Pencil } from 'lucide-react'
import { useWorkData } from '@/shared/lib/work-data-context'
import { resolveLabel } from '@/shared/lib/sort-utils'
import type { WorkArea, Effort } from '@/shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateStep {
  id: string
  label: string
  optional?: boolean
}

export interface WorkTemplate {
  id: string
  title: string
  description: string
  area: WorkArea
  subArea?: string
  effort: Effort
  must: boolean
  items: TemplateStep[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUB_AREAS: Record<WorkArea, string[]> = {
  finance: ['Payments', 'Budgets', 'Administrative', 'Records', 'AI'],
  hr: ['Payroll & MPF', 'Insurance & VISA', 'Leave & Attendance', 'Onboarding & Offboarding', 'Tax', 'Records', 'AI'],
  ops: ['Vendor & Contracts', 'Expenses', 'Arrangements', 'AI'],
  others: [],
}

const AREA_ACCENT: Record<WorkArea, { badge: string; btn: string }> = {
  finance: { badge: 'bg-finance/10 text-finance/70 border-finance/20', btn: 'bg-finance/15 border-finance/30 text-finance hover:bg-finance/25' },
  hr:      { badge: 'bg-hr/10 text-hr/70 border-hr/20',               btn: 'bg-hr/15 border-hr/30 text-hr hover:bg-hr/25' },
  ops:     { badge: 'bg-ops/10 text-ops/70 border-ops/20',             btn: 'bg-ops/15 border-ops/30 text-ops hover:bg-ops/25' },
  others:  { badge: 'bg-others/10 text-others/70 border-others/20',    btn: 'bg-others/15 border-others/30 text-others hover:bg-others/25' },
}

const EFFORT_OPTIONS: Effort[] = ['quick', 'medium', 'heavy']
const effortDot: Record<Effort, string> = { quick: 'bg-green-500', medium: 'bg-yellow-500', heavy: 'bg-orange-500' }
const DUE_PRESETS = ['Today', 'Tomorrow', 'This Week', 'Next Week'] as const

// ── DB helpers ────────────────────────────────────────────────────────────────

async function loadTemplates(area: WorkArea): Promise<WorkTemplate[]> {
  try {
    const res = await fetch(`/api/db?table=template_collections&eqCol=id&eqVal=${area}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data?.[0] as any)?.templates ?? []
  } catch { return [] }
}

function saveTemplates(area: WorkArea, templates: WorkTemplate[]) {
  fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'template_collections', operation: 'upsert', data: { id: area, templates } }),
  }).catch(() => {})
}

function newTemplate(area: WorkArea): WorkTemplate {
  return { id: `tmpl-${Date.now()}`, title: '', description: '', area, effort: 'medium', must: false, items: [{ id: `s-${Date.now()}`, label: '' }] }
}

// ── Template Form Modal ───────────────────────────────────────────────────────

function TemplateFormModal({ initial, area, onSave, onDelete, onClose }: {
  initial: WorkTemplate
  area: WorkArea
  onSave: (t: WorkTemplate) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [tmpl, setTmpl] = useState<WorkTemplate>({ ...initial, items: initial.items.map(i => ({ ...i })) })
  const isNew = !initial.title

  function setField<K extends keyof WorkTemplate>(k: K, v: WorkTemplate[K]) {
    setTmpl(prev => ({ ...prev, [k]: v }))
  }
  const setStep = (idx: number, patch: Partial<TemplateStep>) =>
    setTmpl(prev => ({ ...prev, items: prev.items.map((item, i) => i === idx ? { ...item, ...patch } : item) }))
  const addStep = () =>
    setTmpl(prev => ({ ...prev, items: [...prev.items, { id: `s-${Date.now()}`, label: '' }] }))
  const removeStep = (idx: number) =>
    setTmpl(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const canSave = tmpl.title.trim() && tmpl.items.some(s => s.label.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-6 sm:pb-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e1e] border border-white/12 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 flex-shrink-0">
          <p className="text-[13px] font-semibold text-white">{isNew ? 'New Template' : 'Edit Template'}</p>
          <button onClick={onClose} className="p-1 text-white/25 hover:text-white/55">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-1.5">Title *</label>
            <input
              value={tmpl.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="e.g. Payment Request"
              autoFocus
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-1.5">Description</label>
            <input
              value={tmpl.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Short description"
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Sub-area + Effort */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-1.5">Sub-area</label>
              <select
                value={tmpl.subArea ?? ''}
                onChange={e => setField('subArea', e.target.value || undefined)}
                className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-colors"
              >
                <option value="">None</option>
                {SUB_AREAS[area].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-1.5">Effort</label>
              <div className="flex gap-1">
                {EFFORT_OPTIONS.map(e => (
                  <button key={e} onClick={() => setField('effort', e)}
                    className={`flex-1 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                      tmpl.effort === e ? 'border-white/30 bg-white/10 text-white' : 'border-white/8 text-white/35 hover:border-white/20'
                    }`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mb-px mr-0.5 ${effortDot[e]}`} />
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Must toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Mark as Must</span>
            <button onClick={() => setField('must', !tmpl.must)}
              className={`relative w-10 h-6 rounded-full transition-all ${tmpl.must ? 'bg-red-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${tmpl.must ? 'left-5' : 'left-1'}`} />
            </button>
          </div>

          {/* Steps */}
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-2">Steps *</label>
            <div className="space-y-2">
              {tmpl.items.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2">
                  <span className="text-white/20 text-[11px] w-4 text-center flex-shrink-0">{idx + 1}</span>
                  <input
                    value={step.label}
                    onChange={e => setStep(idx, { label: e.target.value })}
                    placeholder={`Step ${idx + 1}`}
                    className="flex-1 bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                  />
                  <button
                    onClick={() => setStep(idx, { optional: !step.optional })}
                    className={`flex-shrink-0 text-[10px] px-2 py-1 rounded border transition-all ${
                      step.optional ? 'border-white/25 text-white/50 bg-white/8' : 'border-white/10 text-white/20 hover:border-white/20'
                    }`}
                  >
                    opt
                  </button>
                  {tmpl.items.length > 1 && (
                    <button onClick={() => removeStep(idx)} className="flex-shrink-0 text-white/20 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addStep} className="mt-2 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
              <Plus className="w-3 h-3" />
              Add step
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-white/6 flex-shrink-0 space-y-2">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/65 hover:border-white/20 transition-all">
              Cancel
            </button>
            <button
              onClick={() => canSave && onSave(tmpl)}
              disabled={!canSave}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                canSave ? 'bg-navi-blue text-white hover:bg-blue-600' : 'bg-white/8 text-white/25 cursor-not-allowed'
              }`}
            >
              {isNew ? 'Create Template' : 'Save Changes'}
            </button>
          </div>
          {onDelete && (
            <button onClick={onDelete} className="w-full py-2 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/8 border border-transparent hover:border-red-500/20 transition-all">
              Delete Template
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Run Modal ─────────────────────────────────────────────────────────────────

function RunModal({ template, area, onClose }: { template: WorkTemplate; area: WorkArea; onClose: () => void }) {
  const { addCycle } = useWorkData()
  const [name, setName] = useState(template.title)
  const [due, setDue] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)
  const accent = AREA_ACCENT[area]

  const handleCreate = () => {
    if (!name.trim()) return
    const ts = Date.now()
    addCycle(area, {
      id: `cycle-${ts}`, area, title: name.trim(), effort: template.effort,
      must: template.must, urgent, subArea: template.subArea, triggerLabel: resolveLabel(due), status: 'active',
      notes: notes.trim() || undefined,
      items: template.items.map((item, i) => ({ id: `${ts}-i${i}`, label: item.label, status: 'todo' as const, effort: template.effort, must: false, optional: item.optional })),
    })
    setDone(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-6 sm:pb-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e1e1e] border border-white/12 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Run template</p>
            <h2 className="text-[15px] font-semibold text-white leading-tight">{template.title}</h2>
            {template.subArea && <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full border ${accent.badge}`}>{template.subArea}</span>}
          </div>
          <button onClick={onClose} className="p-1 text-white/25 hover:text-white/55 -mt-0.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-2">Cycle name</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-2">Due date</label>
            <div className="flex gap-2 flex-wrap">
              {DUE_PRESETS.map(d => (
                <button key={d} onClick={() => setDue(prev => prev === d ? '' : d)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${due === d ? `${accent.btn} font-semibold` : 'border-white/10 text-white/45 hover:border-white/25'}`}>{d}</button>
              ))}
            </div>
          </div>
          {/* Urgent + Notes */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Urgent</span>
            <button onClick={() => setUrgent(u => !u)}
              className={`relative w-10 h-6 rounded-full transition-all ${urgent ? 'bg-orange-500' : 'bg-white/15'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${urgent ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
          <div>
            <label className="block text-[11px] text-white/35 uppercase tracking-widest mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none"
            />
          </div>

          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-widest mb-2">{template.items.length} steps</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {template.items.map(item => (
                <div key={item.id} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0 mt-1.5" />
                  <span className={`text-xs leading-relaxed ${item.optional ? 'text-white/30 italic' : 'text-white/55'}`}>
                    {item.label}{item.optional && <span className="ml-1 not-italic text-white/20">(optional)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2 border-t border-white/6 pt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/65 hover:border-white/20 transition-all">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || done}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${done ? 'bg-green-500/80 text-white' : name.trim() ? 'bg-navi-blue text-white hover:bg-blue-600' : 'bg-white/8 text-white/25 cursor-not-allowed'}`}>
            {done ? '✓ Cycle created' : 'Create Cycle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, area, onRun, onEdit }: {
  template: WorkTemplate; area: WorkArea; onRun: () => void; onEdit: () => void
}) {
  const accent = AREA_ACCENT[area]
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden hover:bg-white/5 transition-colors">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-semibold text-white/90 leading-tight">{template.title}</h3>
            {template.description && <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{template.description}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {template.subArea && <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${accent.badge}`}>{template.subArea}</span>}
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <span className={`w-1.5 h-1.5 rounded-full ${effortDot[template.effort]}`} />
                {template.effort}
              </span>
              <span className="text-[10px] text-white/25">{template.items.length} steps</span>
              {template.must && <span className="text-[10px] text-red-400/70">Must</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={onRun} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${accent.btn}`}>
              <Play className="w-2.5 h-2.5 fill-current" />Run
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:border-white/25 hover:text-white/65 transition-all">
              <Pencil className="w-2.5 h-2.5" />Edit
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {template.items.slice(0, 3).map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white/12 flex-shrink-0" />
              <span className={`text-[11px] ${item.optional ? 'text-white/22 italic' : 'text-white/38'}`}>{item.label}</span>
            </div>
          ))}
          {template.items.length > 3 && <p className="text-[10px] text-white/18 pl-3">+{template.items.length - 3} more steps</p>}
        </div>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function TemplatesView({ area }: { area: WorkArea }) {
  const [templates, setTemplates] = useState<WorkTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<WorkTemplate | null>(null)
  const [editing, setEditing] = useState<WorkTemplate | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadTemplates(area).then(t => { setTemplates(t); setLoading(false) })
  }, [area])

  const persist = useCallback((updated: WorkTemplate[]) => {
    setTemplates(updated)
    saveTemplates(area, updated)
  }, [area])

  const handleSave = (tmpl: WorkTemplate) => {
    const idx = templates.findIndex(t => t.id === tmpl.id)
    persist(idx >= 0 ? templates.map(t => t.id === tmpl.id ? tmpl : t) : [...templates, tmpl])
    setEditing(null)
    setAdding(false)
  }

  const handleDelete = (id: string) => {
    persist(templates.filter(t => t.id !== id))
    setEditing(null)
  }

  return (
    <div className="px-6 pb-8 pt-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navi-blue/15 border border-navi-blue/30 text-navi-blue text-xs font-semibold hover:bg-navi-blue/25 transition-all">
          <Plus className="w-3.5 h-3.5" />
          Add Template
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-white/30">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-white/30">No templates yet</p>
          <p className="text-xs text-white/20 mt-1">Tap Add Template to create your first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tmpl => (
            <TemplateCard key={tmpl.id} template={tmpl} area={area}
              onRun={() => setRunning(tmpl)} onEdit={() => setEditing(tmpl)} />
          ))}
        </div>
      )}

      {running && <RunModal template={running} area={area} onClose={() => setRunning(null)} />}
      {editing && <TemplateFormModal initial={editing} area={area} onSave={handleSave} onDelete={() => handleDelete(editing.id)} onClose={() => setEditing(null)} />}
      {adding && <TemplateFormModal initial={newTemplate(area)} area={area} onSave={handleSave} onClose={() => setAdding(false)} />}
    </div>
  )
}
