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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Matches: "every [N] unit from YYYY-MM-DD"
export const RECURR_RE = /^every (?:(\d+) )?(days?|weeks?|months?|years?) from (\d{4}-\d{2}-\d{2})$/i

export function isRecurrString(s: string | undefined): boolean {
  return !!s && RECURR_RE.test(s)
}

export function fmtRecurrDisplay(s: string): string {
  const m = s.match(RECURR_RE)
  if (!m) return 'Repeat'
  const n = m[1] ? parseInt(m[1]) : 1
  const unit = m[2].toLowerCase()
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Parsed { unit: Unit; n: number; start: string }

function parseRecurr(val: string): Parsed {
  const fb: Parsed = { unit: 'none', n: 2, start: todayISO() }
  if (!val) return fb
  const m = val.match(RECURR_RE)
  if (!m) return fb
  const n  = m[1] ? parseInt(m[1]) : 1
  const rawUnit = m[2].toLowerCase() as Unit
  return { unit: rawUnit, n, start: m[3] }
}

function buildRecurr(unit: Unit, n: number, start: string): string {
  if (unit === 'none') return ''
  const plural = UNITS.find(u => u.value === unit)?.plural ?? false
  return plural ? `every ${n} ${unit} from ${start}` : `every ${unit} from ${start}`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string         // current recurrence string, '' for none
  onChange: (val: string) => void
  small?: boolean       // compact mode for ChecklistItem
}

export function RecurrencePicker({ value, onChange, small }: Props) {
  const init = parseRecurr(value)
  const [unit,  setUnit]  = useState<Unit>(init.unit)
  const [n,     setN]     = useState(init.n)
  const [start, setStart] = useState(init.start)

  useEffect(() => {
    if (!value) { setUnit('none'); return }
    const p = parseRecurr(value)
    setUnit(p.unit); setN(p.n); setStart(p.start)
  }, [value])

  const plural = UNITS.find(u => u.value === unit)?.plural ?? false
  const maxN   = unit === 'days' ? 365 : unit === 'weeks' ? 52 : unit === 'months' ? 24 : 10
  const sz     = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
  const lbl    = small ? 'text-[10px]' : 'text-xs'

  const emit = (u: Unit, num: number, s: string) => onChange(buildRecurr(u, num, s))
  const handleUnit  = (u: Unit)   => { setUnit(u);  emit(u, n, start) }
  const handleN     = (num: number) => { setN(num);  emit(unit, num, start) }
  const handleStart = (s: string)  => { setStart(s); emit(unit, n, s) }

  const sel = `bg-white/8 border border-white/15 rounded focus:outline-none focus:border-navi-blue/40 [color-scheme:dark] text-white/65 ${sz}`

  return (
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
  )
}
