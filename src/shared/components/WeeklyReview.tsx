'use client'

import { useState, useMemo } from 'react'
import { X, Check, ChevronRight, Star, Search, ArrowRight, Archive, Clock } from 'lucide-react'
import { allCycleDone } from '@/shared/lib/sort-utils'
import type { Cycle } from '@/shared/types'

// Local date string. Never toISOString() — in HKT that returns the previous day.
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

// Each reason says what it actually does, so nothing happens by surprise.
const DEFER_REASONS = [
  { label: 'Move to next week', effect: 'moves to the same weekday next week', act: 'reschedule' },
  { label: 'Still in progress', effect: 'keeps its date', act: 'none' },
  { label: 'Waiting on someone', effect: 'keeps its date', act: 'none' },
  { label: 'Not needed', effect: 'archives it', act: 'archive' },
] as const
type DeferReason = (typeof DEFER_REASONS)[number]['label']
const ACT_OF = Object.fromEntries(DEFER_REASONS.map(r => [r.label, r.act])) as Record<DeferReason, 'reschedule' | 'none' | 'archive'>
const REASON_ICON: Record<string, typeof ArrowRight> = {
  reschedule: ArrowRight, none: Clock, archive: Archive,
}

interface DeferDecision { id: string; reason: DeferReason }
export interface DeferAction { id: string; area: string; act: 'reschedule' | 'none' | 'archive'; toDate?: string }

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
}

const STEPS = ['Wins', 'Slipped', 'Rhythm', 'Focus'] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function WeeklyReview({ allCycles, onSave, onDismiss, onApply, todayStr }: WeeklyReviewProps) {
  const [step, setStep] = useState(1)
  const [notes, setNotes] = useState('')
  const [deferDecisions, setDeferDecisions] = useState<DeferDecision[]>([])
  const [focusIds, setFocusIds] = useState<string[]>([])
  const [focusQuery, setFocusQuery] = useState('')
  const [saving, setSaving] = useState(false)

  // Last Monday (7 days ago)
  const lastMondayStr = useMemo(() => {
    const d = new Date(todayStr + 'T00:00:00')
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

  // Step 1: completed last week
  const completedLastWeek = useMemo(() =>
    allCycles.filter(c =>
      c.lastCompletedAt &&
      c.lastCompletedAt >= lastMondayStr &&
      c.lastCompletedAt <= todayStr
    ),
    [allCycles, lastMondayStr, todayStr]
  )

  // Step 2: overdue one-off cycles
  const overdueCycles = useMemo(() =>
    allCycles.filter(c => {
      if (c.status === 'complete') return false
      if (c.nextDueAt) return false
      if (!c.triggerLabel) return false
      return ISO_DATE.test(c.triggerLabel) && c.triggerLabel < todayStr
    }),
    [allCycles, todayStr]
  )

  // Step 3: cycles with specific dates this week
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

  // Step 4: every open cycle — must/urgent first, then the rest.
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

  function setDeferReason(id: string, reason: DeferReason) {
    setDeferDecisions(prev => {
      const has = prev.find(d => d.id === id)
      if (has) return prev.map(d => d.id === id ? { ...d, reason } : d)
      return [...prev, { id, reason }]
    })
  }

  async function handleComplete() {
    setSaving(true)
    const byId = new Map(overdueCycles.map(c => [c.id, c]))
    const actions: DeferAction[] = deferDecisions.map(d => {
      const c = byId.get(d.id)
      const act = ACT_OF[d.reason]
      const toDate = act === 'reschedule' && c && ISO_DATE.test(c.triggerLabel ?? '')
        ? sameWeekdayNextWeek(c.triggerLabel!, todayStr) : undefined
      return { id: d.id, area: c?.area ?? '', act, toDate }
    })
    onApply(actions)

    await onSave({
      completedIds: completedLastWeek.map(c => c.id),
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
              <p className="text-sm font-semibold text-white/80">
                What actually moved last week?
              </p>
              <p className="text-xs text-white/40 -mt-2 leading-relaxed">
                {completedLastWeek.length > 0
                  ? `${completedLastWeek.length} thing${completedLastWeek.length !== 1 ? 's' : ''} marked done since last Monday.`
                  : `Nothing marked complete since last Monday — that's fine, let's look forward.`}
              </p>

              {completedLastWeek.length > 0 && (
                <div className="space-y-1.5">
                  {completedLastWeek.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-green-500/6 border border-green-500/15">
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{c.title}</span>
                      <span className={`text-[10px] font-medium flex-shrink-0 ${AREA_TEXT[c.area] ?? 'text-white/30'}`}>
                        {c.area}
                      </span>
                    </div>
                  ))}
                </div>
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

              {overdueCycles.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-2xl mb-2">✓</p>
                  <p className="text-sm text-white/50">Nothing overdue — clean slate.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-white/40 -mt-2 leading-relaxed">
                    {overdueCycles.length} item{overdueCycles.length !== 1 ? 's' : ''} past their date.
                    Tag each so Navi learns what's worth following up.
                  </p>
                  <div className="space-y-3">
                    {overdueCycles.map(c => {
                      const decision = deferDecisions.find(d => d.id === c.id)
                      return (
                        <div key={c.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${AREA_DOT[c.area] ?? 'bg-white/30'}`} />
                            <span className="text-[13px] text-white/75 flex-1 min-w-0 font-medium">{c.title}</span>
                            <span className="text-[10px] text-white/25 flex-shrink-0">{c.triggerLabel}</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {DEFER_REASONS.map(r => {
                              const Icon = REASON_ICON[r.act]
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
                              On save: {DEFER_REASONS.find(r => r.label === decision.reason)?.effect}
                              {ACT_OF[decision.reason] === 'reschedule' && ISO_DATE.test(c.triggerLabel ?? '') && (
                                <span className="text-navi-blue"> — {sameWeekdayNextWeek(c.triggerLabel!, todayStr)}</span>
                              )}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                What's the shape of this week?
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
                  No deadlines with specific dates this week — you're running on recurring rhythms.
                </p>
              )}

              <div className="rounded-xl border border-white/6 bg-white/2 p-3.5">
                <p className="text-xs text-white/40 leading-relaxed">
                  Your recurring patterns — Finance close, payroll, weekly admin — stay visible in their tabs.
                  This week: notice whether you're in flow or fighting the same friction.
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
