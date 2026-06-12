'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Bell, X } from 'lucide-react'
import { useSearch } from '@/shared/lib/search-context'
import { GlobalSearchResults } from './GlobalSearchResults'

export function Header() {
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
    <header className="h-14 flex items-center gap-4 px-6 border-b border-white/6 bg-[#171717] flex-shrink-0 relative z-40">
      {/* Search — full left side */}
      <div className="flex-1 max-w-md relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
            onFocus={() => { if (query) setShowResults(true) }}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder="Search tasks, cycles, notes..."
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-white/6 border border-white/8 rounded-lg text-white/80 placeholder-white/25 focus:outline-none focus:border-navi-blue/50 focus:bg-white/8 transition-all"
          />
          {query ? (
            <button
              onClick={() => { setQuery(''); setShowResults(false); inputRef.current?.focus() }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono pointer-events-none">⌘F</kbd>
          )}
        </div>

        {/* Global search dropdown */}
        {showResults && query.length > 0 && (
          <GlobalSearchResults
            query={query}
            onSelect={() => { setShowResults(false) }}
          />
        )}
      </div>

      {/* Right side — bell only */}
      <div className="ml-auto">
        <button className="relative p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/6 transition-all">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
