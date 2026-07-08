'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Plus, Trash2, X, Search } from 'lucide-react'

const PINK = '#f0a8c8'
const BG   = '#0e1628'

const CATEGORIES = ['AI', 'Art', 'Pending'] as const
type Category = typeof CATEGORIES[number]

const STATUSES = ['active', 'exploring', 'developing', 'shelved'] as const
type IdeaStatus = typeof STATUSES[number]

const STATUS_META: Record<IdeaStatus, { label: string; color: string }> = {
  active:     { label: 'Active',     color: '#4ade80' },
  exploring:  { label: 'Exploring',  color: '#60a5fa' },
  developing: { label: 'Developing', color: '#fbbf24' },
  shelved:    { label: 'Shelved',    color: 'rgba(255,255,255,0.35)' },
}

const PERSONAL_AREAS = [
  { key: 'housework',        label: 'Housework', color: '#fb7185' },
  { key: 'personal-finance', label: 'Finance',   color: '#22d3ee' },
  { key: 'sidoi',            label: 'Sidoi',     color: '#f9a8d4' },
  { key: 'tobuy',            label: 'To Buy',    color: '#fcd34d' },
] as const

interface Idea {
  id: string
  category: string
  title: string
  body: string | null
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

async function dbWrite(payload: object) {
  return fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function IdeasView({ cat }: { cat?: string }) {
  const [ideas, setIdeas]             = useState<Idea[]>([])
  const [loading, setLoading]         = useState(true)
  // Add form
  const [adding, setAdding]           = useState(false)
  const [newTitle, setNewTitle]       = useState('')
  const [newBody, setNewBody]         = useState('')
  const [newCat, setNewCat]           = useState<Category>('Pending')
  const [saving, setSaving]           = useState(false)
  // Expand / edit
  const [expandedId, setExpanded]     = useState<string | null>(null)
  const [editTitle, setEditTitle]     = useState('')
  const [editBody, setEditBody]       = useState('')
  const [editSaving, setEditSaving]   = useState(false)
  // Delete with undo
  const [pendingDelete, setPendingDelete] = useState<{ id: string; idea: Idea } | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Convert to cycle
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [converting, setConverting]   = useState(false)
  const [convertToast, setConvertToast] = useState<string | null>(null)
  // Filters
  const [search, setSearch]           = useState('')
  const [showShelved, setShowShelved] = useState(false)

  const activeCategory = cat
    ? (CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase()) ?? null)
    : null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/db?table=personal_ideas', { cache: 'no-store' })
      const json = await res.json()
      if (Array.isArray(json.data)) {
        setIdeas(
          (json.data as Idea[])
            .filter(i => i.status !== 'converted')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        )
      }
    } catch { /* table may not exist yet */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current) }, [])

  const displayed = ideas.filter(idea => {
    if (!showShelved && idea.status === 'shelved') return false
    if (activeCategory && idea.category.toLowerCase() !== activeCategory.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      return idea.title.toLowerCase().includes(q) || (idea.body ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const shelvedCount = ideas.filter(i => i.status === 'shelved').length

  // ── Add ──────────────────────────────────────────────────────────────────────

  const cancelAdd = () => { setAdding(false); setNewTitle(''); setNewBody('') }

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setSaving(true)
    try {
      const res  = await dbWrite({
        table: 'personal_ideas',
        operation: 'insert',
        data: { category: newCat, title, body: newBody.trim() || null, status: 'active' },
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setNewTitle('')
      setNewBody('')
      setNewCat(activeCategory ?? 'Pending')
      setAdding(false)
      await load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  // ── Delete with undo ─────────────────────────────────────────────────────────

  const handleDelete = (idea: Idea, e: React.MouseEvent) => {
    e.stopPropagation()
    setIdeas(prev => prev.filter(i => i.id !== idea.id))
    if (expandedId === idea.id) { setExpanded(null); setConvertingId(null) }
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    setPendingDelete({ id: idea.id, idea })
    deleteTimerRef.current = setTimeout(() => {
      setPendingDelete(null)
      dbWrite({ table: 'personal_ideas', operation: 'delete', matchId: idea.id })
    }, 5000)
  }

  const handleUndoDelete = () => {
    if (!pendingDelete) return
    if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null }
    const restored = pendingDelete.idea
    setIdeas(prev =>
      [restored, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    )
    setPendingDelete(null)
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  const openExpand = (idea: Idea) => {
    setExpanded(idea.id)
    setEditTitle(idea.title)
    setEditBody(idea.body ?? '')
    setConvertingId(null)
  }

  const closeExpand = () => { setExpanded(null); setConvertingId(null) }

  const handleSaveEdit = async (idea: Idea) => {
    const title = editTitle.trim()
    if (!title) return
    setEditSaving(true)
    const updated: Idea = { ...idea, title, body: editBody.trim() || null }
    setIdeas(prev => prev.map(i => i.id === idea.id ? updated : i))
    try {
      await dbWrite({ table: 'personal_ideas', operation: 'upsert', data: updated })
    } catch { /* ignore */ }
    setEditSaving(false)
    closeExpand()
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  const handleStatusChange = (idea: Idea, newStatus: IdeaStatus) => {
    const updated: Idea = { ...idea, status: newStatus }
    setIdeas(prev => prev.map(i => i.id === idea.id ? updated : i))
    dbWrite({ table: 'personal_ideas', operation: 'upsert', data: updated })
  }

  // ── Convert to cycle ─────────────────────────────────────────────────────────

  const handleConvert = async (idea: Idea, areaKey: string) => {
    setConverting(true)
    try {
      await dbWrite({
        table: 'cycles',
        operation: 'insert',
        data: {
          title: idea.title,
          mode: 'personal',
          area: areaKey,
          status: 'open',
          effort: 'medium',
          must: false,
          urgent: false,
        },
      })
      await dbWrite({ table: 'personal_ideas', operation: 'upsert', data: { ...idea, status: 'converted' } })
      setIdeas(prev => prev.filter(i => i.id !== idea.id))
      setExpanded(null)
      setConvertingId(null)
      const label = PERSONAL_AREAS.find(a => a.key === areaKey)?.label ?? areaKey
      setConvertToast(`Added to ${label}`)
      setTimeout(() => setConvertToast(null), 3000)
    } catch { /* ignore */ }
    setConverting(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
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
        {shelvedCount > 0 && (
          <button
            onClick={() => setShowShelved(s => !s)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={
              showShelved
                ? { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.2)' }
                : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            Shelved ({shelvedCount})
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ideas..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'rgba(255,255,255,0.3)' }}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
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
            {search
              ? 'No ideas match your search'
              : activeCategory
                ? `No ${activeCategory} ideas yet`
                : 'No ideas yet — add one above'}
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(idea => {
              const color      = catColor(idea.category)
              const isExpanded = expandedId === idea.id
              const status     = STATUSES.includes(idea.status as IdeaStatus) ? idea.status as IdeaStatus : 'active'
              const sMeta      = STATUS_META[status]

              if (isExpanded) {
                return (
                  <div key={idea.id} className="p-4 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: `1px solid ${PINK}30` }}>

                    {/* Editable title */}
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') closeExpand() }}
                      className="w-full bg-transparent text-sm font-semibold text-white outline-none mb-2"
                    />

                    {/* Editable body */}
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      placeholder="Add details..."
                      rows={3}
                      className="w-full bg-transparent text-xs leading-relaxed placeholder-white/25 outline-none resize-none mb-3"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    />

                    {/* Status pills */}
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {STATUSES.map(s => {
                        const m      = STATUS_META[s]
                        const active = status === s
                        return (
                          <button key={s}
                            onClick={() => handleStatusChange(idea, s)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                            style={
                              active
                                ? { backgroundColor: `${m.color}20`, color: m.color, border: `1px solid ${m.color}50` }
                                : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
                            }
                          >
                            {m.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Convert to cycle */}
                    {convertingId === idea.id ? (
                      <div className="mb-3">
                        <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Add to area:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {PERSONAL_AREAS.map(a => (
                            <button key={a.key}
                              onClick={() => handleConvert(idea, a.key)}
                              disabled={converting}
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-50"
                              style={{ backgroundColor: `${a.color}20`, color: a.color, border: `1px solid ${a.color}50` }}
                            >
                              {a.label}
                            </button>
                          ))}
                          <button onClick={() => setConvertingId(null)}
                            className="px-2.5 py-1 rounded-full text-[11px]"
                            style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConvertingId(idea.id)}
                        className="block text-[11px] font-semibold mb-3"
                        style={{ color: PINK }}
                      >
                        → Make cycle
                      </button>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2.5"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${color}15`, color }}>
                          {idea.category}
                        </span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {fmtDate(idea.created_at)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={closeExpand}
                          className="px-3 py-1 rounded-full text-xs"
                          style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(idea)}
                          disabled={!editTitle.trim() || editSaving}
                          className="px-3 py-1 rounded-full text-xs font-semibold disabled:opacity-40"
                          style={{ backgroundColor: `${PINK}25`, color: PINK, border: `1px solid ${PINK}50` }}
                        >
                          {editSaving ? '…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              // Collapsed card
              return (
                <div
                  key={idea.id}
                  onClick={() => openExpand(idea)}
                  className="p-4 rounded-xl cursor-pointer transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white leading-snug flex-1">{idea.title}</p>
                    <button
                      onClick={e => handleDelete(idea, e)}
                      className="flex-shrink-0 mt-0.5 transition-opacity"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {idea.body && (
                    <p className="text-xs mt-1.5 leading-relaxed line-clamp-2"
                      style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {idea.body}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${color}15`, color }}>
                      {idea.category}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: sMeta.color }}>
                      {sMeta.label}
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

      {/* Delete undo toast */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl"
          style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', minWidth: 220 }}>
          <span className="text-sm flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Idea deleted</span>
          <button onClick={handleUndoDelete}
            className="text-sm font-semibold shrink-0"
            style={{ color: PINK }}>
            Undo
          </button>
        </div>
      )}

      {/* Convert success toast */}
      {convertToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl"
          style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-sm font-medium" style={{ color: '#4ade80' }}>✓ {convertToast}</span>
        </div>
      )}

    </div>
  )
}
