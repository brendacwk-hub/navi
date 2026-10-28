'use client'

import { useState, useMemo } from 'react'
import { X, Check, ChevronRight, Star, Search, ArrowRight, Archive, Clock, RotateCcw, Repeat, Circle, CircleDot } from 'lucide-react'
import { allCycleDone, isRecurring, isTriggerDueToday, daysSinceLastOccurrence, computeSkipDate } from '@/shared/lib/sort-utils'
import { useReviewData } from '@/shared/lib/use-review-data'
import type { Cycle } from '@/shared/types'

// Local date string. Never toISOString() — in HKT that returns the previous day.
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Monday of the week that contains `dateStr`.
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toISO(d)
}

// Same weekday, in the week that starts next Monday.
function sameWeekdayNextWeek(dueISO: string, todayStr: string): string {
  const due = new Date(dueISO + 'T00:00:00')
  const today = new Date(todayStr + 'T00:00:00')
  const nextMon = new Date(today)
  nextMon.setDate(today.getDate() + (8 - (today.getDay() || 7)))
  nextMon.setDate(nextMon.getDate() + ((due.getDay() + 6) % 7))
  return toISO(nextMon)
}

const AREA_DOT: Record<string, string> = {
  finance: 'bg-finance', hr: 'bg-hr', ops: 'bg-ops', others: 'bg-others',
}
const AREA_TEXT: Record<string, string> = {
  finance: 'text-finance', hr: 'text-hr', ops: 'text-ops', others: 'text-others',
}

// A recurring cycle that's sitting unfinished is only flagged once it's this
// many days past the occurrence that fired.
const STUCK_AFTER_DAYS = 3

// Each reason says what it actually does, so nothing happens by surprise.
const DEFER_REASONS = [
  { label: 'Move to next week', effect: 'moves to the same weekday next week', act: 'reschedule' },
  { label: 'Still in progress', effect: 'keeps its date', act: 'none' },
  { label: 'Waiting on someone', effect: 'keeps its date', act: 'none' },
  { label: 'Not needed', effect: 'archives it', act: 'archive' },
] as const

// Repeating work can't be "moved to next week" — it already comes back.
// Skipping this round is the honest option.
const REPEAT_REASONS = [
  { label: 'Skip this round', effect: 'skips it — comes back next time', act: 'skip' },
  { label: 'Still in progress', effect: 'stays where it is', act: 'none' },
  { label: 'Waiting on someone', effect: 'stays where it is', act: 'none' },
] as const

type DeferAct = 'reschedule' | 'none' | 'archive' | 'skip'
const ACT_OF = Object.fromEntries(
  [...DEFER_REASONS, ...REPEAT_REASONS].map(r => [r.label, r.act])
) as Record<string, DeferAct>
const EFFECT_OF = Object.fromEntries(
  [...DEFER_REASONS, ...REPEAT_REASONS].map(r => [r.label, r.effect])
) as Record<string, string>
const REASON_ICON: Record<DeferAct, typeof ArrowRight> = {
  reschedule: ArrowRight, none: Clock, archive: Archive, skip: RotateCcw,
}

interface DeferDecision { id: string; reason: string }
export interface DeferAction { id: string; area: string; act: DeferAct; toDate?: string }

interface WeeklyReviewProps {
  allCycles: Cycle[]
  onSave: (data: {
    completedIds: string[]
    deferred: { id: string; toDate: string; reason: string }[]
    focusIds: string[]
    notes?: string
  }) => Promise<void>
  onDismiss: () => void
  onApply: (actions: DeferAction[]) => void
  todayStr: string
  mode?: 'work' | 'personal'
}

