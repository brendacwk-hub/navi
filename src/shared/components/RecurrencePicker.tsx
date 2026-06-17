'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Unit = 'none' | 'day' | 'days' | 'week' | 'weeks' | 'month' | 'months' | 'year'

interface UnitOption { value: Unit; label: string; plural: boolean }

const UNITS: UnitOption[] = [
  { value: 'none',   label: 'Does not repeat', plural: false },
  { value: 'day',    label: 'day',             plural: false },
  { value: 'days',   label: 'day(s)',          plural: true  },
  { value: 'week',   label: 'week',            plural: false },
  { value: 'weeks',  label: 'week(s)',         plural: true  },
  { value: 'month',  label: 'month',           plural: false },
  { value: 'months', label: 'month(s)',        plural: true  },
  { value: 'year',   label: 'year',            plural: false },
]

const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_LABEL: Record<string, string> = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Format: "every [N] unit [on spec] from YYYY-MM-DD"
// spec: weekdays "mon,thu" | month day "15" | "last"
export const RECURR_RE = /^every (?:(\d+) )?(days?|weeks?|months?|years?)(?:\s+on\s+([a-z0-9,]+))?\s+from (\d{4}-\d{2}-\d{2})$/i

export function isRecurrString(s: string | undefined): boolean {
  return !!s && RECURR_RE.test(s)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function fmtRecurrDisplay(s: string): string {
  const m = s.match(RECURR_RE)
  if (!m) return 'Repeat'
  const n    = m[1] ? parseInt(m[1]) : 1
  const unit = m[2].toLowerCase()
  const on   = m[3] ? m[3].toLowerCase() : null

  const base = n === 1 ? `Every ${unit.replace(/s$/, '')}` : `Every ${n} ${unit}`

  if (!on) return base

  if (unit.startsWith('week')) {
    const days = on.split(',').map(d => DAY_LABEL[d] || d)
    if (days.length === 1) return n === 1 ? `Every ${days[0]}` : `${base} on ${days[0]}`
    const joined = days.slice(0, -1).join(', ') + ' & ' + days[days.length - 1]
    return n === 1 ? `Every ${joined}` : `${base} on ${joined}`
  }

  if (unit.startsWith('month')) {
    if (on === 'last') return `${base} (last day)`
    return `${base} on the ${ordinal(parseInt(on))}`
  }

  return base
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Parsed { unit: Unit; n: number; start: string; weekDays: string[]; monthDay: string }

function parseRecurr(val: string): Parsed {
  const fb: Parsed = { unit: 'none', n: 2, start: todayISO(), weekDays: [], monthDay: '' }
  if (!val) return fb
  const m = val.match(RECURR_RE)
  if (!m) return fb
  const n       = m[1] ? parseInt(m[1]) : 1
  const rawUnit = m[2].toLowerCase() as Unit
  const on      = m[3] ? m[3].toLowerCase() : ''
  const start   = m[4]
  const isWeek  = rawUnit === 'week' || rawUnit === 'weeks'
  const isMonth = rawUnit === 'month' || rawUnit === 'months'
  return {
    unit:     rawUnit,
    n,
    start,
    weekDays: isWeek && on  ? on.split(',') : [],
    monthDay: isMonth && on ? on : '',
  }
}

function buildRecurr(unit: Unit, n: number, start: string, weekDays: string[], monthDay: string): string {
  if (unit === 'none') return ''
  const plural  = UNITS.find(u => u.value === unit)?.plural ?? false
  const base    = plural ? `every ${n} ${unit}` : `every ${unit}`
  const isWeek  = unit === 'week' || unit === 'weeks'
  const isMonth = unit === 'month' || unit === 'months'
  let onClause  = ''
  if (isWeek  && weekDays.length > 0) onClause = ` on ${weekDays.join(',')}`
  else if (isMonth && monthDay)        onClause = ` on ${monthDay}`
  return `${base}${onClause} from ${start}`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (val: string) => void
  small?: boolean
}

export function RecurrencePicker({ value, onChange, small }: Props) {
  const init = parseRecurr(value)
  const [unit,     setUnit]     = useState<Unit>(init.unit)
  const [n,        setN]        = useState(init.n)
  const [start,    setStart]    = useState(init.start)
  const [weekDays, setWeekDays] = useState<string[]>(init.weekDays)
  const [monthDay, setMonthDay] = useState<string>(init.monthDay)

  useEffect(() => {
    if (!value) { setUnit('none'); setWeekDays([]); setMonthDay(''); return }
    const p = parseRecurr(value)
    setUnit(p.unit); setN(p.n); setStart(p.start)
    setWeekDays(p.weekDays); setMonthDay(p.monthDay)
  }, [value])

  const plural  = UNITS.find(u => u.value === unit)?.plural ?? false
  const maxN    = unit === 'days' ? 365 : unit === 'weeks' ? 52 : unit === 'months' ? 24 : 10
  const isWeek  = unit === 'week' || unit === 'weeks'
  const isMonth = unit === 'month' || unit === 'months'
  const sz      = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
  const lbl     = small ? 'text-[10px]' : 'text-xs'
  const sel     = `bg-white/8 border border-white/15 rounded focus:outline-none focus:border-navi-blue/40 [color-scheme:dark] text-white/65 ${sz}`

  const handleUnit = (u: Unit) => {
    setUnit(u)
    const newIsWeek  = u === 'week' || u === 'weeks'
    let newWeekDays  = weekDays
    if (newIsWeek && weekDays.length === 0) {
      newWeekDays = [DAY_ABBR[new Date().getDay()]]
      setWeekDays(newWeekDays)
    }
    onChange(buildRecurr(u, n, start, newWeekDays, monthDay))
  }

  const handleN = (num: number) => {
    setN(num)
    onChange(buildRecurr(unit, num, start, weekDays, monthDay))
  }

  const handleStart = (s: string) => {
    setStart(s)
    onChange(buildRecurr(unit, n, s, weekDays, monthDay))
  }

  const handleWeekDay = (day: string) => {
    const selected = weekDays.includes(day)
    // prevent deselecting last day
    const next = selected && weekDays.length > 1
      ? weekDays.filter(d => d !== day)
      : selected ? weekDays : [...weekDays, day]
    setWeekDays(next)
    onChange(buildRecurr(unit, n, start, next, monthDay))
  }

  const handleMonthDay = (md: string) => {
    setMonthDay(md)
    onChange(buildRecurr(unit, n, start, weekDays, md))
  }

  return (
    <div className="space-y-1.5">
      {/* Row 1: Repeat [N] [unit] from [date] */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${lbl} text-white/35 uppercase tracking-widest flex-shrink-0`}>Repeat</span>
        {plural && (
          <select value={n} onChange={e => handleN(parseInt(e.target.value))} className={sel}>
            {Array.from({ length: maxN - 1 }, (_, i) => i + 2).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
        <select value={unit} onChange={e => handleUnit(e.target.value as Unit)} className={sel}>
          {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
        {unit !== 'none' && (
          <>
            <span className={`${lbl} text-white/35 flex-shrink-0`}>from</span>
            <input
              type="date"
              value={start}
              onChange={e => { if (e.target.value) handleStart(e.target.value) }}
              className={sel}
            />
          </>
        )}
      </div>

      {/* Row 2: Weekday picker (week units only) */}
      {isWeek && (
        <div className="flex flex-wrap gap-1 pl-1">
          {DAY_ABBR.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => handleWeekDay(day)}
              className={`${sz} rounded border transition-all ${
                weekDays.includes(day)
                  ? 'bg-navi-blue/20 border-navi-blue/40 text-navi-blue'
                  : 'border-white/10 text-white/35 hover:border-white/25 hover:text-white/60'
              }`}
            >
              {DAY_LABEL[day]}
            </button>
          ))}
        </div>
      )}

      {/* Row 2: Month day picker (month units only) */}
      {isMonth && (
        <div className="flex items-center gap-1.5 pl-1">
          <span className={`${lbl} text-white/35`}>on the</span>
          <select value={monthDay} onChange={e => handleMonthDay(e.target.value)} className={sel}>
            <option value="">same date</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={String(d)}>{ordinal(d)}</option>
            ))}
            <option value="last">last day</option>
          </select>
        </div>
      )}
    </div>
  )
}
