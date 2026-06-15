'use client'

import { useRouter } from 'next/navigation'
import { useWorkData } from '@/shared/lib/work-data-context'
import { todayTaskData } from '@/features/work/tasks/today/data'
import { fuzzyMatch } from '@/shared/lib/search-utils'
import type { Cycle } from '@/shared/types'

// ── Area colour for location breadcrumb ──────────────────────────────────────
const areaLocColor: Record<string, string> = {
  finance: 'text-finance/70',
  hr: 'text-hr/70',
  ops: 'text-ops/70',
  others: 'text-others/70',
}
const areaDot: Record<string, string> = {
  finance: 'bg-finance',
  hr: 'bg-hr',
  ops: 'bg-ops',
  others: 'bg-others',
}
const groupChip: Record<string, string> = {
  Finance: 'text-finance border-finance/40',
  HR: 'text-hr border-hr/40',
  Ops: 'text-ops border-ops/40',
  Others: 'text-others border-others/40',
  Today: 'text-navi-blue border-navi-blue/40',
}

interface ResultItem {
  key: string
  label: string       // the specific matched text (sub-task / item / cycle title)
  location: string    // breadcrumb: "Finance · Budgets · Screen for payment requests"
  href: string
  area: string
  group: string
}

// ── Extract every searchable leaf from cycles ─────────────────────────────────
function extractCycleResults(cycles: Cycle[], query: string, tabLabel: string, href: string): ResultItem[] {
  const results: ResultItem[] = []

  for (const cycle of cycles) {
    const area = cycle.area

    // Cycle title itself
    if (fuzzyMatch(cycle.title, query)) {
      results.push({
        key: `cy-${cycle.id}`,
        label: cycle.title,
        location: tabLabel,
        href, area, group: tabLabel,
      })
    }

    // Flat items
    for (const item of cycle.items ?? []) {
      if (fuzzyMatch(item.label, query)) {
        results.push({
          key: `it-${cycle.id}-${item.id}`,
          label: item.label,
          location: `${tabLabel} · ${cycle.title}`,
          href, area, group: tabLabel,
        })
      }
      for (const sub of item.subItems ?? []) {
        if (fuzzyMatch(sub.label, query)) {
          results.push({
            key: `sb-${cycle.id}-${item.id}-${sub.id}`,
            label: sub.label,
            location: `${tabLabel} · ${cycle.title} · ${item.label}`,
            href, area, group: tabLabel,
          })
        }
      }
    }

    // Phase items
    for (const phase of cycle.phases ?? []) {
      for (const item of phase.items) {
        if (fuzzyMatch(item.label, query)) {
          results.push({
            key: `ph-${cycle.id}-${phase.id}-${item.id}`,
            label: item.label,
            location: `${tabLabel} · ${cycle.title} · ${phase.title}`,
            href, area, group: tabLabel,
          })
        }
        for (const sub of item.subItems ?? []) {
          if (fuzzyMatch(sub.label, query)) {
            results.push({
              key: `ps-${cycle.id}-${phase.id}-${item.id}-${sub.id}`,
              label: sub.label,
              location: `${tabLabel} · ${cycle.title} · ${phase.title}`,
              href, area, group: tabLabel,
            })
          }
        }
      }
    }
  }

  return results
}

interface Props {
  query: string
  onSelect: () => void
}

export function GlobalSearchResults({ query, onSelect }: Props) {
  const router = useRouter()
  const { financeCycles, hrCycles, opsCycles, othersCycles } = useWorkData()

  const results: ResultItem[] = [
    ...extractCycleResults(financeCycles, query, 'Finance', '/work/finance'),
    ...extractCycleResults(hrCycles, query, 'HR', '/work/hr'),
    ...extractCycleResults(opsCycles, query, 'Ops', '/work/ops'),
    ...extractCycleResults(othersCycles, query, 'Others', '/work/others'),
    ...todayTaskData.flatMap(t => {
      const rows: ResultItem[] = []
      if (fuzzyMatch(t.label, query)) {
        rows.push({ key: `td-${t.id}`, label: t.label, location: 'Today', href: '/work', area: t.area, group: 'Today' })
      }
      for (const sub of t.subItems ?? []) {
        if (fuzzyMatch(sub.label, query)) {
          rows.push({ key: `ts-${t.id}-${sub.id}`, label: sub.label, location: `Today · ${t.label}`, href: '/work', area: t.area, group: 'Today' })
        }
      }
      return rows
    }),
  ]

  const groups = Array.from(new Set(results.map(r => r.group)))

  const handleSelect = (href: string) => {
    router.push(href)
    onSelect()
  }

  return (
    <div className="absolute top-full left-0 mt-1.5 w-full min-w-[26rem] max-w-lg max-h-80 overflow-y-auto bg-[#1c1c1c] border border-white/12 rounded-xl shadow-2xl z-50">
      {results.length === 0 ? (
        <div className="px-4 py-4 text-sm text-white/35 text-center">
          No results for &quot;{query}&quot;
        </div>
      ) : (
        groups.map(group => (
          <div key={group}>
            <div className="px-3 pt-3 pb-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest border px-1.5 py-0.5 rounded ${groupChip[group] ?? 'text-white/40 border-white/15'}`}>
                {group}
              </span>
            </div>
            {results.filter(r => r.group === group).map(r => (
              <button
                key={r.key}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(r.href)}
                className="w-full flex items-start gap-3 px-3 py-2 hover:bg-white/6 transition-colors text-left"
              >
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${areaDot[r.area] ?? 'bg-white/30'}`} />
                <div className="flex-1 min-w-0">
                  {/* Matched label — main size */}
                  <div className="text-sm text-white/85 truncate">{r.label}</div>
                  {/* Location breadcrumb — 15% smaller, area colour */}
                  <div className={`text-[11px] truncate mt-0.5 ${areaLocColor[r.area] ?? 'text-white/35'}`}>
                    {r.location}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))
      )}
      <div className="px-3 py-2 border-t border-white/6 text-[10px] text-white/20">
        {results.length} result{results.length !== 1 ? 's' : ''} · Esc to clear
      </div>
    </div>
  )
}
