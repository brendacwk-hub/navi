'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Minus } from 'lucide-react'
import { useHabits, getWeekDateKeys, getMonthDateKeys, type WorkHabit, type HabitFrequency, type HabitLog } from '@/shared/lib/habit-context'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function freqLabel(f?: HabitFrequency): string {
  if (!f || f.type === 'daily')            return 'Every day'
  if (f.type === 'weekdays')               return 'Mon–Fri'
  if (f.type === 'times_per_week')         return `${f.times}× / week`
  if (f.type === 'times_per_month')        return `${f.times}× / month`
  if (f.type === 'days') {
    if (f.days.length === 0) return 'No days'
    return f.days.map(d => DAY_LABELS[d]).join(' ')
  }
  return ''
}

function isDayScheduled(habit: WorkHabit, dayOfWeek: number): boolean {
  const f = habit.frequency
  if (!f || f.type === 'daily')            return true
  if (f.type === 'weekdays')               return dayOfWeek >= 1 && dayOfWeek <= 5
  if (f.type === 'days')                   return f.days.includes(dayOfWeek)
  if (f.type === 'times_per_week')         return true
  return true
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

const EMOJI_PRESETS = ['💧','🧍','🏃','💊','🪞','🪡','💻','🧠','📈','🍎','☕','🎯','📚','🌿','💤','🐢','🚿','🫧']

type FreqType = 'daily' | 'weekdays' | 'days' | 'times_per_week' | 'times_per_month'

interface HabitModalProps {
  initial?: WorkHabit
  onSave: (data: Omit<WorkHabit, 'id' | 'order'>) => void
  onDelete?: () => void
  onClose: () => void
}

function HabitModal({ initial, onSave, onDelete, onClose }: HabitModalProps) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [emoji, setEmoji]       = useState(initial?.emoji ?? '🎯')
  const [goal, setGoal]         = useState(initial?.goal ?? 1)
  const [reminder, setReminder] = useState(initial?.reminderTime ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  const initFreqType = (): FreqType => {
    const t = initial?.frequency?.type
    if (!t || t === 'daily')          return 'daily'
    if (t === 'weekdays')             return 'weekdays'
    if (t === 'days')                 return 'days'
    if (t === 'times_per_month')      return 'times_per_month'
    return 'times_per_week'
  }
  const [freqType, setFreqType]   = useState<FreqType>(initFreqType)
  const [freqDays, setFreqDays]   = useState<number[]>(
    initial?.frequency?.type === 'days' ? initial.frequency.days : [1, 2, 3, 4, 5]
  )
  const [freqTimes, setFreqTimes] = useState(
    initial?.frequency?.type === 'times_per_week'  ? initial.frequency.times :
    initial?.frequency?.type === 'times_per_month' ? initial.frequency.times : 3
  )

  const toggleDay = (d: number) =>
    setFreqDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))

  function buildFrequency(): HabitFrequency {
    if (freqType === 'daily')           return { type: 'daily' }
    if (freqType === 'weekdays')        return { type: 'weekdays' }
    if (freqType === 'days')            return { type: 'days', days: freqDays }
    if (freqType === 'times_per_month') return { type: 'times_per_month', times: freqTimes }
    return { type: 'times_per_week', times: freqTimes }
  }

  const valid = name.trim().length > 0 && goal >= 1 && (freqType !== 'days' || freqDays.length > 0)

  const FREQ_OPTIONS: { key: FreqType; label: string }[] = [
    { key: 'daily',           label: 'Every day' },
    { key: 'weekdays',        label: 'Weekdays'  },
    { key: 'days',            label: 'Custom'    },
    { key: 'times_per_week',  label: '×/week'    },
    { key: 'times_per_month', label: '×/month'   },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-[#1e1e1e] border border-white/12 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{initial ? 'Edit Habit' : 'New Habit'}</h3>
          {initial && onDelete && !confirmDel && (
            <button onClick={() => setConfirmDel(true)}
              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {confirmDel && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40">Delete?</span>
              <button onClick={() => { onDelete?.(); onClose() }}
                className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">Yes</button>
              <button onClick={() => setConfirmDel(false)} className="text-white/40 hover:text-white/70">No</button>
            </div>
          )}
        </div>

        {/* Emoji picker */}
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-2 block">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PRESETS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border ${
                  emoji === e ? 'border-navi-blue/50 bg-navi-blue/15' : 'border-white/8 hover:border-white/20'
                }`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Water, Stretch..."
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-navi-blue/40"
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-2 block">Frequency</label>
          <div className="flex gap-1.5 flex-wrap">
            {FREQ_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFreqType(opt.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  freqType === opt.key
                    ? 'bg-navi-blue/20 border-navi-blue/50 text-navi-blue'
                    : 'border-white/12 text-white/40 hover:border-white/25 hover:text-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom day picker */}
          {freqType === 'days' && (
            <div className="flex gap-1.5 mt-3">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`flex-1 h-8 rounded-lg text-[11px] font-bold border transition-all ${
                    freqDays.includes(i)
                      ? 'bg-navi-blue/20 border-navi-blue/50 text-navi-blue'
                      : 'border-white/12 text-white/30 hover:border-white/25 hover:text-white/55'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Times per week / per month stepper */}
          {(freqType === 'times_per_week' || freqType === 'times_per_month') && (
            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => setFreqTimes(t => Math.max(1, t - 1))}
                className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:border-white/30 hover:text-white flex items-center justify-center transition-all">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-white font-semibold w-6 text-center tabular-nums">{freqTimes}</span>
              <button onClick={() => setFreqTimes(t => Math.min(freqType === 'times_per_month' ? 31 : 7, t + 1))}
                className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:border-white/30 hover:text-white flex items-center justify-center transition-all">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-white/35">
                times per {freqType === 'times_per_month' ? 'month' : 'week'}
              </span>
            </div>
          )}
        </div>

        {/* Goal */}
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">Daily goal</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setGoal(g => Math.max(1, g - 1))}
              className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:border-white/30 hover:text-white flex items-center justify-center transition-all">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-white font-semibold w-6 text-center tabular-nums">{goal}</span>
            <button onClick={() => setGoal(g => g + 1)}
              className="w-8 h-8 rounded-full border border-white/15 text-white/50 hover:border-white/30 hover:text-white flex items-center justify-center transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-white/35">times per day</span>
          </div>
        </div>

        {/* Reminder */}
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">
            Reminder <span className="normal-case text-white/25">(optional)</span>
          </label>
          <input
            type="time"
            value={reminder}
            onChange={e => setReminder(e.target.value)}
            className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-navi-blue/40"
          />
          {reminder && (
            <button onClick={() => setReminder('')} className="ml-2 text-xs text-white/30 hover:text-white/55">Clear</button>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm text-white/40 hover:text-white/65 transition-colors">
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => {
              onSave({ name: name.trim(), emoji, goal, frequency: buildFrequency(), reminderTime: reminder || undefined })
              onClose()
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              valid ? 'bg-navi-blue text-white hover:bg-blue-600' : 'bg-white/8 text-white/25 cursor-not-allowed'
            }`}
          >
            {initial ? 'Save' : 'Add Habit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Streak calculator ─────────────────────────────────────────────────────────

function computeStreak(habit: WorkHabit, weekLogs: Record<string, Record<string, number>>): number {
  const ft = habit.frequency?.type
  if (ft === 'times_per_week' || ft === 'times_per_month') return 0
  let streak = 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 90; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const dow = d.getDay()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!isDayScheduled(habit, dow)) continue // skip unscheduled days
    const count = weekLogs[key]?.[habit.id] ?? 0
    if (count >= habit.goal) streak++
    else break
  }
  return streak
}

// ── Horizontal 7-day week strip ───────────────────────────────────────────────

function WeekStrip({ habits, weekLogs, onLog, onUnlog }: {
  habits: WorkHabit[]
  weekLogs: Record<string, Record<string, number>>
  onLog: (id: string, date: string) => void
  onUnlog: (id: string, date: string) => void
}) {
  const [range, setRange] = useState<7 | 28>(7)

  function makeDays(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); d.setHours(0, 0, 0, 0)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2), dateKey: key, dow: d.getDay(), isToday: i === n - 1 }
    })
  }

  const days = makeDays(range)

  // For 28-day view, split into 4 rows of 7
  const rows = range === 28
    ? [days.slice(0, 7), days.slice(7, 14), days.slice(14, 21), days.slice(21, 28)]
    : [days]

  const DayCell = ({ label, dateKey, dow, isToday }: { label: string; dateKey: string; dow: number; isToday: boolean }) => {
    const logs = weekLogs[dateKey] ?? {}
    return (
      <div className={`flex flex-col items-center gap-1 ${range === 7 ? 'py-2' : 'py-1'} px-0.5 rounded-xl transition-all ${
        isToday ? 'bg-navi-blue/12 border border-navi-blue/20' : ''
      }`}>
        {range === 7 && (
          <span className={`text-[10px] font-bold ${isToday ? 'text-navi-blue' : 'text-white/35'}`}>{label}</span>
        )}
        {range === 28 && (
          <span className={`text-[9px] ${isToday ? 'text-navi-blue' : 'text-white/20'}`}>{label.slice(0,1)}</span>
        )}
        {habits.map(h => {
          const scheduled = isDayScheduled(h, dow)
          const count     = logs[h.id] ?? 0
          const perPeriod = h.frequency?.type === 'times_per_week' || h.frequency?.type === 'times_per_month'
          const met       = perPeriod ? count > 0 : count >= h.goal
          const size      = range === 7 ? 'w-5 h-5 text-[9px]' : 'w-3.5 h-3.5 text-[8px]'
          return (
            <button
              key={h.id}
              onClick={() => scheduled && onLog(h.id, dateKey)}
              onContextMenu={e => { e.preventDefault(); if (scheduled && count > 0) onUnlog(h.id, dateKey) }}
              title={scheduled ? `${h.name}: ${count}/${h.goal}` : `${h.name}: not scheduled`}
              className={`${size} rounded-full flex items-center justify-center font-bold transition-all ${
                !scheduled
                  ? 'bg-white/4 opacity-20 cursor-default'
                  : met
                    ? 'bg-green-500/30 text-green-400 active:scale-90'
                    : count > 0
                      ? 'bg-navi-blue/20 text-navi-blue/70 active:scale-90'
                      : 'bg-white/8 hover:bg-white/14 active:scale-90'
              }`}
            >
              {scheduled && range === 7 && (met ? '✓' : count > 0 ? count : '')}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="border border-white/8 rounded-2xl p-3 bg-white/2">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] text-white/30 uppercase tracking-widest">
          {range === 7 ? 'Last 7 days' : 'Last 28 days'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/20">Tap to backfill · right-click to undo</span>
          <div className="flex gap-0.5 bg-white/6 rounded-lg p-0.5">
            {([7, 28] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-all ${
                  range === r ? 'bg-white/15 text-white' : 'text-white/25 hover:text-white/50'
                }`}>
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className={`grid grid-cols-7 ${range === 7 ? 'gap-1' : 'gap-0.5 mb-1'}`}>
          {row.map(day => <DayCell key={day.dateKey} {...day} />)}
        </div>
      ))}
    </div>
  )
}

