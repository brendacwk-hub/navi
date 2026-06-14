'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Bell, X, Menu } from 'lucide-react'
import { useSearch } from '@/shared/lib/search-context'
import { GlobalSearchResults } from './GlobalSearchResults'

interface HeaderProps {
  onMenuClick: () => void
  onMenuHover?: () => void
  menuOpen?: boolean
}

export function Header({ onMenuClick, onMenuHover }: HeaderProps) {
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
    <header className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-white/6 bg-[#171717] z-50">
      {/* Hamburger toggle */}
      <button
        onClick={onMenuClick}
        onMouseEnter={onMenuHover}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-white/50 hover:text-white/85 hover:bg-white/8 transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Navi logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="Navi" className="w-full h-full object-cover scale-110" />
        </div>
        <span className="font-bold text-white text-base tracking-tight">Navi</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 font-medium">Work</span>
      </div>

      {/* Search bar */}
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

      {/* Bell */}
      <button className="ml-auto flex-shrink-0 p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/6 transition-all">
        <Bell className="w-4 h-4" />
      </button>
    </header>
  )
}
