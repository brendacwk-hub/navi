'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Bell, X, Menu } from 'lucide-react'
import { useSearch } from '@/shared/lib/search-context'
import { GlobalSearchResults } from './GlobalSearchResults'
import { usePathname, useRouter } from 'next/navigation'

interface HeaderProps {
  onMenuClick: () => void
  onMenuHover?: () => void
  menuOpen?: boolean
}

// Shared pages belong to no mode — badge shows whichever mode the user came from
const SHARED_PATHS = ['/work/settings', '/work/calendar', '/work/analytics']

function ModeBadge() {
  const pathname    = usePathname()
  const router      = useRouter()

  const isPersonalPath = pathname.startsWith('/personal')
  const isSharedPath   = SHARED_PATHS.some(p => pathname.startsWith(p))

  const [isPersonal, setIsPersonal] = useState(isPersonalPath)

  useEffect(() => {
    if (isPersonalPath) {
      localStorage.setItem('navi_mode', 'personal')
      setIsPersonal(true)
    } else if (isSharedPath) {
      // On shared pages show badge based on where the user came from
      setIsPersonal(localStorage.getItem('navi_mode') === 'personal')
    } else {
      localStorage.setItem('navi_mode', 'work')
      setIsPersonal(false)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = () => {
    if (isPersonal) {
      router.push('/work')
    } else {
      router.push('/personal/today')
    }
  }

  return (
    <button
      onClick={switchMode}
      title={`Switch to ${isPersonal ? 'Work' : 'Personal'} mode`}
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95 ${
        isPersonal
          ? 'bg-[#f0a8c8]/20 text-[#f0a8c8] border border-[#f0a8c8]/30 hover:bg-[#f0a8c8]/30'
          : 'bg-white/8 text-white/40 border border-white/10 hover:bg-white/12 hover:text-white/60'
      }`}
    >
      {isPersonal ? '🏠 Personal' : '💼 Work'}
    </button>
  )
}

function SearchBar() {
  const { query, setQuery } = useSearch()
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('')
        setShowResults(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setQuery])

  return (
    <div className="flex-1 max-w-sm relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setShowResults(true) }}
        onFocus={() => { if (query) setShowResults(true) }}
        onBlur={() => setTimeout(() => setShowResults(false), 150)}
        placeholder="Search..."
        className="w-full pl-8 pr-8 py-1.5 text-base bg-white/6 border border-white/8 rounded-lg text-white/80 placeholder-white/25 focus:outline-none focus:border-navi-blue/50 focus:bg-white/8 transition-all"
      />
      {query ? (
        <button
          onClick={() => { setQuery(''); setShowResults(false); inputRef.current?.focus() }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono pointer-events-none hidden sm:block">⌘F</kbd>
      )}
      {showResults && query.length > 0 && (
        <GlobalSearchResults query={query} onSelect={() => setShowResults(false)} />
      )}
    </div>
  )
}

export function Header({ onMenuClick, onMenuHover }: HeaderProps) {
  const pathname   = usePathname()
  const isPersonal = pathname.startsWith('/personal')

  return (
    <header
      className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-white/6 relative z-[60] transition-colors"
      style={{ backgroundColor: isPersonal ? '#0e1628' : '#171717' }}
    >
      <button
        onClick={onMenuClick}
        onMouseEnter={onMenuHover}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-white/50 hover:text-white/85 hover:bg-white/8 transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="Navi" className="w-full h-full object-cover scale-110" />
        </div>
        <span className="font-bold text-white text-base tracking-tight">Navi</span>
        <ModeBadge />
      </div>

      {/* Search — work mode only */}
      {!isPersonal && <SearchBar />}

      <button className="ml-auto flex-shrink-0 p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/6 transition-all">
        <Bell className="w-4 h-4" />
      </button>
    </header>
  )
}
