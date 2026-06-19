'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Trash2, X } from 'lucide-react'

const PINK = '#f0a8c8'
const BG   = '#0e1628'

const CATEGORIES = ['AI', 'Art', 'Pending'] as const
type Category = typeof CATEGORIES[number]

interface Idea {
  id: string
  category: string
  title: string
  body: string
  status: string
  created_at: string
}

function catColor(c: string) {
  switch (c.toLowerCase()) {
    case 'ai':      return '#60a5fa'
    case 'art':     return '#fb7185'
    case 'pending': return '#fcd34d'
    default:        return PINK
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })
}

export function IdeasView({ cat }: { cat?: string }) {
  const [ideas, setIdeas]         = useState<Idea[]>([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [newTitle, setNewTitle]   = useState('')
  const [newBody, setNewBody]     = useState('')
  const [newCat, setNewCat]       = useState<Category>('Pending')
  const [saving, setSaving]       = useState(false)
  const [expandedId, setExpanded] = useState<string | null>(null)

  const activeCategory = cat
    ? (CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase()) ?? null)
    : null

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/db?table=personal_ideas', { cache: 'no-store' })
      const json = await res.json()
      if (Array.isArray(json.data)) {
        const active = (json.data as Idea[])
          .filter(i => i.status === 'active')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setIdeas(active)
      }
    } catch { /* table may not exist yet */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const displayed = activeCategory
    ? ideas.filter(i => i.category.toLowerCase() === activeCategory.toLowerCase())
    : ideas

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setSaving(true)
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'personal_ideas',
          operation: 'insert',
          data: { category: newCat, title, body: newBody.trim(), status: 'active' },
        }),
      })
      setNewTitle('')
      setNewBody('')
      setNewCat(activeCategory ?? 'Pending')
      setAdding(false)
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id))
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'personal_ideas', operation: 'delete', matchId: id }),
    }).catch(() => { /* ignore */ })
  }

  const cancelAdd = () => {
    setAdding(false)
    setNewTitle('')
    setNewBody('')
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: BG }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">
          {activeCategory ? `${activeCategory} Ideas` : 'Ideas'}
        </h1>
        <button
          onClick={() => adding ? cancelAdd() : setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{ backgroundColor: `${PINK}18`, border: `1px solid ${PINK}40`, color: PINK }}
        >
          {adding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {adding ? 'Cancel' : 'New idea'}
        </button>
      </div>

      {/* Category tabs */}
      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
        <Link href="/personal/ideas"
          className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
          style={
            !activeCategory
              ? { backgroundColor: `${PINK}20`, color: PINK, border: `1px solid ${PINK}50` }
              : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)' }
          }
        >
          All
        </Link>
        {CATEGORIES.map(c => {
          const isActive = activeCategory === c
          const color    = catColor(c)
          return (
            <Link key={c} href={`/personal/ideas/${c.toLowerCase()}`}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={
                isActive
                  ? { backgroundColor: `${color}20`, color, border: `1px solid ${color}50` }
                  : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)' }
              }
            >
              {c}
            </Link>
          )
        })}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mx-5 mb-3 p-4 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } }}
            placeholder="Idea title..."
            className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none mb-2"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Details (optional)..."
            rows={2}
            className="w-full bg-transparent text-sm text-white/60 placeholder-white/25 outline-none resize-none mb-3"
          />
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-1 flex-wrap">
              {CATEGORIES.map(c => {
                const color = catColor(c)
                const sel   = newCat === c
                return (
                  <button key={c} onClick={() => setNewCat(c)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                    style={
                      sel
                        ? { backgroundColor: `${color}25`, color, border: `1px solid ${color}60` }
                        : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
                    }
                  >
                    {c}
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || saving}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-40"
              style={{ backgroundColor: `${PINK}25`, color: PINK, border: `1px solid ${PINK}50` }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Ideas list */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: `${PINK}60` }} />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {activeCategory ? `No ${activeCategory} ideas yet` : 'No ideas yet — add one above'}
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(idea => {
              const color    = catColor(idea.category)
              const expanded = expandedId === idea.id
              return (
                <div
                  key={idea.id}
                  onClick={() => setExpanded(expanded ? null : idea.id)}
                  className="p-4 rounded-xl cursor-pointer transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white leading-snug flex-1">{idea.title}</p>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(idea.id) }}
                      className="flex-shrink-0 mt-0.5 transition-opacity"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {idea.body && (
                    <p className={`text-xs mt-1.5 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}
                      style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {idea.body}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${color}15`, color }}>
                      {idea.category}
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {fmtDate(idea.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
