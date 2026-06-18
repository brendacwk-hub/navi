'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Home, Wallet, ShoppingBag, BookOpen, CalendarDays, BarChart3, SlidersHorizontal, Scissors } from 'lucide-react'

const areaLinks = [
  { label: 'Housework', href: '/personal/housework', icon: Home,       color: 'text-[#fb7185]', bg: 'bg-[#fb7185]/15' },
  { label: 'Finance',   href: '/personal/finance',   icon: Wallet,     color: 'text-[#22d3ee]', bg: 'bg-[#22d3ee]/15' },
  { label: 'Sidoi',     href: '/personal/sidoi',     icon: Scissors,   color: 'text-[#f9a8d4]', bg: 'bg-[#f9a8d4]/15' },
  { label: 'To Buy',    href: '/personal/tobuy',     icon: ShoppingBag,color: 'text-[#fcd34d]', bg: 'bg-[#fcd34d]/15' },
]

const sharedLinks = [
  { label: 'Diary',     href: '/personal/diary',     icon: BookOpen },
  { label: 'Calendar',  href: '/work/calendar',      icon: CalendarDays },
  { label: 'Analytics', href: '/work/analytics',     icon: BarChart3 },
]

export function PersonalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="h-full border-r border-white/6 flex flex-col overflow-hidden" style={{ backgroundColor: '#0e1628' }}>
      <nav className="flex-1 px-3 pt-3 pb-4 overflow-y-auto space-y-0.5">

        {/* Today */}
        {(() => {
          const active = isActive('/personal/today')
          return (
            <Link href="/personal/today" onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-[#f0a8c8]/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#f0a8c8]' : 'text-white/30'}`} />
              Today
            </Link>
          )
        })()}

        {/* Area links */}
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

        {/* Diary + shared tabs */}
        {sharedLinks.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href} onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-[#f0a8c8]/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#f0a8c8]' : 'text-white/30'}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/6">
        {(() => {
          const active = isActive('/work/settings')
          return (
            <Link href="/work/settings" onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                active ? 'bg-[#f0a8c8]/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}>
              <SlidersHorizontal className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#f0a8c8]' : 'text-white/30'}`} />
              Settings
            </Link>
          )
        })()}
      </div>
    </div>
  )
}
