'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  Users,
  Settings,
  Package,
  MoreHorizontal,
  Inbox,
  Lightbulb,
  CalendarDays,
  Activity,
  BarChart3,
} from 'lucide-react'
import { useInbox } from '@/shared/lib/inbox-context'

const areaActive = {
  finance: 'bg-finance/15 text-finance',
  hr: 'bg-hr/15 text-hr',
  ops: 'bg-ops/15 text-ops',
  others: 'bg-others/15 text-others',
} as const

const areaDot = {
  finance: 'bg-finance',
  hr: 'bg-hr',
  ops: 'bg-ops',
  others: 'bg-others',
} as const

const areaIconActive = {
  finance: 'text-finance',
  hr: 'text-hr',
  ops: 'text-ops',
  others: 'text-others',
} as const

type AreaKey = keyof typeof areaActive

const taskChildren = [
  { label: 'Finance', href: '/work/finance', icon: Wallet, area: 'finance' as AreaKey },
  { label: 'HR', href: '/work/hr', icon: Users, area: 'hr' as AreaKey },
  { label: 'Ops', href: '/work/ops', icon: Settings, area: 'ops' as AreaKey },
  { label: 'Others', href: '/work/others', icon: Package, area: 'others' as AreaKey },
]

const topTabs = [
  { label: 'Today', href: '/work', icon: LayoutDashboard },
]

const bottomTabs = [
  { label: 'Inbox', href: '/work/inbox', icon: Inbox },
  { label: 'Ideas', href: '/work/ideas', icon: Lightbulb },
  { label: 'Calendar', href: '/work/calendar', icon: CalendarDays },
  { label: 'Habits', href: '/work/habits', icon: Activity },
  { label: 'Analytics', href: '/work/analytics', icon: BarChart3 },
]

function NavLink({ href, icon: Icon, label, exact = false }: {
  href: string; icon: React.ElementType; label: string; exact?: boolean
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-all ${
        active
          ? 'bg-navi-blue/15 text-white'
          : 'text-white/45 hover:text-white/75 hover:bg-white/5'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/25'}`} />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { unreadCount } = useInbox()

  return (
    <aside className="w-[205px] flex-shrink-0 h-screen bg-sidebar border-r border-white/6 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="Navi"
          width={47}
          height={47}
          className="rounded-lg flex-shrink-0 object-cover"
        />
        <span className="font-bold text-white text-lg tracking-tight">Navi</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 font-medium">Work</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-0.5">
        {/* Today */}
        {topTabs.map((tab) => (
          <NavLink key={tab.href} href={tab.href} icon={tab.icon} label={tab.label} exact />
        ))}

        {/* Tasks group */}
        <div className="pt-4 pb-1">
          <span className="px-2 text-[10px] font-bold text-white/25 uppercase tracking-widest">Tasks</span>
        </div>
        {taskChildren.map((child) => {
          const Icon = child.icon
          const active = pathname === child.href || pathname.startsWith(child.href + '/')
          return (
            <Link
              key={child.href}
              href={child.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-all ${
                active
                  ? areaActive[child.area]
                  : 'text-white/45 hover:text-white/75 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? areaIconActive[child.area] : 'text-white/25'}`} />
              {child.label}
              {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${areaDot[child.area]}`} />}
            </Link>
          )
        })}

        {/* Other tabs */}
        <div className="pt-4" />
        {bottomTabs.map((tab) => {
          if (tab.href === '/work/inbox') {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-all ${
                  active ? 'bg-navi-blue/15 text-white' : 'text-white/45 hover:text-white/75 hover:bg-white/5'
                }`}
              >
                <Inbox className={`w-4 h-4 flex-shrink-0 ${active ? 'text-navi-blue' : 'text-white/25'}`} />
                Inbox
                {unreadCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-navi-blue text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          }
          return <NavLink key={tab.href} href={tab.href} icon={tab.icon} label={tab.label} />
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/6">
        <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-white/35 hover:text-white/65 hover:bg-white/5 transition-all w-full">
          <MoreHorizontal className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  )
}
