'use client'

import { useState, useMemo } from 'react'
import { Bell } from 'lucide-react'
import { useWorkData } from '@/shared/lib/work-data-context'
import { AttentionPanel, type AttentionItem } from './AttentionPanel'
import type { Cycle } from '@/shared/types'

const AREA_META: Record<string, { label: string; color: string; href: string }> = {
  finance: { label: 'Finance', color: '#3b82f6', href: '/work/finance' },
  hr:      { label: 'HR',      color: '#10b981', href: '/work/hr' },
  ops:     { label: 'Ops',     color: '#f97316', href: '/work/ops' },
  others:  { label: 'Others',  color: '#ec4899', href: '/work/others' },
}

function toItems(cycles: Cycle[], todayStr: string): AttentionItem[] {
  return cycles.flatMap(c => {
    const t = c.triggerLabel
    if (!t || c.status === 'complete') return []
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || t > todayStr) return []
    const meta = AREA_META[c.area] ?? AREA_META.finance
    const msPerDay = 86400000
    const daysOverdue = Math.floor((new Date(todayStr).getTime() - new Date(t).getTime()) / msPerDay)
    return [{ id: c.id, title: c.title, area: c.area, areaLabel: meta.label, areaColor: meta.color, daysOverdue, href: meta.href }]
  })
}

export function WorkAttentionBell() {
  const { financeCycles, hrCycles, opsCycles, othersCycles } = useWorkData()
  const [open, setOpen] = useState(false)

  const todayStr = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }, [])

  const items = useMemo(() => {
    const all = [...financeCycles, ...hrCycles, ...opsCycles, ...othersCycles]
    return toItems(all, todayStr).sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [financeCycles, hrCycles, opsCycles, othersCycles, todayStr])

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`p-2 rounded-lg transition-all ${open ? 'text-white/80 bg-white/8' : 'text-white/40 hover:text-white/70 hover:bg-white/6'}`}
      >
        <Bell className="w-4 h-4" />
        {items.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>
      {open && <AttentionPanel items={items} onClose={() => setOpen(false)} accentColor="#3b82f6" />}
    </div>
  )
}
