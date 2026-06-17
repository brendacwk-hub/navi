'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import {
  loadTemplates, saveTemplates, newTemplate,
  TemplateCard, TemplateFormModal, RunModal,
  type WorkTemplate,
} from './TemplatesView'
import { computeSortDate } from '@/shared/lib/sort-utils'
import type { WorkArea } from '@/shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type AreaFilter = WorkArea | null
type EffortFilter = 'All' | 'Quick' | 'Medium' | 'Heavy' | 'Must'

// ── Constants ─────────────────────────────────────────────────────────────────

const AREAS: { value: WorkArea; label: string; active: string; inactive: string }[] = [
  { value: 'finance', label: 'Finance', active: 'bg-finance/15 border-finance/30 text-finance', inactive: 'border-transparent text-white/35 hover:text-white/60' },
  { value: 'hr',      label: 'HR',      active: 'bg-hr/15 border-hr/30 text-hr',               inactive: 'border-transparent text-white/35 hover:text-white/60' },
  { value: 'ops',     label: 'Ops',     active: 'bg-ops/15 border-ops/30 text-ops',             inactive: 'border-transparent text-white/35 hover:text-white/60' },
  { value: 'others',  label: 'Others',  active: 'bg-others/15 border-others/30 text-others',    inactive: 'border-transparent text-white/35 hover:text-white/60' },
]

const AREA_ORDER: Record<WorkArea, number> = { finance: 0, hr: 1, ops: 2, others: 3 }

const EFFORT_FILTERS: EffortFilter[] = ['All', 'Quick', 'Medium', 'Heavy', 'Must']

// ── Sort ──────────────────────────────────────────────────────────────────────

function sortTemplates(templates: WorkTemplate[]): WorkTemplate[] {
  return [...templates].sort((a, b) => {
    const aTime = a.triggerLabel ? computeSortDate(a.triggerLabel) : null
    const bTime = b.triggerLabel ? computeSortDate(b.triggerLabel) : null
    if (aTime !== null && bTime === null) return -1
    if (aTime === null && bTime !== null) return 1
    if (aTime !== null && bTime !== null) return aTime - bTime
    return AREA_ORDER[a.area] - AREA_ORDER[b.area]
  })
}

// ── Hub View ──────────────────────────────────────────────────────────────────

type AllTemplates = Record<WorkArea, WorkTemplate[]>

export function TemplatesHubView() {
  const [all, setAll] = useState<AllTemplates>({ finance: [], hr: [], ops: [], others: [] })
  const [loading, setLoading] = useState(true)
  const [areaFilter, setAreaFilter] = useState<AreaFilter>(null)
  const [effortFilter, setEffortFilter] = useState<EffortFilter>('All')
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState<WorkTemplate | null>(null)
  const [editing, setEditing] = useState<WorkTemplate | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    Promise.all(AREAS.map(a => loadTemplates(a.value))).then(([finance, hr, ops, others]) => {
      setAll({ finance, hr, ops, others })
      setLoading(false)
    })
  }, [])

  const persist = useCallback((area: WorkArea, updated: WorkTemplate[]) => {
    setAll(prev => ({ ...prev, [area]: updated }))
    saveTemplates(area, updated)
  }, [])

  const handleSave = (tmpl: WorkTemplate) => {
    const area = tmpl.area
    const existing = all[area]
    const idx = existing.findIndex(t => t.id === tmpl.id)
    persist(area, idx >= 0 ? existing.map(t => t.id === tmpl.id ? tmpl : t) : [...existing, tmpl])
    setEditing(null)
    setAdding(false)
  }

  const handleDelete = (id: string, area: WorkArea) => {
    persist(area, all[area].filter(t => t.id !== id))
    setEditing(null)
  }

  const visible = useMemo(() => {
    const flat = AREAS.flatMap(a => all[a.value])
    return sortTemplates(flat.filter(t => {
      if (areaFilter && t.area !== areaFilter) return false
      const q = query.trim().toLowerCase()
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q) && !t.items.some(s => s.label.toLowerCase().includes(q))) return false
      if (effortFilter === 'Must') return t.must
      if (effortFilter !== 'All') return t.effort === effortFilter.toLowerCase()
      return true
    }))
  }, [all, areaFilter, effortFilter, query])

  // Default add area: selected tab, or Finance
  const activeAddArea: WorkArea = areaFilter ?? 'finance'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Area tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto overflow-y-hidden scrollbar-none flex-shrink-0">
        {AREAS.map(a => (
          <button
            key={a.value}
            onClick={() => setAreaFilter(prev => prev === a.value ? null : a.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              areaFilter === a.value ? a.active : a.inactive
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ── Filter chips ───────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto overflow-y-hidden scrollbar-none flex-shrink-0">
        {EFFORT_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setEffortFilter(f)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${
              effortFilter === f
                ? 'bg-white/12 border-white/25 text-white'
                : 'border-white/8 text-white/35 hover:border-white/18 hover:text-white/55'
            }`}
          >
            {f === 'Must' ? '⚡ Must' : f}
          </button>
        ))}
      </div>

      {/* ── Search + Add button ────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-shrink-0 border-b border-white/6">
        <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-3.5 py-2 flex-1">
          <Search className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navi-blue/15 border border-navi-blue/30 text-navi-blue text-xs font-semibold hover:bg-navi-blue/25 transition-all whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Template
        </button>
      </div>

      {/* ── Template grid ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {loading ? (
          <div className="py-8 text-center text-sm text-white/30">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-white/30">No templates found</p>
            {(query || effortFilter !== 'All') && (
              <button onClick={() => { setQuery(''); setEffortFilter('All') }}
                className="mt-2 text-xs text-white/25 hover:text-white/50 transition-colors">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visible.map(tmpl => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                area={tmpl.area}
                onRun={() => setRunning(tmpl)}
                onEdit={() => setEditing(tmpl)}
              />
            ))}
          </div>
        )}
      </div>

      {running && <RunModal template={running} area={running.area} onClose={() => setRunning(null)} />}
      {editing && (
        <TemplateFormModal
          initial={editing}
          area={editing.area}
          allowAreaChange
          onSave={handleSave}
          onDelete={() => handleDelete(editing.id, editing.area)}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <TemplateFormModal
          initial={newTemplate(activeAddArea)}
          area={activeAddArea}
          allowAreaChange
          onSave={handleSave}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
