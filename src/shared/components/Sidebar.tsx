'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Wallet, Users, Settings, Package,
  MoreHorizontal, Inbox, CalendarDays, Activity, BarChart3,
  ChevronDown, SlidersHorizontal, FileText,
} from 'lucide-react'
import { useInbox } from '@/shared/lib/inbox-context'

const areaActive    = { finance: 'bg-finance/15 text-finance', hr: 'bg-hr/15 text-hr', ops: 'bg-ops/15 text-ops', others: 'bg-others/15 text-others' } as const
const areaDot       = { finance: 'bg-finance', hr: 'bg-hr', ops: 'bg-ops', others: 'bg-others' } as const
const areaIconColor = { finance: 'text-finance', hr: 'text-hr', ops: 'text-ops', others: 'text-others' } as const
type AreaKey = keyof typeof areaActive

const SUB_AREAS: Partial<Record<AreaKey, string[]>> = {
  finance: ['Payments', 'Budgets', 'Administrative', 'Records', 'AI'],
  hr: ['Payroll & MPF', 'Insurance & VISA', 'Leave & Attendance', 'Onboarding & Offboarding', 'Tax', 'Records', 'AI'],
  ops: ['Vendor & Contracts', 'Expenses', 'Arrangements', 'AI'],
}

const taskLinks = [
  { label: 'Finance', href: '/work/finance', icon: Wallet,   area: 'finance' as AreaKey },
  { label: 'HR',      href: '/work/hr',      icon: Users,    area: 'hr'      as AreaKey },
  { label: 'Ops',     href: '/work/ops',     icon: Settings, area: 'ops'     as AreaKey },
  { label: 'Others',  href: '/work/others',  icon: Package,  area: 'others'  as AreaKey },
]

const otherLinks = [
  { label: 'Inbox',    href: '/work/inbox',    icon: Inbox },
  { label: 'Habits',   href: '/work/habits',   icon: Activity },
  { label: 'Calendar', href: '/work/calendar', icon: CalendarDays },
]

const comingSoonLinks: { label: string; icon: React.ComponentType<{ className?: string }> }[] = []

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { unreadCount } = useInbox()
  const [expandedAreas, setExpandedAreas] = useState<Set<AreaKey>>(new Set())

  const toggleExpand = (e: React.MouseEvent, area: AreaKey) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedAreas(prev => {
      const next = new Set(prev)
      if (next.has(area)) next.delete(area)
      else next.add(area)
      return next
    })
  }

  return (
    <div className="h-full bg-sidebar border-r border-white/6 flex flex-col overflow-hidden">
      <nav className="flex-1 px-3 pt-3 pb-4 overflow-y-auto space-y-0.5">

        {/* Today */}
        {(() => {
          const active = pathname === '/work'
          return (
            <Link href="/work" onClick={onNavigate} title="Today"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-navi-blue/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/30'}`} />
              Today
            </Link>
          )
        })()}

        {/* Tasks section */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Tasks</span>
        </div>

        {taskLinks.map(({ label, href, icon: Icon, area }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const subAreas = SUB_AREAS[area]
          const isExpanded = expandedAreas.has(area)

          return (
            <div key={href}>
              {/* Main row — clicking label/icon navigates to main page */}
              <div className={`group flex items-center rounded-lg transition-all ${active ? areaActive[area] : 'hover:bg-white/5'}`}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={label}
                  className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? areaIconColor[area] : 'text-white/30'}`} />
                  <span className={`flex-1 text-sm font-bold truncate ${active ? '' : 'text-white/50 group-hover:text-white/80'}`}>
                    {label}
                  </span>
                  {active && !subAreas && (
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${areaDot[area]}`} />
                  )}
                </Link>
                {/* Chevron — expands sub-categories inline (dropdown) */}
                {subAreas && (
                  <button
                    onClick={(e) => toggleExpand(e, area)}
                    title={isExpanded ? 'Collapse' : 'Show sub-categories'}
                    className={`pr-3 py-2.5 flex-shrink-0 transition-colors ${
                      active ? areaIconColor[area] : 'text-white/25 group-hover:text-white/50'
                    }`}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Dropdown — sub-categories expand inline below */}
              {subAreas && isExpanded && (
                <div className="pl-10 pt-0.5 pb-1 space-y-0.5">
                  {subAreas.map(sub => (
                    <Link
                      key={sub}
                      href={`${href}?sub=${encodeURIComponent(sub)}`}
                      onClick={onNavigate}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium text-white/45 hover:text-white/80 hover:bg-white/5 transition-all"
                    >
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${areaDot[area]}`} />
                      {sub}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Templates */}
        {(() => {
          const active = pathname === '/work/templates'
          return (
            <Link href="/work/templates" onClick={onNavigate} title="Templates"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-navi-blue/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <FileText className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/30'}`} />
              Templates
            </Link>
          )
        })()}

        {/* Inbox + Habits */}
        <div className="mx-3 my-2 border-t border-white/8" />
        {otherLinks.filter(l => l.href !== '/work/calendar').map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          const isInbox = href === '/work/inbox'
          return (
            <Link key={href} href={href} onClick={onNavigate} title={label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-navi-blue/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/30'}`} />
              <span className="flex-1">{label}</span>
              {isInbox && unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-navi-blue text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {unreadCount}
                </span>
              )}
            </Link>
          )
        })}

        {otherLinks.filter(l => l.href === '/work/calendar').map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={onNavigate} title={label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-navi-blue/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/30'}`} />
              <span className="flex-1">{label}</span>
            </Link>
          )
        })}

      </nav>

      {/* Footer — Analytics + Settings */}
      <div className="px-3 py-3 border-t border-white/6">
        {(() => {
          const active = pathname === '/work/analytics'
          return (
            <Link href="/work/analytics" onClick={onNavigate} title="Analytics"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-navi-blue/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <BarChart3 className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/30'}`} />
              <span className="flex-1">Analytics</span>
            </Link>
          )
        })()}

        {(() => {
          const active = pathname === '/work/settings'
          return (
            <Link href="/work/settings" onClick={onNavigate} title="Settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-navi-blue/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <SlidersHorizontal className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/30'}`} />
              Settings
            </Link>
          )
        })()}
      </div>
    </div>
  )
}
