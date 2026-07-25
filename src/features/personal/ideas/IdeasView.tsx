'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const PINK    = '#f0a8c8'
const BG      = '#0e1628'
const SURFACE = '#111e35'

const AREA_CHIPS = [
  { key: 'sidoi',            label: 'Sidoi',   color: '#f9a8d4' },
  { key: 'housework',        label: 'Home',    color: '#fb7185' },
  { key: 'personal-finance', label: 'Finance', color: '#22d3ee' },
  { key: 'tobuy',            label: 'To Buy',  color: '#fcd34d' },
] as const

const PERSONAL_AREAS = AREA_CHIPS

const PIPELINE_STATUSES = ['new', 'exploring', 'developing', 'ready'] as const
type PipelineStatus = typeof PIPELINE_STATUSES[number]

const STATUS_META: Record<PipelineStatus, { label: string; color: string }> = {
  new:        { label: 'New',        color: PINK      },
  exploring:  { label: 'Exploring',  color: '#60a5fa' },
  developing: { label: 'Developing', color: '#fbbf24' },
  ready:      { label: 'Ready',      color: '#4ade80' },
}

const SWIPE_THRESHOLD = 72

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubThought {
  id: string
  text: string
}

interface Idea {
  id: string
  category: string
  title: string
  body: string | null
  status: string
  created_at: string
  tags: string[]
  sub_thoughts: SubThought[]
}

type IdeaSection = 'ready' | 'developing' | 'new' | 'shelved'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSection(status: string): IdeaSection {
  if (status === 'ready')                                   return 'ready'
  if (status === 'developing' || status === 'exploring')    return 'developing'
  if (status === 'shelved')                                 return 'shelved'
  return 'new' // 'new', legacy 'active', anything else
}

function toPipelineStatus(status: string): PipelineStatus {
  if (status === 'ready')      return 'ready'
  if (status === 'developing') return 'developing'
  if (status === 'exploring')  return 'exploring'
  return 'new'
}

function fmtAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(diff / 86_400_000)
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function areaColor(key: string): string {
  return AREA_CHIPS.find(a => a.key === key)?.color ?? PINK
}

function areaLabel(key: string): string {
  return AREA_CHIPS.find(a => a.key === key)?.label ?? key
}

function normaliseIdea(raw: Record<string, unknown>): Idea {
  return {
    id:           String(raw.id ?? ''),
    category:     String(raw.category ?? 'General'),
    title:        String(raw.title ?? ''),
    body:         typeof raw.body === 'string' ? raw.body : null,
    status:       String(raw.status ?? 'new'),
    created_at:   String(raw.created_at ?? new Date().toISOString()),
    tags:         Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    sub_thoughts: Array.isArray(raw.sub_thoughts) ? (raw.sub_thoughts as SubThought[]) : [],
  }
}

async function dbWrite(payload: object) {
  return fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    body: JSON.stringify(payload),
  })
}

// ── Swipeable idea card ───────────────────────────────────────────────────────

interface CardProps {
  idea: Idea
  onOpen: (idea: Idea) => void
  onShelve: (idea: Idea) => void
  onConvert: (idea: Idea) => void
  isJustAdded: boolean
}

