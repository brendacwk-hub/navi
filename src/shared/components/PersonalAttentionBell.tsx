'use client'

import { useState, useMemo } from 'react'
import { Bell } from 'lucide-react'
import { usePersonalData } from '@/shared/lib/personal-data-context'
import { AttentionPanel, type AttentionItem } from './AttentionPanel'
import type { Cycle } from '@/shared/types'

const AREA_META: Record<string, { label: string; color: string; href: string }> = {
  housework:          { label: 'Home',    color: '#fb7185', href: '/personal/housework' },
  'personal-finance': { label: 'Finance', color: '#22d3ee', href: '/personal/housework' },
  sidoi:              { label: 'Sidoi',   color: '#f9a8d4', href: '/personal/sidoi' },
  tobuy:              { label: 'To Buy',  color: '#fcd34d', href: '/personal/tobuy' },
  'personal-others':  { label: 'Others',  color: '#fbbf24', href: '/personal/others' },
}

function toItems(cycles: Cycle[], todayStr: string): AttentionItem[] {
  return cycles.flatMap(c => {
    const t = c.triggerLabel
    if (!t || c.status === 'complete') return []
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || t > todayStr) return []
    const meta = AREA_META[c.area] ?? AREA_META.housework
    const msPerDay = 86400000
    const daysOverdue = Math.floor((new Date(todayStr).getTime() - new Date(t).getTime()) / msPerDay)
    return [{ id: c.id, title: c.title, area: c.area, areaLabel: meta.label, areaColor: meta.color, daysOverdue, href: meta.href }]
  })
}

export function PersonalAttentionBell() {
  const { houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles, personalOthersCycles } = usePersonalData()
  const [open, setOpen] = useState(false)

  const todayStr = useMemo(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }, [])

  const items = useMemo(() => {
    const all = [...houseworkCycles, ...personalFinanceCycles, ...sidoiCycles, ...tobuyCycles, ...personalOthersCycles]
    return toItems(all, todayStr).sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [houseworkCycles, personalFinanceCycles, sidoiCycles, tobuyCycles, personalOthersCycles, todayStr])

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
      {open && <AttentionPanel items={items} onClose={() => setOpen(false)} accentColor="#f0a8c8" />}
    </div>
  )
}