const STEPS = ['Wins', 'Slipped', 'Rhythm', 'Focus'] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function WeeklyReview({ allCycles, onSave, onDismiss, onApply, todayStr, mode = 'work' }: WeeklyReviewProps) {
  const [step, setStep] = useState(1)
  const [notes, setNotes] = useState('')
  const [deferDecisions, setDeferDecisions] = useState<DeferDecision[]>([])
  const [focusIds, setFocusIds] = useState<string[]>([])
  const [focusQuery, setFocusQuery] = useState('')
  const [saving, setSaving] = useState(false)

  // Monday of last week — the start of the window this review looks back over.
  const lastMondayStr = useMemo(() => {
    const d = new Date(mondayOf(todayStr) + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    return toISO(d)
  }, [todayStr])

  // Friday of this week
  const weekEndStr = useMemo(() => {
    const d = new Date(todayStr + 'T00:00:00')
    const daysLeft = (5 - d.getDay() + 7) % 7
    d.setDate(d.getDate() + daysLeft)
    return toISO(d)
  }, [todayStr])

  // Real completion history + last Monday's review. Only fetched while this
  // modal is open.
  const { log, lastWeekReview, loaded: logLoaded } = useReviewData(mode, lastMondayStr, lastMondayStr)

  // ── Step 1: what actually got finished, from the completion log ──────────
  const wins = useMemo(() => {
    const inWindow = log.filter(e => e.date >= lastMondayStr && e.date <= todayStr)
    const seen = new Set<string>()
    const whole = inWindow.filter(e => {
      if (e.kind === 'step') return false
      const k = `${e.id}|${e.date}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    const steps = inWindow.filter(e => e.kind === 'step')
    const byArea = new Map<string, number>()
    for (const e of whole) byArea.set(e.area, (byArea.get(e.area) ?? 0) + 1)
    return {
      whole,
      stepCount: steps.length,
      byArea: [...byArea.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [log, lastMondayStr, todayStr])

  // ── Step 1: how last week's three picks actually went ────────────────────
  const lastFocusResults = useMemo(() => {
    const ids = lastWeekReview?.focusIds ?? []
    if (ids.length === 0) return []
    return ids.map(id => {
      const cycle = allCycles.find(c => c.id === id)
      const hits = log.filter(e => e.id === id || e.parentId === id)
      const wholeDone = hits.some(e => e.kind !== 'step')
      const stepsDone = hits.filter(e => e.kind === 'step').length
      const done = wholeDone
        || cycle?.status === 'complete'
        || (!!cycle?.lastCompletedAt && cycle.lastCompletedAt >= lastMondayStr)
      return {
        id,
        title: cycle?.title ?? hits[0]?.title ?? 'Removed task',
        area: cycle?.area ?? hits[0]?.area ?? '',
        done,
        stepsDone,
      }
    })
  }, [lastWeekReview, allCycles, log, lastMondayStr])

  // ── Step 2a: overdue one-off cycles ──────────────────────────────────────
  const overdueCycles = useMemo(() =>
    allCycles.filter(c => {
      if (c.status === 'complete') return false
      if (c.nextDueAt) return false
      if (!c.triggerLabel) return false
      return ISO_DATE.test(c.triggerLabel) && c.triggerLabel < todayStr
    }),
    [allCycles, todayStr]
  )

  // ── Step 2b: repeating work that fired and is still sitting there ────────
  const stuckRecurring = useMemo(() => {
    const today = new Date(todayStr + 'T00:00:00')
    return allCycles.filter(c => {
      if (c.status === 'complete') return false
      if (c.nextDueAt) return false              // already skipped / done for this period
      if (!isRecurring(c.triggerLabel)) return false
      if (allCycleDone(c)) return false
      if (isTriggerDueToday(c.triggerLabel, today)) return false  // due today, not late
      const daysAgo = daysSinceLastOccurrence(c.triggerLabel, today)
      if (daysAgo === null || daysAgo < STUCK_AFTER_DAYS) return false
      // Finished since that occurrence fired? Then it isn't stuck.
      const occDate = toISO(new Date(today.getTime() - daysAgo * 86400000))
      if (c.lastCompletedAt && c.lastCompletedAt >= occDate) return false
      if (log.some(e => (e.id === c.id || e.parentId === c.id) && e.kind !== 'step' && e.date >= occDate)) return false
      return true
    }).map(c => ({
      cycle: c,
      daysAgo: daysSinceLastOccurrence(c.triggerLabel, today) ?? 0,
    }))
  }, [allCycles, todayStr, log])

  const slippedCount = overdueCycles.length + stuckRecurring.length

  // ── Step 3: cycles with specific dates this week ─────────────────────────
  const dueThisWeek = useMemo(() =>
    allCycles
      .filter(c => {
        if (c.status === 'complete') return false
        if (!c.triggerLabel || !ISO_DATE.test(c.triggerLabel)) return false
        return c.triggerLabel >= todayStr && c.triggerLabel <= weekEndStr
      })
      .sort((a, b) => {
        const score = (c: Cycle) => (c.must ? 2 : 0) + (c.urgent ? 1 : 0)
        return score(b) - score(a)
      }),
    [allCycles, todayStr, weekEndStr]
  )

  // ── Step 4: every open cycle — must/urgent first, then the rest ──────────
  // nextDueAt means a recurring cycle is already done for this period (B-69).
  const focusOptions = useMemo(() =>
    allCycles
      .filter(c => c.status !== 'complete' && !c.nextDueAt && !allCycleDone(c))
      .sort((a, b) => {
        const score = (c: Cycle) => (c.must ? 2 : 0) + (c.urgent ? 1 : 0)
        const d = score(b) - score(a)
        if (d) return d
        const due = (c: Cycle) => (ISO_DATE.test(c.triggerLabel ?? '') ? c.triggerLabel! : '9999')
        return due(a).localeCompare(due(b)) || a.title.localeCompare(b.title)
      }),
    [allCycles]
  )
  const visibleFocus = useMemo(() => {
    const q = focusQuery.trim().toLowerCase()
    if (!q) return focusOptions
    return focusOptions.filter(c =>
      c.title.toLowerCase().includes(q) || (c.subArea ?? '').toLowerCase().includes(q) || c.area.includes(q))
  }, [focusOptions, focusQuery])

  function toggleFocus(id: string) {
    setFocusIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev
    )
  }

  function setDeferReason(id: string, reason: string) {
    setDeferDecisions(prev => {
      const has = prev.find(d => d.id === id)
      if (has) return prev.map(d => d.id === id ? { ...d, reason } : d)
      return [...prev, { id, reason }]
    })
  }

  async function handleComplete() {
    setSaving(true)
    const byId = new Map<string, Cycle>([
      ...overdueCycles.map(c => [c.id, c] as [string, Cycle]),
      ...stuckRecurring.map(s => [s.cycle.id, s.cycle] as [string, Cycle]),
    ])
    const actions: DeferAction[] = deferDecisions.map(d => {
      const c = byId.get(d.id)
      const act = ACT_OF[d.reason] ?? 'none'
      let toDate: string | undefined
      if (act === 'reschedule' && c && ISO_DATE.test(c.triggerLabel ?? '')) {
        toDate = sameWeekdayNextWeek(c.triggerLabel!, todayStr)
      } else if (act === 'skip' && c) {
        toDate = computeSkipDate(c.triggerLabel) ?? undefined
      }
      return { id: d.id, area: c?.area ?? '', act, toDate }
    })
    onApply(actions)

    await onSave({
      completedIds: [...new Set(wins.whole.map(w => w.id))],
      deferred: actions.map(a => ({
        id: a.id,
        toDate: a.toDate ?? '',
        reason: deferDecisions.find(d => d.id === a.id)!.reason,
      })),
      focusIds,
      notes: notes.trim() || undefined,
    })
    setSaving(false)
  }

  // Shared renderer for a slipped item + its reason chips.
  function renderSlipped(c: Cycle, reasons: readonly { label: string; effect: string; act: string }[], meta: string) {
    const decision = deferDecisions.find(d => d.id === c.id)
    return (
      <div key={c.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AREA_DOT[c.area] ?? 'bg-white/30'}`} />
          <span className="text-[13px] text-white/75 flex-1 min-w-0 font-medium">{c.title}</span>
          <span className="text-[10px] text-white/25 flex-shrink-0">{meta}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {reasons.map(r => {
            const Icon = REASON_ICON[r.act as DeferAct]
            const on = decision?.reason === r.label
            return (
              <button
                key={r.label}
                onClick={() => setDeferReason(c.id, r.label)}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all ${
                  on
                    ? 'bg-navi-blue/20 border-navi-blue/40 text-navi-blue'
                    : 'border-white/10 text-white/35 hover:border-white/20 hover:text-white/55'
                }`}
              >
                <Icon className="w-2.5 h-2.5" />{r.label}
              </button>
            )
          })}
        </div>
        {decision && (
          <p className="text-[10px] text-white/30 mt-2">
            On save: {EFFECT_OF[decision.reason]}
            {ACT_OF[decision.reason] === 'reschedule' && ISO_DATE.test(c.triggerLabel ?? '') && (
              <span className="text-navi-blue"> — {sameWeekdayNextWeek(c.triggerLabel!, todayStr)}</span>
            )}
            {ACT_OF[decision.reason] === 'skip' && computeSkipDate(c.triggerLabel) && (
              <span className="text-navi-blue"> — back on {computeSkipDate(c.triggerLabel)}</span>
            )}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70">
      <div className="w-full sm:max-w-md bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/6">
          <div>
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-medium">Monday Check-in</p>
            <h2 className="text-base font-bold text-white">Weekly Review</h2>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-white/35 hover:text-white/60 hover:bg-white/6 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1.5 px-6 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-all ${
                i < step ? 'bg-navi-blue' : i === step - 1 ? 'bg-navi-blue/50' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-white/30 px-6 pt-1.5">
          Step {step} of {STEPS.length} — {STEPS[step - 1]}
        </p>

        {/* Content */}
        <div className="px-6 pt-4 pb-6 max-h-[65vh] overflow-y-auto space-y-4">

          {/* ── Step 1: Wins ── */}
          {step === 1 && (
            <>
              {/* How last week's three picks went */}
              {lastFocusResults.length > 0 && (
                <div className="rounded-xl border border-white/8 bg-white/3 p-3.5 space-y-2">
                  <p className="text-[11px] text-white/45 font-medium">
                    Last Monday you picked {lastFocusResults.length} to protect
                    {' · '}
                    <span className="text-white/65">{lastFocusResults.filter(f => f.done).length} done</span>
                  </p>
                  {lastFocusResults.map(f => (
                    <div key={f.id} className="flex items-center gap-2">
                      {f.done
                        ? <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        : f.stepsDone > 0
                          ? <CircleDot className="w-3.5 h-3.5 text-yellow-400/70 flex-shrink-0" />
                          : <Circle className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />}
                      <span className={`text-[13px] flex-1 min-w-0 truncate ${f.done ? 'text-white/70' : 'text-white/45'}`}>
                        {f.title}
                      </span>
                      {!f.done && f.stepsDone > 0 && (
                        <span className="text-[10px] text-yellow-400/60 flex-shrink-0">{f.stepsDone} steps in</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm font-semibold text-white/80">
                What actually moved last week?
              </p>

              {!logLoaded ? (
                <p className="text-xs text-white/30 -mt-2">Reading your completion history…</p>
              ) : (
                <>
                  <p className="text-xs text-white/40 -mt-2 leading-relaxed">
                    {wins.whole.length > 0
                      ? `You finished ${wins.whole.length} thing${wins.whole.length !== 1 ? 's' : ''} since last Monday${wins.stepCount > 0 ? ` — ${wins.stepCount} step${wins.stepCount !== 1 ? 's' : ''} ticked along the way` : ''}.`
                      : wins.stepCount > 0
                        ? `Nothing finished outright, but you ticked ${wins.stepCount} step${wins.stepCount !== 1 ? 's' : ''} — progress counts.`
                        : `Nothing logged since last Monday — that's fine, let's look forward.`}
                  </p>

                  {wins.byArea.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap -mt-1">
                      {wins.byArea.map(([area, n]) => (
                        <span
                          key={area}
                          className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-white/4 border border-white/8"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${AREA_DOT[area] ?? 'bg-white/30'}`} />
                          <span className={AREA_TEXT[area] ?? 'text-white/40'}>{area}</span>
                          <span className="text-white/50 tabular-nums">{n}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {wins.whole.length > 0 && (
                    <div className="space-y-1.5">
                      {wins.whole.map(w => (
                        <div key={`${w.id}|${w.date}`} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-green-500/6 border border-green-500/15">
                          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{w.title}</span>
                          <span className={`text-[10px] font-medium flex-shrink-0 ${AREA_TEXT[w.area] ?? 'text-white/30'}`}>
                            {w.area}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-[11px] text-white/40 block mb-1.5">
                  Anything else worth noting — a win, a blocker, a feeling?
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional — this gets saved to your review history..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/75 placeholder:text-white/20 resize-none focus:outline-none focus:border-navi-blue/40 transition-colors"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-navi-blue/15 border border-navi-blue/30 text-navi-blue text-sm font-semibold hover:bg-navi-blue/20 transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ── Step 2: Slipped ── */}
          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-white/80">
                Did anything slip?
              </p>

              {slippedCount === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-2xl mb-2">✓</p>
                  <p className="text-sm text-white/50">Nothing overdue — clean slate.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-white/40 -mt-2 leading-relaxed">
                    {slippedCount} item{slippedCount !== 1 ? 's' : ''} behind.
                    Tag each so Navi learns what&rsquo;s worth following up.
                  </p>

                  {overdueCycles.length > 0 && (
                    <div className="space-y-3">
                      {overdueCycles.map(c => renderSlipped(c, DEFER_REASONS, c.triggerLabel ?? ''))}
                    </div>
                  )}

                  {stuckRecurring.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 pt-1">
                        <Repeat className="w-3 h-3 text-white/30" />
                        <p className="text-[11px] text-white/40">
                          Repeating work that came round and is still open
                        </p>
                      </div>
                      <div className="space-y-3">
                        {stuckRecurring.map(({ cycle, daysAgo }) =>
                          renderSlipped(cycle, REPEAT_REASONS, `${daysAgo}d ago`))}
                      </div>
                    </>
                  )}
                </>
              )}

              <button
                onClick={() => setStep(3)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-navi-blue/15 border border-navi-blue/30 text-navi-blue text-sm font-semibold hover:bg-navi-blue/20 transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ── Step 3: Rhythm ── */}
          {step === 3 && (
            <>
              <p className="text-sm font-semibold text-white/80">
                What&rsquo;s the shape of this week?
              </p>

              {dueThisWeek.length > 0 ? (
                <div className="space-y-1.5">
                  {dueThisWeek.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-white/4 border border-white/8">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AREA_DOT[c.area] ?? 'bg-white/25'}`} />
                      <span className="text-sm text-white/65 flex-1 min-w-0 truncate">{c.title}</span>
                      {c.must && <span className="text-[10px] text-red-400 flex-shrink-0">Must</span>}
                      <span className="text-[10px] text-white/30 flex-shrink-0">{c.triggerLabel}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40 leading-relaxed">
                  No deadlines with specific dates this week — you&rsquo;re running on recurring rhythms.
                </p>
              )}

              <div className="rounded-xl border border-white/6 bg-white/2 p-3.5">
                <p className="text-xs text-white/40 leading-relaxed">
                  Your recurring patterns — Finance close, payroll, weekly admin — stay visible in their tabs.
                  This week: notice whether you&rsquo;re in flow or fighting the same friction.
                </p>
              </div>

              <button
                onClick={() => setStep(4)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-navi-blue/15 border border-navi-blue/30 text-navi-blue text-sm font-semibold hover:bg-navi-blue/20 transition-all"
              >
                Last step <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ── Step 4: Focus ── */}
          {step === 4 && (
            <>
              <p className="text-sm font-semibold text-white/80">
                Pick up to 3 things to protect this week.
              </p>
              <p className="text-xs text-white/40 -mt-2 leading-relaxed">
                Every open task is listed — Must and Urgent first. These stay pinned
                at the top of Today all week.
              </p>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-white/25 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="focus-search"
                  value={focusQuery}
                  onChange={e => setFocusQuery(e.target.value)}
                  placeholder={`Search ${focusOptions.length} open tasks...`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white/75 placeholder:text-white/20 focus:outline-none focus:border-navi-blue/40 transition-colors"
                />
              </div>

              {focusOptions.length === 0 ? (
                <p className="text-xs text-white/30 py-4 text-center">
                  Nothing open right now.
                </p>
              ) : visibleFocus.length === 0 ? (
                <p className="text-xs text-white/30 py-4 text-center">
                  No task matches &ldquo;{focusQuery}&rdquo;.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[38vh] overflow-y-auto -mx-1 px-1">
                  {visibleFocus.map(c => {
                    const selected = focusIds.includes(c.id)
                    const blocked = !selected && focusIds.length >= 3
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleFocus(c.id)}
                        disabled={blocked}
                        className={`w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl border text-left transition-all ${
                          selected
                            ? 'bg-navi-blue/15 border-navi-blue/40'
                            : blocked
                            ? 'border-white/5 opacity-30 cursor-not-allowed'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/4'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${
                          selected ? 'bg-navi-blue/30 border-navi-blue/50' : 'border-white/15'
                        }`}>
                          {selected && <Check className="w-2.5 h-2.5 text-navi-blue" />}
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AREA_DOT[c.area] ?? 'bg-white/25'}`} />
                        <span className={`text-sm flex-1 min-w-0 truncate ${selected ? 'text-white/85' : 'text-white/60'}`}>
                          {c.title}
                        </span>
                        {c.subArea && <span className="text-[10px] text-white/25 flex-shrink-0 hidden sm:inline">{c.subArea}</span>}
                        {c.must && <span className="text-[10px] text-red-400 flex-shrink-0">Must</span>}
                        {c.urgent && !c.must && <span className="text-[10px] text-orange-400 flex-shrink-0">⚠</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Slot indicators */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all ${i < focusIds.length ? 'bg-navi-blue' : 'bg-white/10'}`}
                  />
                ))}
                <span className="text-[11px] text-white/35 ml-1 tabular-nums">{focusIds.length}/3</span>
              </div>
              {focusIds.length >= 3 && (
                <p className="text-[10px] text-white/30 -mt-2">
                  Three picked — deselect one to swap it out.
                </p>
              )}

              <button
                onClick={handleComplete}
                disabled={focusIds.length < 1 || saving}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  focusIds.length >= 1
                    ? 'bg-navi-blue/20 border border-navi-blue/40 text-navi-blue hover:bg-navi-blue/30'
                    : 'bg-white/4 border border-white/8 text-white/25 cursor-not-allowed'
                }`}
              >
                <Star className="w-4 h-4" />
                {saving ? 'Saving...' : 'Commit to this week'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