function IdeaCard({ idea, onOpen, onShelve, onConvert, isJustAdded }: CardProps) {
  const [swipeX, setSwipeX] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swipeLocked = useRef<'h' | 'v' | null>(null)
  const didSwipe    = useRef(false)

  const section    = toSection(idea.status)
  const statusMeta = STATUS_META[toPipelineStatus(idea.status)]

  const borderColor: Record<IdeaSection, string> = {
    ready:      '#4ade80',
    developing: idea.status === 'exploring' ? '#60a5fa' : '#fbbf24',
    new:        PINK,
    shelved:    'rgba(255,255,255,0.15)',
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swipeLocked.current = null
    didSwipe.current    = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!swipeLocked.current) {
      if (Math.abs(dx) > Math.abs(dy) + 5)      swipeLocked.current = 'h'
      else if (Math.abs(dy) > Math.abs(dx) + 5) swipeLocked.current = 'v'
    }
    if (swipeLocked.current === 'h') {
      e.preventDefault()
      const clamped = Math.max(-SWIPE_THRESHOLD * 1.4, Math.min(SWIPE_THRESHOLD * 1.4, dx))
      setSwipeX(clamped)
      if (Math.abs(clamped) > 10) didSwipe.current = true
    }
  }

  const onTouchEnd = () => {
    if (swipeX < -SWIPE_THRESHOLD) onShelve(idea)
    else if (swipeX > SWIPE_THRESHOLD) onOpen(idea)
    setSwipeX(0)
    swipeLocked.current = null
  }

  const swipeProgress = Math.abs(swipeX) / SWIPE_THRESHOLD
  const swipingLeft   = swipeX < -10
  const swipingRight  = swipeX > 10

  // ── Ready cards have no swipe, just inline convert ──
  if (section === 'ready') {
    return (
      <div
        className="rounded-[13px] mb-1.5 overflow-hidden"
        style={{
          border:     `1px solid rgba(74,222,128,0.28)`,
          borderLeft: `3px solid #4ade80`,
          background: `rgba(74,222,128,0.04)`,
          boxShadow:  isJustAdded ? `0 0 0 2px rgba(74,222,128,0.18)` : 'none',
        }}
        onClick={() => onOpen(idea)}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ color: '#4ade80', fontSize: 11, lineHeight: 1 }}>★</span>
            <p className="font-semibold text-white leading-snug flex-1" style={{ fontSize: 13 }}>{idea.title}</p>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {idea.tags.map(t => (
              <span key={t} className="font-medium px-1.5 py-0.5 rounded-md"
                style={{ fontSize: 9.5, background: `${areaColor(t)}1a`, color: areaColor(t) }}>{areaLabel(t)}</span>
            ))}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtAge(idea.created_at)}</span>
          </div>
          {idea.body && (
            <p className="leading-relaxed mb-2 line-clamp-2" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.42)' }}>{idea.body}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold"
              style={{ fontSize: 9.5, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.22)' }}>
              <span className="w-1 h-1 rounded-full bg-current inline-block" />Ready
            </span>
            <button
              onClick={e => { e.stopPropagation(); onConvert(idea) }}
              className="font-bold px-2 py-1 rounded-lg"
              style={{ fontSize: 10, background: `${PINK}18`, color: PINK, border: `1px solid ${PINK}30` }}
            >
              Convert to cycle →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Developing / New / Shelved — swipeable ──
  return (
    <div
      className="relative rounded-[13px] mb-1.5 overflow-hidden touch-pan-y"
      style={{ cursor: 'pointer' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => { if (!didSwipe.current) onOpen(idea) }}
    >
      {swipingLeft && (
        <div className="absolute inset-0 flex items-center justify-end pr-4 rounded-[13px]"
          style={{ background: 'rgba(251,113,133,0.18)', opacity: Math.min(swipeProgress, 1) }}>
          <span className="font-semibold" style={{ fontSize: 11, color: '#fb7185' }}>Shelve</span>
        </div>
      )}
      {swipingRight && (
        <div className="absolute inset-0 flex items-center justify-start pl-4 rounded-[13px]"
          style={{ background: `${PINK}18`, opacity: Math.min(swipeProgress, 1) }}>
          <span className="font-semibold" style={{ fontSize: 11, color: PINK }}>Open</span>
        </div>
      )}

      <div
        className="px-3 py-2.5"
        style={{
          background:   isJustAdded ? `${PINK}0a` : section === 'new' ? 'rgba(255,255,255,0.025)' : SURFACE,
          border:       `1px solid ${isJustAdded ? `${PINK}38` : 'rgba(255,255,255,0.07)'}`,
          borderLeft:   `3px solid ${borderColor[section]}`,
          borderRadius: 13,
          transform:    swipeX ? `translateX(${swipeX}px)` : undefined,
          transition:   swipeX === 0 ? 'transform 0.2s ease' : 'none',
          boxShadow:    isJustAdded ? `0 0 0 2px ${PINK}18` : 'none',
        }}
      >
        <p className="font-semibold text-white leading-snug mb-1" style={{ fontSize: 13 }}>{idea.title}</p>

        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {idea.tags.map(t => (
            <span key={t} className="font-medium px-1.5 py-0.5 rounded-md"
              style={{ fontSize: 9.5, background: `${areaColor(t)}1a`, color: areaColor(t) }}>{t}</span>
          ))}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtAge(idea.created_at)}</span>
        </div>

        {idea.body && section !== 'new' && (
          <p className="leading-relaxed mb-1.5 line-clamp-2" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{idea.body}</p>
        )}

        <div className="flex items-center justify-between mt-0.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold"
            style={{ fontSize: 9.5, background: `${statusMeta.color}15`, color: statusMeta.color, border: `1px solid ${statusMeta.color}28` }}>
            <span className="w-1 h-1 rounded-full bg-current inline-block" />{statusMeta.label}
          </span>
          {section !== 'new' && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>‹ shelve &nbsp;·&nbsp; open ›</span>
          )}
          {isJustAdded && (
            <span className="font-bold px-1.5 py-0.5 rounded"
              style={{ fontSize: 9, background: `${PINK}1a`, color: PINK, border: `1px solid ${PINK}30` }}>
              just added
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Expanded card (full-screen overlay) ──────────────────────────────────────

interface ExpandedCardProps {
  idea: Idea
  onClose: () => void
  onChange: (updated: Idea) => void
  onDelete: (idea: Idea) => void
}

function ExpandedCard({ idea, onClose, onChange, onDelete }: ExpandedCardProps) {
  const [title,       setTitle]       = useState(idea.title)
  const [body,        setBody]        = useState(idea.body ?? '')
  const [status,      setStatus]      = useState(idea.status)
  const [subThoughts, setSubThoughts] = useState<SubThought[]>(idea.sub_thoughts ?? [])
  const [tags,        setTags]        = useState<string[]>(idea.tags ?? [])
  const [newThought,  setNewThought]  = useState('')
  const [newTag,      setNewTag]      = useState('')
  const [addingTag,   setAddingTag]   = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [converting,  setConverting]  = useState(false)

  const [savedFlash, setSavedFlash] = useState(false)

  const thoughtRef    = useRef<HTMLInputElement>(null)
  const tagRef        = useRef<HTMLInputElement>(null)
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build the current idea state for saves
  const currentRef = useRef({ title, body, status, subThoughts, tags })
  useEffect(() => { currentRef.current = { title, body, status, subThoughts, tags } }, [title, body, status, subThoughts, tags])

  const flush = useCallback((patch: Partial<Idea> = {}) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const { title: t, body: b, status: s, subThoughts: st, tags: tg } = currentRef.current
    const updated: Idea = {
      ...idea,
      title: (patch.title ?? t) || idea.title,
      body:  (patch.body  !== undefined ? patch.body  : b.trim() || null),
      status: patch.status ?? s,
      sub_thoughts: patch.sub_thoughts ?? st,
      tags: patch.tags ?? tg,
    }
    onChange(updated)
    dbWrite({ table: 'personal_ideas', operation: 'upsert', data: updated })
    setSavedFlash(true)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setSavedFlash(false), 1500)
  }, [idea, onChange])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => flush(), 800)
  }, [flush])

  useEffect(() => () => {
    if (saveTimerRef.current)  clearTimeout(saveTimerRef.current)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }, [])

  const handleStatusChange = (s: string) => {
    setStatus(s)
    flush({ status: s })
  }

  const handleAddThought = () => {
    const text = newThought.trim()
    if (!text) return
    const thought: SubThought = { id: `st-${Date.now()}`, text }
    const next = [...subThoughts, thought]
    setSubThoughts(next)
    setNewThought('')
    flush({ sub_thoughts: next })
    thoughtRef.current?.focus()
  }

  const handleRemoveThought = (id: string) => {
    const next = subThoughts.filter(st => st.id !== id)
    setSubThoughts(next)
    flush({ sub_thoughts: next })
  }

  const handleAddTag = () => {
    const t = newTag.trim().toLowerCase()
    setAddingTag(false)
    setNewTag('')
    if (!t || tags.includes(t)) return
    const next = [...tags, t]
    setTags(next)
    flush({ tags: next })
  }

  const handleRemoveTag = (t: string) => {
    const next = tags.filter(x => x !== t)
    setTags(next)
    flush({ tags: next })
  }

  const handleConvert = async (areaKey: string) => {
    setConverting(true)
    try {
      await dbWrite({
        table: 'cycles', operation: 'insert',
        data: { id: crypto.randomUUID(), title: idea.title, mode: 'personal', area: areaKey, status: 'active', effort: 'medium', must: false, urgent: false },
      })
      await dbWrite({ table: 'personal_ideas', operation: 'upsert', data: { ...idea, status: 'converted' } })
      onChange({ ...idea, status: 'converted' })
      onClose()
    } catch { /* ignore */ }
    setConverting(false)
  }

  const handleClose = () => {
    flush()
    onClose()
  }

  const pipeStatus = toPipelineStatus(status)
  const isReady    = status === 'ready'

  return (
    <div className="absolute inset-0 flex flex-col z-50" style={{ background: BG }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <button onClick={handleClose} className="font-semibold flex-shrink-0" style={{ fontSize: 13, color: PINK }}>‹ Back</button>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleSave() }}
          onBlur={() => flush()}
          className="flex-1 bg-transparent font-bold text-white outline-none"
          style={{ fontSize: 15 }}
          placeholder="Idea title…"
        />
        <span
          className="flex-shrink-0 transition-opacity duration-700"
          style={{ fontSize: 11, color: 'rgba(134,239,172,0.7)', opacity: savedFlash ? 1 : 0 }}
        >Saved ✓</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Notes */}
        <div className="px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="font-bold uppercase tracking-wider mb-2" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)' }}>Notes</p>
          <textarea
            value={body}
            onChange={e => { setBody(e.target.value); scheduleSave() }}
            onBlur={() => flush()}
            placeholder="Start writing…"
            className="w-full bg-transparent leading-relaxed text-white/60 placeholder-white/20 outline-none resize-none"
            style={{ fontSize: 12.5, minHeight: 64 }}
          />
        </div>

        {/* Status */}
        <div className="px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="font-bold uppercase tracking-wider mb-2.5" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)' }}>Status — tap to move</p>
          <div className="flex gap-1.5 flex-wrap">
            {PIPELINE_STATUSES.map(s => {
              const m      = STATUS_META[s]
              const active = pipeStatus === s
              return (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all"
                  style={active
                    ? { fontSize: 9.5, background: `${m.color}1c`, color: m.color, border: `1px solid ${m.color}38`, outline: `2px solid ${m.color}22`, outlineOffset: 2 }
                    : { fontSize: 9.5, background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {active && <span className="w-1 h-1 rounded-full bg-current inline-block" />}{m.label}
                </button>
              )
            })}
            <button onClick={() => handleStatusChange('shelved')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all"
              style={status === 'shelved'
                ? { fontSize: 9.5, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.2)' }
                : { fontSize: 9.5, background: 'transparent', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              Shelved
            </button>
          </div>
        </div>

        {/* Sub-thoughts */}
        <div className="px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="font-bold uppercase tracking-wider mb-2.5" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)' }}>Sub-thoughts</p>
          <div className="space-y-2.5">
            {subThoughts.map(st => (
              <div key={st.id} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full flex-shrink-0 mt-[7px]" style={{ background: `${PINK}70` }} />
                <span className="flex-1 leading-snug" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>{st.text}</span>
                <button onClick={() => handleRemoveThought(st.id)} className="flex-shrink-0 mt-0.5"
                  style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }}>×</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: `${PINK}38` }} />
            <input
              ref={thoughtRef}
              value={newThought}
              onChange={e => setNewThought(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddThought() } }}
              placeholder="Add a sub-thought…"
              className="flex-1 bg-transparent placeholder-white/20 outline-none"
              style={{ fontSize: 12.5, color: `${PINK}cc` }}
            />
            {newThought.trim() && (
              <button onClick={handleAddThought} className="font-semibold flex-shrink-0" style={{ fontSize: 11, color: PINK }}>Add</button>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="font-bold uppercase tracking-wider mb-2.5" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)' }}>Tags</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md"
                style={{ fontSize: 9.5, background: `${areaColor(t)}1a`, color: areaColor(t) }}>
                {t}
                <button onClick={() => handleRemoveTag(t)} style={{ opacity: 0.65 }}>×</button>
              </span>
            ))}
            {!addingTag ? (
              <button
                onClick={() => { setAddingTag(true); setTimeout(() => tagRef.current?.focus(), 40) }}
                className="px-2 py-0.5 rounded-md"
                style={{ fontSize: 9.5, border: '1px dashed rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.3)' }}
              >+ tag</button>
            ) : (
              <input
                ref={tagRef}
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTag('') } }}
                onBlur={handleAddTag}
                placeholder="tag name"
                className="bg-transparent outline-none w-20"
                style={{ fontSize: 9.5, color: PINK, borderBottom: `1px solid ${PINK}40` }}
              />
            )}
          </div>
        </div>

        {/* Convert + Delete */}
        <div className="px-4 py-4 space-y-3">
          {convertOpen ? (
            <div className="space-y-2.5">
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Add to which area?</p>
              <div className="flex gap-2 flex-wrap">
                {PERSONAL_AREAS.map(a => (
                  <button key={a.key} onClick={() => handleConvert(a.key)} disabled={converting}
                    className="px-3 py-1.5 rounded-xl font-semibold disabled:opacity-40 transition-opacity"
                    style={{ fontSize: 11.5, background: `${a.color}1c`, color: a.color, border: `1px solid ${a.color}38` }}>
                    {a.label}
                  </button>
                ))}
                <button onClick={() => setConvertOpen(false)}
                  className="px-3 py-1.5 rounded-xl"
                  style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConvertOpen(true)}
              disabled={!isReady}
              className="w-full py-3 rounded-xl font-bold disabled:opacity-30 transition-opacity"
              style={{ fontSize: 13, background: `${PINK}16`, color: PINK, border: `1px solid ${PINK}2a` }}
            >
              🔄&nbsp; Convert to cycle →
              {!isReady && <span className="font-normal ml-1.5" style={{ fontSize: 10, color: `${PINK}70` }}>(move to Ready first)</span>}
            </button>
          )}
          <button onClick={() => onDelete(idea)} className="w-full text-center py-1"
            style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.22)' }}>
            Delete idea
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline section ──────────────────────────────────────────────────────────

