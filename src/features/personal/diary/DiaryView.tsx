'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const PINK = '#f0a8c8'
const MOODS = ['😄', '🙂', '😐', '😔', '😢']

interface DiaryEntry {
  id: string
  mood: string
  prompts: { question: string; answer: string }[]
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
  const today = todayKey()
  const dateLabel = new Date().toLocaleDateString('en-HK', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const [mood, setMood]               = useState('')
  const [questions, setQuestions]     = useState<string[]>([])
  const [answers, setAnswers]         = useState<string[]>([])
  const [body, setBody]               = useState('')
  const [loadingPrompts, setLoadingPrompts] = useState(true)
  const [savedAt, setSavedAt]         = useState<string | null>(null)
  const [pastEntries, setPastEntries] = useState<DiaryEntry[]>([])
  const [expanded, setExpanded]       = useState<string | null>(null)

  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized  = useRef(false)

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

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      // 1. Load today's saved entry
      const rows = await dbRead('diary_entries', { col: 'id', val: today })
      if (cancelled) return

      let hasExistingQuestions = false
      if (rows.length > 0) {
        const entry = rows[0] as DiaryEntry
        setMood(entry.mood ?? '')
        setBody(entry.body ?? '')
        if (Array.isArray(entry.prompts) && entry.prompts.length > 0) {
          setQuestions(entry.prompts.map(p => p.question))
          setAnswers(entry.prompts.map(p => p.answer))
          hasExistingQuestions = true
        }
      }

      // 2. Fetch Gemini prompts (skip if we already have saved ones)
      setLoadingPrompts(true)
      if (!hasExistingQuestions) {
        try {
          const res = await fetch(`/api/diary/prompts?date=${today}`)
          const json = await res.json()
          if (!cancelled && Array.isArray(json.prompts) && json.prompts.length > 0) {
            setQuestions(json.prompts)
            setAnswers(json.prompts.map(() => ''))
          }
        } catch { /* use default */ }
      }
      if (!cancelled) setLoadingPrompts(false)

      // 3. Load past entries
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleMood(m: string) {
    const next = m === mood ? '' : m
    setMood(next)
    scheduleSave(next, questions, answers, body)
  }

  function handleAnswer(i: number, val: string) {
    const next = [...answers]
    next[i] = val
    setAnswers(next)
    scheduleSave(mood, questions, next, body)
  }

  function handleBody(val: string) {
    setBody(val)
    scheduleSave(mood, questions, answers, val)
  }

  // ── Shared textarea style ──────────────────────────────────────────────────
  const taBase: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-5 pt-5 pb-10 space-y-6"
      style={{ backgroundColor: '#0e1628' }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-white">Diary</h2>
        <span className="text-xs" style={{ color: `${PINK}80` }}>{dateLabel}</span>
      </div>

      {/* ── Mood ──────────────────────────────────────────────────────────── */}
      <section>
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">
          How are you feeling?
        </p>
        <div className="flex gap-2.5">
          {MOODS.map(m => (
            <button
              key={m}
              onClick={() => handleMood(m)}
              className="text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={
                mood === m
                  ? { outline: `2px solid ${PINK}`, outlineOffset: '3px', opacity: 1, transform: 'scale(1.1)' }
                  : { opacity: 0.4 }
              }
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {/* ── Prompts ───────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {loadingPrompts ? (
          <>
            <div className="h-4 rounded-md animate-pulse w-3/4" style={{ backgroundColor: 'rgba(240,168,200,0.12)' }} />
            <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
            <div className="h-4 rounded-md animate-pulse w-1/2 mt-2" style={{ backgroundColor: 'rgba(240,168,200,0.12)' }} />
            <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
          </>
        ) : questions.map((q, i) => (
          <div key={i}>
            <p className="text-sm font-medium mb-2 leading-snug" style={{ color: PINK }}>{q}</p>
            <textarea
              value={answers[i] ?? ''}
              onChange={e => { autoResize(e.target); handleAnswer(i, e.target.value) }}
              placeholder="Write here…"
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none transition-colors"
              style={taBase}
              onFocus={e => (e.target.style.borderColor = `${PINK}60`)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>
        ))}
      </section>

      {/* ── Free write ────────────────────────────────────────────────────── */}
      <section>
        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">
          Free write
        </p>
        <textarea
          value={body}
          onChange={e => { autoResize(e.target); handleBody(e.target.value) }}
          placeholder="Anything else on your mind…"
          rows={4}
          className="w-full rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none transition-colors"
          style={taBase}
          onFocus={e => (e.target.style.borderColor = `${PINK}60`)}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
        {savedAt && (
          <p className="text-[10px] text-white/18 text-right mt-1.5">
            Saved {savedAt}
          </p>
        )}
      </section>

      {/* ── Past entries ──────────────────────────────────────────────────── */}
      {pastEntries.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">
            Past entries
          </p>
          <div className="space-y-2">
            {pastEntries.map(entry => {
              const isOpen = expanded === entry.id
              const d = new Date(entry.id + 'T12:00:00')
              const label = d.toLocaleDateString('en-HK', { weekday: 'short', day: 'numeric', month: 'short' })
              const firstAnswer = entry.prompts?.find(p => p.answer)?.answer ?? ''
              const preview = firstAnswer || entry.body || ''

              return (
                <div
                  key={entry.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {/* Collapsed header — always visible */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-lg flex-shrink-0">{entry.mood || '📝'}</span>
                    <span className="text-xs text-white/45 flex-shrink-0">{label}</span>
                    {!isOpen && preview && (
                      <span className="text-xs text-white/28 truncate flex-1 min-w-0">
                        {preview.slice(0, 70)}
                      </span>
                    )}
                    <span className="text-white/20 text-[10px] ml-auto flex-shrink-0">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Expanded body */}
                  {isOpen && (
                    <div
                      className="px-4 pb-4 pt-2 space-y-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {entry.prompts?.map((p, i) =>
                        p.answer ? (
                          <div key={i}>
                            <p className="text-[11px] font-medium mb-1 leading-snug" style={{ color: `${PINK}90` }}>
                              {p.question}
                            </p>
                            <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                              {p.answer}
                            </p>
                          </div>
                        ) : null
                      )}
                      {entry.body ? (
                        <div>
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">
                            Free write
                          </p>
                          <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                            {entry.body}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
