'use client'

import { X } from 'lucide-react'

export interface AttentionItem {
  id: string
  title: string
  area: string
  areaLabel: string
  areaColor: string
  daysOverdue: number // 0 = due today, >0 = days past
  href: string
}

interface Props {
  items: AttentionItem[]
  onClose: () => void
  accentColor: string
}

export function AttentionPanel({ items, onClose, accentColor }: Props) {
  const overdue = items.filter(i => i.daysOverdue > 0)
  const today   = items.filter(i => i.daysOverdue === 0)

  const Section = ({ title, rows }: { title: string; rows: AttentionItem[] }) =>
    rows.length === 0 ? null : (
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{title}</div>
        <div className="space-y-1">
          {rows.map(item => (
            <a
              key={item.id}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/6 transition-colors"
            >
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.areaColor }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white/85 truncate">{item.title}</div>
                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.areaLabel}</div>
              </div>
              {item.daysOverdue > 0 && (
                <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                  {item.daysOverdue}d
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    )

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div
        className="absolute right-0 top-full mt-2 w-72 rounded-2xl border shadow-2xl z-[71] overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span className="text-[13px] font-semibold text-white/80">Attention</span>
          <button onClick={onClose} className="p-0.5 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-2 py-3 max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-6 text-center">
              <div className="text-xl mb-1">✓</div>
              <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>All clear</div>
            </div>
          ) : (
            <>
              <Section title="Overdue" rows={overdue} />
              <Section title="Due today" rows={today} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