function PipelineSection({
  label, count, color, ideas,
  onOpen, onShelve, onConvert, justAddedId,
}: {
  label: string; count: number; color: string; ideas: Idea[]
  onOpen: (i: Idea) => void; onShelve: (i: Idea) => void; onConvert: (i: Idea) => void
  justAddedId: string | null
}) {
  if (count === 0) return null
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="font-bold uppercase tracking-wider" style={{ fontSize: 9.5, color: `${color}b0` }}>● {label}</span>
        <span className="px-1.5 py-0.5 rounded-md" style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.22)' }}>{count}</span>
      </div>
      <div className="px-3">
        {ideas.map(idea => (
          <IdeaCard
            key={idea.id} idea={idea}
            onOpen={onOpen} onShelve={onShelve} onConvert={onConvert}
            isJustAdded={idea.id === justAddedId}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function IdeasView({ cat }: { cat?: string } = {}) {
  const [ideas,       setIdeas]       = useState<Idea[]>([])
  const [loading,     setLoading]     = useState(true)
  const [openIdea,    setOpenIdea]    = useState<Idea | null>(null)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [shelvedOpen, setShelvedOpen] = useState(false)
  const [showSearch,  setShowSearch]  = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Capture bar
  const [capture,        setCapture]        = useState('')
  const [captureFocused, setCaptureFocused] = useState(false)
  const [captureTag,     setCaptureTag]     = useState<string | null>(null)
  const captureRef = useRef<HTMLInputElement>(null)

  // Delete undo
  const [pendingDelete, setPendingDelete] = useState<{ id: string; idea: Idea } | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Convert toast
  const [convertToast, setConvertToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/db?table=personal_ideas', { cache: 'no-store', headers: { 'x-api-key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } })
      const json = await res.json()
      if (Array.isArray(json.data)) {
        setIdeas(
          (json.data as Record<string, unknown>[])
            .filter(r => r.status !== 'converted')
            .map(normaliseIdea)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        )
      }
    } catch { /* table may not exist yet */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current) }, [])

  // ── Derived sections ──
  const catFiltered = cat ? ideas.filter(i => i.tags.includes(cat)) : ideas
  const filtered = searchQuery
    ? catFiltered.filter(i =>
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.body ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : catFiltered

  const readyIdeas      = filtered.filter(i => toSection(i.status) === 'ready')
  const developingIdeas = filtered.filter(i => toSection(i.status) === 'developing')
  const newIdeas        = filtered.filter(i => toSection(i.status) === 'new')
  const shelvedIdeas    = filtered.filter(i => toSection(i.status) === 'shelved')
  const totalActive     = readyIdeas.length + developingIdeas.length + newIdeas.length

  // ── Capture ──
  const handleCapture = async () => {
    const text = capture.trim()
    if (!text) return
    const newId = crypto.randomUUID()
    const now   = new Date().toISOString()
    const tg    = captureTag ? [captureTag] : []
    const fresh: Idea = {
      id: newId, category: captureTag ?? 'General',
      title: text, body: null, status: 'new',
      created_at: now, tags: tg, sub_thoughts: [],
    }
    setIdeas(prev => [fresh, ...prev])
    setCapture('')
    setCaptureTag(null)
    captureRef.current?.blur()
    setCaptureFocused(false)
    setJustAddedId(newId)
    setTimeout(() => setJustAddedId(null), 3500)
    try {
      await dbWrite({ table: 'personal_ideas', operation: 'upsert', data: fresh })
    } catch { /* ignore */ }
  }

  // ── Open / close ──
  const handleOpen  = (idea: Idea) => setOpenIdea(idea)
  const handleClose = () => setOpenIdea(null)

  const handleChange = (updated: Idea) => {
    if (updated.status === 'converted') {
      setIdeas(prev => prev.filter(i => i.id !== updated.id))
      setOpenIdea(null)
      setConvertToast('Added to cycles ✓')
      setTimeout(() => setConvertToast(null), 3000)
      return
    }
    setIdeas(prev => prev.map(i => i.id === updated.id ? updated : i))
    if (openIdea?.id === updated.id) setOpenIdea(updated)
  }

  const handleShelve = (idea: Idea) => {
    const updated = { ...idea, status: 'shelved' }
    setIdeas(prev => prev.map(i => i.id === idea.id ? updated : i))
    dbWrite({ table: 'personal_ideas', operation: 'upsert', data: updated })
  }

  const handleDelete = (idea: Idea) => {
    setIdeas(prev => prev.filter(i => i.id !== idea.id))
    setOpenIdea(null)
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
    setIdeas(prev =>
      [pendingDelete.idea, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    )
    setPendingDelete(null)
  }

  // ── Render ──
  return (
    <div className="flex-1 flex flex-col relative" style={{ background: BG }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h1 className="font-extrabold" style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)' }}>
          Ideas{cat ? <span className="font-semibold ml-2" style={{ fontSize: 13, color: areaColor(cat) }}>{areaLabel(cat)}</span> : null}
        </h1>
        <button
          onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery('') }}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          {showSearch
            ? <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
            : <Search className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
          }
        </button>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="px-4 pb-2">
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ideas…"
            className="w-full text-white placeholder-white/25 outline-none px-3 py-2 rounded-xl"
            style={{ fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          />
        </div>
      )}

      {/* Summary bar */}
      {!loading && totalActive > 0 && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-xl flex items-center gap-1.5 flex-wrap"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
            {ideas.filter(i => toSection(i.status) !== 'shelved').length} ideas
          </span>
          {developingIdeas.length > 0 && (
            <>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.22)' }}>·</span>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{developingIdeas.length} developing</span>
            </>
          )}
          {readyIdeas.length > 0 && (
            <>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.22)' }}>·</span>
              <span className="font-semibold" style={{ fontSize: 11.5, color: PINK }}>{readyIdeas.length} ready to act</span>
            </>
          )}
        </div>
      )}

      {/* Pipeline */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: `${PINK}60` }} />
          </div>
        ) : totalActive === 0 && shelvedIdeas.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-2 text-center">
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
              {searchQuery ? 'No ideas match your search' : 'No ideas yet'}
            </p>
            {!searchQuery && (
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.12)' }}>Use the bar below to capture your first idea</p>
            )}
          </div>
        ) : (
          <>
            <PipelineSection
              label="Ready to act" count={readyIdeas.length} color="#4ade80" ideas={readyIdeas}
              onOpen={handleOpen} onShelve={handleShelve} onConvert={handleOpen} justAddedId={justAddedId}
            />
            {readyIdeas.length > 0 && (developingIdeas.length > 0 || newIdeas.length > 0) && (
              <div className="mx-4 my-0.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            )}
            <PipelineSection
              label="Developing" count={developingIdeas.length} color="#fbbf24" ideas={developingIdeas}
              onOpen={handleOpen} onShelve={handleShelve} onConvert={handleOpen} justAddedId={justAddedId}
            />
            {developingIdeas.length > 0 && newIdeas.length > 0 && (
              <div className="mx-4 my-0.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            )}
            <PipelineSection
              label="New" count={newIdeas.length} color={PINK} ideas={newIdeas}
              onOpen={handleOpen} onShelve={handleShelve} onConvert={handleOpen} justAddedId={justAddedId}
            />

            {/* Shelved collapsed */}
            {shelvedIdeas.length > 0 && (
              <div className="mx-3 mt-2 mb-1">
                <button
                  onClick={() => setShelvedOpen(s => !s)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span className="font-medium" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>Shelved ideas</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>{shelvedIdeas.length} {shelvedOpen ? '▴' : '▾'}</span>
                </button>
                {shelvedOpen && (
                  <div className="mt-1">
                    {shelvedIdeas.map(idea => (
                      <IdeaCard
                        key={idea.id} idea={idea}
                        onOpen={handleOpen} onShelve={handleShelve} onConvert={handleOpen}
                        isJustAdded={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture bar */}
      <div
        className="flex-shrink-0 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: BG }}
      >
        {/* Chip tray — appears when focused */}
        {captureFocused && (
          <div className="flex items-center gap-2 px-3 pt-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <span className="flex-shrink-0" style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>tag:</span>
            {AREA_CHIPS.map(a => (
              <button
                key={a.key}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setCaptureTag(captureTag === a.key ? null : a.key)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold flex-shrink-0 transition-all"
                style={captureTag === a.key
                  ? { fontSize: 11, background: `${a.color}20`, color: a.color, border: `1px solid ${a.color}40` }
                  : { fontSize: 11, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2 px-3 py-3.5">
          <div
            className="flex-1 flex items-center gap-2 px-3.5 py-3 rounded-2xl transition-all"
            style={{
              background: SURFACE,
              border:     captureFocused ? `1.5px solid ${PINK}` : `1px solid ${PINK}38`,
              boxShadow:  captureFocused ? `0 0 0 3px ${PINK}12` : 'none',
            }}
          >
            {captureTag && captureFocused && (
              <span className="font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ fontSize: 9.5, background: `${areaColor(captureTag)}1a`, color: areaColor(captureTag) }}>
                {areaLabel(captureTag)}
              </span>
            )}
            <input
              ref={captureRef}
              value={capture}
              onChange={e => setCapture(e.target.value)}
              onFocus={() => setCaptureFocused(true)}
              onBlur={() => setTimeout(() => setCaptureFocused(false), 200)}
              onKeyDown={e => { if (e.key === 'Enter') handleCapture() }}
              placeholder="What's on your mind…"
              className="flex-1 bg-transparent text-white placeholder-white/25 outline-none"
              style={{ fontSize: 14 }}
            />
          </div>
          <button
            onClick={handleCapture}
            disabled={!capture.trim()}
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
            style={{ background: capture.trim() ? PINK : `${PINK}22` }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke={capture.trim() ? BG : `${PINK}60`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11V3M3 7l4-4 4 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded card overlay */}
      {openIdea && (
        <ExpandedCard
          idea={openIdea}
          onClose={handleClose}
          onChange={handleChange}
          onDelete={handleDelete}
        />
      )}

      {/* Delete undo toast */}
      {pendingDelete && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', minWidth: 200 }}>
          <span className="flex-1" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Idea deleted</span>
          <button onClick={handleUndoDelete} className="font-semibold flex-shrink-0" style={{ fontSize: 13, color: PINK }}>Undo</button>
        </div>
      )}

      {/* Convert success toast */}
      {convertToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="font-medium" style={{ fontSize: 13, color: '#4ade80' }}>{convertToast}</span>
        </div>
      )}

    </div>
  )
}
