'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const PINK = '#f0a8c8'
const MOODS = ['😄', '🙂', '😐', '😔', '😢']

type Mode  = 'prompt' | 'freewrite'
type Phase = 'home' | 'picking' | 'writing'

interface PromptEntry { question: string; answer: string }
interface DiaryEntry {
  id: string
  mood: string
  prompts: PromptEntry[]
  body: string
  created_at: string
}

function todayKey() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

async function dbRead(table: string, eq?: { col: string; val: string }): Promise<unknown[]> {
  const p = new URLSearchParams({ table })
  if (eq) { p.set('eqCol', eq.col); p.set('eqVal', eq.val) }
  try {
    const res = await fetch(`/api/db?${p}`, { cache: 'no-store' })
    const json = await res.json()
    return json.data ?? []
  } catch { return [] }
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function matchesQuery(entry: DiaryEntry, q: string) {
  const lq = q.toLowerCase()
  if (entry.body?.toLowerCase().includes(lq)) return true
  if (entry.id.includes(lq)) return true
  if (new Date(entry.id + 'T12:00:00')
    .toLocaleDateString('en-HK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .toLowerCase().includes(lq)) return true
  return (entry.prompts ?? []).some(
    p => p.answer?.toLowerCase().includes(lq) || p.question?.toLowerCase().includes(lq)
  )
}

export function DiaryView() {
  const today     = todayKey()
  const dateLabel = new Date().toLocaleDateString('en-HK', { weekday: 'long', day: 'numeric', month: 'long' })

  const [phase, setPhase]             = useState<Phase>('home')
  const [mode, setMode]               = useState<Mode>('freewrite')
  const [mood, setMood]               = useState('')
  const [questions, setQuestions]     = useState<string[]>([])
  const [answers, setAnswers]         = useState<string[]>([])
  const [body, setBody]               = useState('')
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [savedAt, setSavedAt]         = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [hasEntry, setHasEntry]       = useState(false)
  const [todayEntry, setTodayEntry]   = useState<DiaryEntry | null>(null)
  const [pastEntries, setPastEntries] = useState<DiaryEntry[]>([])
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting]     = useState(false)
  const [exportDocs, setExportDocs]   = useState<{ year: number; url: string; entries: number }[]>([])
  const [exportError, setExportError] = useState('')

  const initialized    = useRef(false)
  const promptsFetched = useRef(false)

  // ── Fetch Gemini prompts ───────────────────────────────────────────────────
  const fetchPrompts = useCallback(async () => {
    if (promptsFetched.current) return
    promptsFetched.current = true
    setLoadingPrompts(true)
    try {
      const res  = await fetch(`/api/diary/prompts?date=${today}`)
      const json = await res.json()
      if (Array.isArray(json.prompts) && json.prompts.length > 0) {
        setQuestions(json.prompts)
        setAnswers(json.prompts.map(() => ''))
      }
    } catch { /* fallback */ }
    setLoadingPrompts(false)
  }, [today])

  // ── Load today + past entries ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      const rows = await dbRead('diary_entries', { col: 'id', val: today })
      if (cancelled) return

      if (rows.length > 0) {
        const entry = rows[0] as DiaryEntry
        setMood(entry.mood ?? '')
        setBody(entry.body ?? '')
        setHasEntry(true)
        setTodayEntry(entry)
        if (Array.isArray(entry.prompts) && entry.prompts.length > 0) {
          setQuestions(entry.prompts.map(p => p.question))
          setAnswers(entry.prompts.map(p => p.answer))
          promptsFetched.current = true
          setMode('prompt')
        } else {
          setMode('freewrite')
        }
        // Stay on home — user taps Edit to open writing phase
      }

      const all = await dbRead('diary_entries')
      if (!cancelled) {
        const past = (all as DiaryEntry[])
          .filter(e => e.id !== today)
          .sort((a, b) => b.id.localeCompare(a.id))
          .slice(0, 30)
        setPastEntries(past)
        initialized.current = true
      }
    }
    init()
    return () => { cancelled = true }
  }, [today])

  // ── Filtered past entries ─────────────────────────────────────────────────
  const filteredPast = searchQuery.trim()
    ? pastEntries.filter(e => matchesQuery(e, searchQuery))
    : pastEntries

  // ── Choose mode ───────────────────────────────────────────────────────────
  function chooseMode(m: Mode) {
    setMode(m)
    setPhase('writing')
    if (m === 'prompt' && !promptsFetched.current) fetchPrompts()
  }

  // ── Handlers (no auto-save) ────────────────────────────────────────────────
  function handleMood(m: string) {
    setMood(m === mood ? '' : m)
  }
  function handleAnswer(i: number, val: string) {
    const next = [...answers]; next[i] = val
    setAnswers(next)
  }
  function handleBody(val: string) {
    setBody(val)
  }

  async function handleSave() {
    setSaving(true)
    const savedEntry: DiaryEntry = {
      id: today,
      mood,
      prompts: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
      body,
      created_at: new Date().toISOString(),
    }
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'diary_entries',
          operation: 'upsert',
          data: savedEntry,
        }),
      })
    } catch { /* silent */ }
    const t = new Date()
    setSavedAt(`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`)
    setSaving(false)
    setHasEntry(true)
    setTodayEntry(savedEntry)
    setPhase('home')
  }

  function refreshPrompts() {
    promptsFetched.current = false
    setQuestions([])
    setAnswers([])
    fetchPrompts()
  }

  // ── Google Docs export ────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true)
    setExportError('')
    setExportDocs([])
    try {
      const apiKey = process.env.NEXT_PUBLIC_NAVI_API_KEY ?? ''
      const res  = await fetch(`/api/diary/gdocs${apiKey ? `?apiKey=${apiKey}` : ''}`, { method: 'POST' })
      const json = await res.json()
      if (json.docs) {
        setExportDocs(json.docs)
      } else {
        setExportError(json.error ?? 'Export failed')
      }
    } catch {
      setExportError('Could not reach export API')
    }
    setExporting(false)
  }

  const taStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: HOME
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'home') {
    const todayPreview = todayEntry
      ? (todayEntry.prompts?.find(p => p.answer)?.answer || todayEntry.body || '').slice(0, 100)
      : ''

    return (
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10 space-y-5" style={{ backgroundColor: '#0e1628' }}>

        {/* Header */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-white">Diary</h2>
          <span className="text-xs" style={{ color: `${PINK}80` }}>{dateLabel}</span>
        </div>

        {/* Today */}
        {!hasEntry ? (
          <button onClick={() => setPhase('picking')}
            className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${PINK}18, ${PINK}08)`,
              border: `1px solid ${PINK}40`,
              color: PINK,
            }}>
            + Write today&apos;s diary
          </button>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${PINK}10, ${PINK}06)`, border: `1px solid ${PINK}35` }}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{todayEntry?.mood || '📝'}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: PINK }}>Today&apos;s entry</p>
                  {savedAt && <p className="text-[10px]" style={{ color: `${PINK}55` }}>saved at {savedAt}</p>}
                </div>
              </div>
              <button
                onClick={() => setPhase('writing')}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                style={{ backgroundColor: `${PINK}20`, border: `1px solid ${PINK}35`, color: PINK }}>
                Edit
              </button>
            </div>
            {todayPreview && (
              <div className="px-4 pb-3 -mt-0.5">
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.32)' }}>
                  {todayPreview}{todayPreview.length >= 100 ? '…' : ''}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search bar — visible once any entry exists */}
        {(hasEntry || pastEntries.length > 0) && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-white/25 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entries…"
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-white/25 text-xs hover:text-white/50 transition-colors">✕</button>
            )}
          </div>
        )}

        {/* Past entries */}
        {pastEntries.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
                {searchQuery.trim()
                  ? `${filteredPast.length} result${filteredPast.length !== 1 ? 's' : ''}`
                  : 'Past entries'}
              </p>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-40"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.4)',
                }}>
                {exporting ? '⏳' : '↑ Google Docs'}
              </button>
            </div>

            {exportDocs.length > 0 && (
              <div className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${PINK}30`, backgroundColor: `${PINK}08` }}>
                {exportDocs.map(d => (
                  <a key={d.year} href={d.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-white/4 transition-colors"
                    style={{ borderColor: `${PINK}20` }}>
                    <span className="text-sm font-medium" style={{ color: PINK }}>{d.year} Diary</span>
                    <span className="text-xs text-white/30">{d.entries} entries  →</span>
                  </a>
                ))}
              </div>
            )}
            {exportError && (
              <p className="text-xs mb-3" style={{ color: '#fca5a5' }}>{exportError}</p>
            )}

            <div className="space-y-2">
              {filteredPast.length > 0
                ? filteredPast.map(e => <EntryCard key={e.id} entry={e} searchQuery={searchQuery} expanded={expanded} setExpanded={setExpanded} />)
                : searchQuery.trim() && (
                  <p className="text-sm text-white/25 text-center py-6">No entries match &quot;{searchQuery}&quot;</p>
                )}
            </div>
          </section>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: PICKING MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'picking') {
    return (
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10 space-y-6" style={{ backgroundColor: '#0e1628' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase('home')} className="text-white/35 text-sm hover:text-white/60 transition-colors">← Back</button>
          <h2 className="text-lg font-semibold text-white">How do you want to write?</h2>
        </div>
        <div className="space-y-3 pt-2">
          <button onClick={() => chooseMode('freewrite')}
            className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-3xl mb-3">📝</div>
            <div className="text-base font-semibold text-white mb-1">Free write</div>
            <div className="text-sm text-white/40 leading-relaxed">Just a blank page. Write whatever is on your mind — no structure, no prompts.</div>
          </button>
          <button onClick={() => chooseMode('prompt')}
            className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${PINK}12, ${PINK}06)`, border: `1px solid ${PINK}35` }}>
            <div className="text-3xl mb-3">✨</div>
            <div className="text-base font-semibold mb-1" style={{ color: PINK }}>Prompt</div>
            <div className="text-sm text-white/40 leading-relaxed">Gemini generates 2 personal questions to guide your reflection.</div>
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: WRITING
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10 space-y-5" style={{ backgroundColor: '#0e1628' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase('home')} className="text-white/35 text-sm hover:text-white/60 transition-colors">←</button>
          <h2 className="text-lg font-semibold text-white">Diary</h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full"
          style={mode === 'prompt'
            ? { backgroundColor: `${PINK}15`, color: PINK }
            : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
          {mode === 'prompt' ? '✨ Prompt' : '📝 Free write'}
        </span>
      </div>

      <span className="text-xs" style={{ color: `${PINK}70` }}>{dateLabel}</span>

      {/* Mood picker */}
      <section>
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">How are you feeling?</p>
        <div className="flex gap-2.5">
          {MOODS.map(m => (
            <button key={m} onClick={() => handleMood(m)}
              className="text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95"
              style={mood === m
                ? { outline: `2px solid ${PINK}`, outlineOffset: '3px', opacity: 1, transform: 'scale(1.1)' }
                : { opacity: 0.4 }}>
              {m}
            </button>
          ))}
        </div>
      </section>

      {/* Prompt mode */}
      {mode === 'prompt' && (
        <section className="space-y-4">
          {/* Refresh button — always visible in prompt mode */}
          <div className="flex justify-end -mb-1">
            <button onClick={refreshPrompts} disabled={loadingPrompts}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
              style={{
                backgroundColor: `${PINK}15`,
                border: `1px solid ${PINK}30`,
                color: PINK,
              }}>
              ↻ New questions
            </button>
          </div>

          {loadingPrompts ? (
            <>
              <div className="h-4 rounded-md animate-pulse w-3/4" style={{ backgroundColor: `${PINK}18` }} />
              <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
              <div className="h-4 rounded-md animate-pulse w-1/2" style={{ backgroundColor: `${PINK}18` }} />
              <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
            </>
          ) : questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm font-medium mb-2 leading-snug" style={{ color: PINK }}>{q}</p>
              <textarea value={answers[i] ?? ''}
                onChange={e => { autoResize(e.target); handleAnswer(i, e.target.value) }}
                placeholder="Write here…" rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none transition-colors"
                style={taStyle}
                onFocus={e => (e.target.style.borderColor = `${PINK}60`)}
                onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
            </div>
          ))}

          {!loadingPrompts && questions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">Anything else</p>
              <textarea value={body}
                onChange={e => { autoResize(e.target); handleBody(e.target.value) }}
                placeholder="Anything else on your mind…" rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none transition-colors"
                style={taStyle}
                onFocus={e => (e.target.style.borderColor = `${PINK}60`)}
                onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
            </div>
          )}
        </section>
      )}

      {/* Free write mode */}
      {mode === 'freewrite' && (
        <section>
          <textarea value={body}
            onChange={e => { autoResize(e.target); handleBody(e.target.value) }}
            placeholder="Write anything on your mind…" rows={12}
            className="w-full rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none transition-colors"
            style={taStyle}
            onFocus={e => (e.target.style.borderColor = `${PINK}60`)}
            onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
        </section>
      )}

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, ${PINK}20, ${PINK}08)`,
          border: `1px solid ${PINK}50`,
          color: PINK,
        }}>
        {saving ? 'Saving…' : 'Save diary'}
      </button>
    </div>
  )
}

// ── Past entry card ────────────────────────────────────────────────────────
function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: `${PINK}45`, color: '#fff', borderRadius: '2px', padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function EntryCard({ entry, searchQuery, expanded, setExpanded }: {
  entry: DiaryEntry
  searchQuery: string
  expanded: string | null
  setExpanded: (id: string | null) => void
}) {
  const isOpen = expanded === entry.id
  const d      = new Date(entry.id + 'T12:00:00')
  const label  = d.toLocaleDateString('en-HK', { weekday: 'short', day: 'numeric', month: 'short' })
  const firstAnswer = entry.prompts?.find(p => p.answer)?.answer ?? ''
  const preview = (firstAnswer || entry.body || '').slice(0, 70)

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <button onClick={() => setExpanded(isOpen ? null : entry.id)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="text-lg flex-shrink-0">{entry.mood || '📝'}</span>
        <span className="text-xs text-white/45 flex-shrink-0">{label}</span>
        {!isOpen && preview && (
          <span className="text-xs text-white/28 truncate flex-1 min-w-0">
            {highlight(preview, searchQuery)}
          </span>
        )}
        <span className="text-white/20 text-[10px] ml-auto flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {entry.prompts?.map((p, i) => p.answer ? (
            <div key={i}>
              <p className="text-[11px] font-medium mb-1 leading-snug" style={{ color: `${PINK}90` }}>
                {highlight(p.question, searchQuery)}
              </p>
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {highlight(p.answer, searchQuery)}
              </p>
            </div>
          ) : null)}
          {entry.body ? (
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Free write</p>
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {highlight(entry.body, searchQuery)}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
