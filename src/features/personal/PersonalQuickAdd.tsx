'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { RecurrencePicker, fmtRecurrDisplay, isRecurrString } from '@/shared/components/RecurrencePicker'
import { resolveLabel } from '@/shared/lib/sort-utils'
import type { PersonalArea } from '@/shared/types'

const AREA_COLOR: Record<PersonalArea, string> = {
  housework:          '#fb7185',
  'personal-finance': '#22d3ee',
  sidoi:              '#f9a8d4',
  tobuy:              '#fcd34d',
  'personal-others':  '#fbbf24',
}

const AREA_LABEL: Record<PersonalArea, string> = {
  housework:          'Housework',
  'personal-finance': 'Finance',
  sidoi:              'Sidoi',
  tobuy:              'To Buy',
  'personal-others':  'Others',
}

const SIDOI_SUB_AREAS = ['Orders', 'Marketing', 'Planning']

interface Props {
  area: PersonalArea
  defaultSubArea?: string
  onClose: () => void
}

export function PersonalQuickAdd({ area, defaultSubArea, onClose }: Props) {
  const { addCycle, houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles, completedTitles } = usePersonalData()
  const [title, setTitle] = useState('')
  const [subArea, setSubArea] = useState(defaultSubArea ?? '')
  const [dueDate, setDueDate] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [showRecurrence, setShowRecurrence] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const color = AREA_COLOR[area]

  const suggestions = useMemo(() => {
    if (title.length < 2) return []
    const q = title.toLowerCase()
    const seen = new Set<string>()
    const results: string[] = []
    const allActive = [...houseworkCycles, ...personalFinanceCycles, ...sidoiCycles, ...tobuyCycles]
    for (const c of allActive) {
      if (c.title && !seen.has(c.title) && c.title.toLowerCase().includes(q) && c.title.toLowerCase() !== q) {
        seen.add(c.title); results.push(c.title)
      }
    }
    for (const t of completedTitles) {
      if (!seen.has(t) && t.toLowerCase().includes(q) && t.toLowerCase() !== q) {
        seen.add(t); results.push(t)
      }
    }
    return results.slice(0, 5)
  }, [title, houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles, completedTitles])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleAdd() {
    const t = title.trim()
    if (!t) return
    const triggerLabel = recurrence
      ? recurrence
      : dueDate
        ? resolveLabel(dueDate)
        : undefined

    addCycle(area, {
      id: `${area}-${Date.now()}`,
      title: t,
      area,
      subArea: subArea || undefined,
      effort: 'medium',
      must: false,
      triggerLabel: triggerLabel ?? '',
      status: 'active',
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t p-5 pb-10"
        style={{ backgroundColor: '#0e1628', borderColor: `${color}30` }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color }}>
            Add to {AREA_LABEL[area]}
          </span>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Task title..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 mb-2"
        />

        {suggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setTitle(s); setTimeout(() => inputRef.current?.focus(), 0) }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] text-white/60 hover:text-white/85 transition-all whitespace-nowrap"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: `${color}30` }}
              >
                <span className="text-[9px]" style={{ color }}>✦</span>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Sub-area picker for Sidoi */}
        {area === 'sidoi' && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {SIDOI_SUB_AREAS.map(s => (
              <button
                key={s}
                onClick={() => setSubArea(subArea === s ? '' : s)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={subArea === s
                  ? { borderColor: `${color}60`, color, backgroundColor: `${color}20` }
                  : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Due date */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {['Today', 'Tomorrow', 'In 2 Days'].map(preset => (
            <button
              key={preset}
              onClick={() => { setDueDate(dueDate === preset ? '' : preset); setRecurrence('') }}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={dueDate === preset
                ? { borderColor: `${color}60`, color, backgroundColor: `${color}20` }
                : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              {preset}
            </button>
          ))}
          <input
            type="date"
            value={dueDate.match(/^\d{4}-\d{2}-\d{2}$/) ? dueDate : ''}
            onChange={e => { setDueDate(e.target.value); setRecurrence('') }}
            className="text-xs px-2 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/50 focus:outline-none"
          />
          <button
            onClick={() => setShowRecurrence(r => !r)}
            className="text-xs px-3 py-1.5 rounded-lg border transition-all"
            style={recurrence
              ? { borderColor: `${color}60`, color, backgroundColor: `${color}20` }
              : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
            }
          >
            {recurrence ? fmtRecurrDisplay(recurrence) : 'Recurring…'}
          </button>
        </div>

        {showRecurrence && (
          <div className="mb-3">
            <RecurrencePicker
              value={recurrence}
              onChange={v => { setRecurrence(v); setDueDate(''); setShowRecurrence(false) }}
            />
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>
    </>
  )
}
