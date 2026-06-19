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

function dbWrite(op: object) {
  fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op),
  }).catch(console.error)
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
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
  const [hasEntry, setHasEntry]       = useState(false)
  const [pastEntries, setPastEntries] = useState<DiaryEntry[]>([])
  const [expanded, setExpanded]       = useState<string | null>(null)

  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized    = useRef(false)
  const promptsFetched = useRef(false)

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const scheduleSave = useCallback((m: string, qs: string[], as: string[], b: string) => {
    if (!initialized.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      dbWrite({
        table: 'diary_entries',
        operation: 'upsert',
        data: {
          id: today,
          mood: m,
          prompts: qs.map((q, i) => ({ question: q, answer: as[i] ?? '' })),
          body: b,
          created_at: new Date().toISOString(),
        },
      })
      const t = new Date()
      setSavedAt(`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`)
    }, 600)
  }, [today])

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
    } catch { /* use fallback */ }
    setLoadingPrompts(false)
  }, [today])

  // ── Load today + past entries on mount ────────────────────────────────────
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

        if (Array.isArray(entry.prompts) && entry.prompts.length > 0) {
          setQuestions(entry.prompts.map(p => p.question))
          setAnswers(entry.prompts.map(p => p.answer))
          promptsFetched.current = true
          setMode('prompt')
        } else {
          setMode('freewrite')
        }
        // Jump straight to writing if there's already an entry
        setPhase('writing')
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

  // ── Choose mode from picker ───────────────────────────────────────────────
  function choosMode(m: Mode) {
    setMode(m)
    setPhase('writing')
    if (m === 'prompt' && !promptsFetched.current) {
      fetchPrompts()
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleMood(m: string) {
    const next = m === mood ? '' : m
    setMood(next)
    scheduleSave(next, questions, answers, body)
  }

  function handleAnswer(i: number, val: string) {
    const next = [...answers]; next[i] = val
    setAnswers(next)
    scheduleSave(mood, questions, next, body)
  }

  function handleBody(val: string) {
    setBody(val)
    scheduleSave(mood, questions, answers, val)
  }

  const taStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: HOME
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'home') {
    return (
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10 space-y-5" style={{ backgroundColor: '#0e1628' }}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-white">Diary</h2>
          <span className="text-xs" style={{ color: `${PINK}80` }}>{dateLabel}</span>
        </div>

        {/* Create diary button */}
        {!hasEntry && (
          <button
            onClick={() => setPhase('picking')}
            className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${PINK}18, ${PINK}08)`,
              border: `1px solid ${PINK}40`,
              color: PINK,
            }}
          >
            + Write today&apos;s diary
          </button>
        )}

        {/* Past entries */}
        {pastEntries.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Past entries</p>
            <div className="space-y-2">{pastEntries.map(entry => <EntryCard key={entry.id} entry={entry} expanded={expanded} setExpanded={setExpanded} />)}</div>
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
          {/* Free write option */}
          <button
            onClick={() => choosMode('freewrite')}
            className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="text-3xl mb-3">📝</div>
            <div className="text-base font-semibold text-white mb-1">Free write</div>
            <div className="text-sm text-white/40 leading-relaxed">
              Just a blank page. Write whatever is on your mind — no structure, no prompts.
            </div>
          </button>

          {/* Prompt option */}
          <button
            onClick={() => choosMode('prompt')}
            className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${PINK}12, ${PINK}06)`, border: `1px solid ${PINK}35` }}
          >
            <div className="text-3xl mb-3">✨</div>
            <div className="text-base font-semibold mb-1" style={{ color: PINK }}>Prompt</div>
            <div className="text-sm text-white/40 leading-relaxed">
              Gemini generates 2 personal questions to guide your reflection.
            </div>
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
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-white/20">Saved {savedAt}</span>}
          <span className="text-[10px] text-white/30 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: mode === 'prompt' ? `${PINK}15` : 'rgba(255,255,255,0.05)',
                     color: mode === 'prompt' ? PINK : 'rgba(255,255,255,0.3)' }}>
            {mode === 'prompt' ? '✨ Prompt' : '📝 Free write'}
          </span>
        </div>
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

      {/* Past entries */}
      {pastEntries.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Past entries</p>
          <div className="space-y-2">{pastEntries.map(entry => <EntryCard key={entry.id} entry={entry} expanded={expanded} setExpanded={setExpanded} />)}</div>
        </section>
      )}
    </div>
  )
}

// ── Past entry card ───────────────────────────────────────────────────────────
function EntryCard({ entry, expanded, setExpanded }: {
  entry: DiaryEntry
  expanded: string | null
  setExpanded: (id: string | null) => void
}) {
  const PINK = '#f0a8c8'
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
          <span className="text-xs text-white/28 truncate flex-1 min-w-0">{preview}</span>
        )}
        <span className="text-white/20 text-[10px] ml-auto flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {entry.prompts?.map((p, i) => p.answer ? (
            <div key={i}>
              <p className="text-[11px] font-medium mb-1 leading-snug" style={{ color: `${PINK}90` }}>{p.question}</p>
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{p.answer}</p>
            </div>
          ) : null)}
          {entry.body ? (
            <div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Free write</p>
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{entry.body}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