// ── Habit card ────────────────────────────────────────────────────────────────

function HabitCard({ habit, count, streak, onLog, onUnlog, onEdit }: {
  habit: WorkHabit
  count: number
  streak: number
  onLog: () => void
  onUnlog: () => void
  onEdit: () => void
}) {
  const done = count >= habit.goal
  const dots = Array.from({ length: Math.max(habit.goal, count) }, (_, i) => i < count)

  return (
    <div className={`relative rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
      done ? 'border-green-500/30 bg-green-500/8' : 'border-white/10 bg-white/4'
    }`}>
      {/* Edit button */}
      <button
        onClick={e => { e.stopPropagation(); onEdit() }}
        className="absolute top-3 right-3 p-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/8 transition-all"
      >
        <Pencil className="w-3 h-3" />
      </button>

      {/* Emoji + name */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className="text-3xl">{habit.emoji}</span>
        <span className={`text-[13px] font-medium text-center ${done ? 'text-green-400' : 'text-white/70'}`}>
          {habit.name}
        </span>
        <span className="text-[10px] text-white/25">{freqLabel(habit.frequency)}</span>
        {streak > 1 && (
          <span className="text-[10px] font-semibold text-orange-400/80">🔥 {streak} days</span>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {dots.map((filled, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
            filled ? (done ? 'bg-green-400' : 'bg-navi-blue') : 'bg-white/12'
          }`} />
        ))}
      </div>

      {/* Count */}
      <div className={`text-center text-xs ${done ? 'text-green-400/70' : 'text-white/35'}`}>
        {done ? '✓ Done' : `${count} / ${habit.goal}`}
      </div>

      {/* Log + undo */}
      <div className="flex gap-1.5">
        <button
          onClick={onLog}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
            done
              ? 'border-green-500/25 text-green-400/60 hover:bg-green-500/10'
              : 'border-navi-blue/30 bg-navi-blue/10 text-navi-blue hover:bg-navi-blue/20'
          }`}
        >
          {done ? '+ More' : '+ Log'}
        </button>
        {count > 0 && (
          <button
            onClick={onUnlog}
            className="px-2.5 py-2 rounded-xl text-xs border border-white/10 text-white/30 hover:text-white/55 hover:border-white/20 transition-all"
            title="Undo"
          >
            <Minus className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Effective count for habits page cards ─────────────────────────────────────
// times_per_week → sum this week (Mon–Sun); times_per_month → sum this month; else → today

function habitEffectiveCount(habit: WorkHabit, todayLogs: HabitLog, weekLogs: Record<string, HabitLog>): number {
  const ft = habit.frequency?.type
  const now = new Date()
  if (ft === 'times_per_week') {
    return getWeekDateKeys(now).reduce((s, k) => s + (weekLogs[k]?.[habit.id] ?? 0), 0)
  }
  if (ft === 'times_per_month') {
    return getMonthDateKeys(now).reduce((s, k) => s + (weekLogs[k]?.[habit.id] ?? 0), 0)
  }
  return todayLogs[habit.id] ?? 0
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function HabitsTab() {
  const { habits, todayLogs, weekLogs, isWorkday, logHabit, unlogHabit, logHabitForDate, unlogHabitForDate, addHabit, updateHabit, deleteHabit } = useHabits()
  const [addOpen, setAddOpen]     = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingHabit = habits.find(h => h.id === editingId)
  const today  = new Date().toLocaleDateString('en-HK', { weekday: 'long', day: 'numeric', month: 'long' })
  const sorted = [...habits].sort((a, b) => a.order - b.order)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-8 space-y-4">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-white/35 uppercase tracking-widest font-medium">{today}</p>
            <h2 className="text-lg font-semibold text-white mt-1">Habits</h2>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-navi-blue/30 bg-navi-blue/10 text-navi-blue hover:bg-navi-blue/20 transition-all font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Habit
          </button>
        </div>

        {/* 7-day strip — horizontal */}
        <WeekStrip habits={sorted} weekLogs={weekLogs} onLog={logHabitForDate} onUnlog={unlogHabitForDate} />

        {/* Habit grid */}
        {habits.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/25">
            No habits yet — tap &ldquo;+ Habit&rdquo; to add one
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sorted.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                count={habitEffectiveCount(habit, todayLogs, weekLogs)}
                streak={computeStreak(habit, weekLogs)}
                onLog={() => logHabit(habit.id)}
                onUnlog={() => unlogHabit(habit.id)}
                onEdit={() => setEditingId(habit.id)}
              />
            ))}
          </div>
        )}

        {!isWorkday && (
          <p className="text-center text-xs text-white/20">Logging resumes Monday</p>
        )}

      </div>

      {/* Modals */}
      {addOpen && (
        <HabitModal
          onSave={addHabit}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editingHabit && (
        <HabitModal
          initial={editingHabit}
          onSave={patch => updateHabit(editingHabit.id, patch)}
          onDelete={() => deleteHabit(editingHabit.id)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
