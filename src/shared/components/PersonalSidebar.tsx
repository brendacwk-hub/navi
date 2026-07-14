'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Home, Wallet, ShoppingBag, BookOpen, CalendarDays,
  BarChart3, SlidersHorizontal, Scissors, Activity, Lightbulb, ChevronDown, MoreHorizontal,
} from 'lucide-react'

const PINK = '#f0a8c8'

const areaLinks = [
  { label: 'Housework', href: '/personal/housework', icon: Home,        color: 'text-[#fb7185]', bg: 'bg-[#fb7185]/15' },
  { label: 'Finance',   href: '/personal/finance',   icon: Wallet,      color: 'text-[#22d3ee]', bg: 'bg-[#22d3ee]/15' },
  { label: 'Sidoi',     href: '/personal/sidoi',     icon: Scissors,    color: 'text-[#f9a8d4]', bg: 'bg-[#f9a8d4]/15' },
  { label: 'To Buy',    href: '/personal/tobuy',     icon: ShoppingBag,    color: 'text-[#fcd34d]', bg: 'bg-[#fcd34d]/15' },
  { label: 'Others',   href: '/personal/others',    icon: MoreHorizontal, color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/15' },
]

const IDEAS_SUBCATS = [
  { label: 'All',     href: '/personal/ideas' },
  { label: 'AI',      href: '/personal/ideas/ai' },
  { label: 'Art',     href: '/personal/ideas/art' },
  { label: 'Pending', href: '/personal/ideas/pending' },
]

export function PersonalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const ideasActive = pathname.startsWith('/personal/ideas')
  const [ideasExpanded, setIdeasExpanded] = useState(ideasActive)

  useEffect(() => {
    if (ideasActive) setIdeasExpanded(true)
  }, [ideasActive])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
      active ? `bg-[${PINK}]/15 text-white` : 'text-white/50 hover:text-white/80 hover:bg-white/5'
    }`

  return (
    <div className="h-full border-r border-white/6 flex flex-col overflow-hidden" style={{ backgroundColor: '#0e1628' }}>
      <nav className="flex-1 px-3 pt-3 pb-4 overflow-y-auto space-y-0.5">

        {/* Today */}
        {(() => {
          const active = isActive('/personal/today')
          return (
            <Link href="/personal/today" onClick={onNavigate}
              className={linkCls(active)}
              style={active ? { backgroundColor: `${PINK}26` } : undefined}>
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${active ? '' : 'text-white/30'}`}
                style={active ? { color: PINK } : undefined} />
              Today
            </Link>
          )
        })()}

        {/* Areas */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Areas</span>
        </div>

        {areaLinks.map(({ label, href, icon: Icon, color, bg }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href} onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? `${bg} text-white` : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? color : 'text-white/30'}`} />
              {label}
            </Link>
          )
        })}

        {/* Divider */}
        <div className="mx-3 my-2 border-t border-white/8" />

        {/* Habits */}
        {(() => {
          const active = isActive('/personal/habits')
          return (
            <Link href="/personal/habits" onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={active ? { backgroundColor: `${PINK}20`, color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}>
              <Activity className="w-4 h-4 flex-shrink-0" style={{ color: active ? PINK : 'rgba(255,255,255,0.3)' }} />
              Habits
            </Link>
          )
        })()}

        {/* Diary */}
        {(() => {
          const active = isActive('/personal/diary')
          return (
            <Link href="/personal/diary" onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={active ? { backgroundColor: `${PINK}20`, color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}>
              <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: active ? PINK : 'rgba(255,255,255,0.3)' }} />
              Diary
            </Link>
          )
        })()}

        {/* Ideas — expandable */}
        <div
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
          style={ideasActive ? { backgroundColor: `${PINK}20`, color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}
        >
          <Link href="/personal/ideas" onClick={() => { setIdeasExpanded(true); onNavigate?.() }}
            className="flex items-center gap-3 flex-1 min-w-0">
            <Lightbulb className="w-4 h-4 flex-shrink-0" style={{ color: ideasActive ? PINK : 'rgba(255,255,255,0.3)' }} />
            <span>Ideas</span>
          </Link>
          <button onClick={() => setIdeasExpanded(e => !e)} className="p-0.5">
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${ideasExpanded ? 'rotate-180' : ''}`}
              style={{ color: ideasActive ? `${PINK}80` : 'rgba(255,255,255,0.2)' }}
            />
          </button>
        </div>

        {ideasExpanded && (
          <div className="ml-4 space-y-0.5 pb-0.5">
            {IDEAS_SUBCATS.map(({ label, href }) => {
              const sub = label === 'All'
                ? pathname === '/personal/ideas'
                : pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href} onClick={onNavigate}
                  className="flex items-center gap-2 pl-5 pr-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={sub ? { color: PINK } : { color: 'rgba(255,255,255,0.35)' }}>
                  {label}
                </Link>
              )
            })}
          </div>
        )}

        {/* Calendar */}
        {(() => {
          const active = isActive('/personal/calendar')
          return (
            <Link href="/personal/calendar" onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={active ? { backgroundColor: `${PINK}20`, color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}>
              <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: active ? PINK : 'rgba(255,255,255,0.3)' }} />
              Calendar
            </Link>
          )
        })()}

        {/* Analytics */}
        {(() => {
          const active = isActive('/personal/analytics')
          return (
            <Link href="/personal/analytics" onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={active ? { backgroundColor: `${PINK}20`, color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}>
              <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: active ? PINK : 'rgba(255,255,255,0.3)' }} />
              Analytics
            </Link>
          )
        })()}

      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/6">
        {(() => {
          const active = isActive('/personal/settings')
          return (
            <Link href="/personal/settings" onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={active ? { backgroundColor: `${PINK}20`, color: '#fff' } : { color: 'rgba(255,255,255,0.5)' }}>
              <SlidersHorizontal className="w-4 h-4 flex-shrink-0" style={{ color: active ? PINK : 'rgba(255,255,255,0.3)' }} />
              Settings
            </Link>
          )
        })()}
      </div>
    </div>
  )
}
