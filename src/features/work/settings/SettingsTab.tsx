'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Circle, ExternalLink, Loader2, LogOut, Plus, RefreshCw, Bell, BellOff, RotateCcw, X } from 'lucide-react'
import { usePushNotifications } from '@/shared/lib/use-push-notifications'
import { usePreferences, type FontScale } from '@/shared/lib/preferences-context'

interface CalendarItem {
  id: string
  summary: string
  color: string
  primary: boolean
}

interface CompletedTask {
  id: string
  title: string
  area: string
  effort: string
  sub_area: string | null
  items: unknown
  completed_at: string
  notes: string | null
  _source?: 'completed_tasks' | 'cycles'
}

const AREA_BADGE: Record<string, string> = {
  finance: 'bg-finance/15 text-finance border-finance/25',
  hr:      'bg-hr/15 text-hr border-hr/25',
  ops:     'bg-ops/15 text-ops border-ops/25',
  others:  'bg-others/15 text-others border-others/25',
}

interface ConnectionState {
  connected: boolean
  email: string | null
  selectedIds: string[]
  calendarColors: Record<string, string>
}

const COLOR_PALETTE = [
  { name: 'Red',       hex: '#ef4444' },
  { name: 'Orange',    hex: '#f97316' },
  { name: 'Yellow',    hex: '#eab308' },
  { name: 'Green',     hex: '#22c55e' },
  { name: 'Teal',      hex: '#14b8a6' },
  { name: 'Blue',      hex: '#3b82f6' },
  { name: 'Indigo',    hex: '#6366f1' },
  { name: 'Purple',    hex: '#a855f7' },
  { name: 'Pink',      hex: '#ec4899' },
  { name: 'Gray',      hex: '#6b7280' },
  { name: 'White',     hex: '#e5e7eb' },
]

const FONT_LABELS: { value: FontScale; label: string; desc: string }[] = [
  { value: 'small',  label: 'Small',  desc: 'Default' },
  { value: 'medium', label: 'Medium', desc: '+5%' },
  { value: 'large',  label: 'Large',  desc: '+10%' },
]

function resetItemStatuses(items: unknown): unknown {
  if (!Array.isArray(items)) return items
  return items.map((i: Record<string, unknown>) => ({
    ...i,
    status: 'todo',
    subItems: i.subItems ? resetItemStatuses(i.subItems) : undefined,
  }))
}

export function SettingsTab() {
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications()
  const { fontScale, setFontScale } = usePreferences()
  const [conn, setConn]                   = useState<ConnectionState | null>(null)
  const [calendars, setCalendars]         = useState<CalendarItem[]>([])
  const [saving, setSaving]               = useState(false)
  const [loading, setLoading]             = useState(true)
  const [statusMsg, setStatusMsg]         = useState<string | null>(null)
  const [archive, setArchive]             = useState<CompletedTask[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [reopening, setReopening]         = useState<string | null>(null)

  // Manual calendar ID input
  const [customCalId, setCustomCalId]     = useState('')
  const [addingCal, setAddingCal]         = useState(false)
  const [calIdError, setCalIdError]       = useState<string | null>(null)

  // Log completed task form
  const [showLogForm, setShowLogForm]     = useState(false)
  const [logTitle, setLogTitle]           = useState('')
  const [logArea, setLogArea]             = useState<'finance' | 'hr' | 'ops' | 'others'>('finance')
  const [logDate, setLogDate]             = useState(() => new Date().toISOString().slice(0, 10))
  const [logSaving, setLogSaving]         = useState(false)

  const loadArchive = useCallback(async () => {
    setArchiveLoading(true)
    try {
      // Primary: cycles with status='complete'
      let cycleRows: CompletedTask[] = []
      try {
        const cRes  = await fetch('/api/db?table=cycles&eqCol=status&eqVal=complete')
        const cJson = await cRes.json()
        if (cRes.ok && !cJson.error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const completedCycles = (cJson.data ?? []).filter((c: any) => !c.mode || c.mode === 'work')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cycleRows = completedCycles.map((c: any) => ({
            id: c.id, title: c.title, area: c.area, effort: c.effort ?? '',
            sub_area: c.sub_area ?? null, items: c.items ?? null,
            completed_at: c.last_completed_at ?? c.created_at ?? new Date().toISOString(),
            notes: c.notes ?? null, _source: 'cycles' as const,
          }))
        }
      } catch { /* ignore */ }

      // Secondary: completed_tasks table (legacy data)
      let legacyRows: CompletedTask[] = []
      try {
        const res  = await fetch('/api/db?table=completed_tasks')
        const json = await res.json()
        if (res.ok && !json.error) {
          const cycleIds = new Set(cycleRows.map(r => r.id))
          legacyRows = (json.data ?? [])
            .filter((r: CompletedTask) => !cycleIds.has(r.id))
            .map((r: CompletedTask) => ({ ...r, _source: 'completed_tasks' as const }))
        }
      } catch { /* table may not exist */ }

      const merged = [...cycleRows, ...legacyRows]
      merged.sort((a, b) => b.completed_at.localeCompare(a.completed_at))
      setArchive(merged)
    } finally {
      setArchiveLoading(false)
    }
  }, [])

  async function reopenTask(task: CompletedTask) {
    setReopening(task.id)
    try {
      const resetItems = resetItemStatuses(task.items)
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'cycles', operation: 'upsert',
          data: {
            id: task.id, title: task.title, area: task.area, effort: task.effort,
            must: false, urgent: false, status: 'active',
            trigger_label: null, sub_area: task.sub_area ?? null,
            items: resetItems, phases: null, notes: task.notes ?? null,
            next_due_at: null, last_completed_at: null,
            mode: 'work',
          },
        }),
      })
      if (task._source !== 'cycles') {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'completed_tasks', operation: 'delete', matchId: task.id }),
        })
      }
      setArchive(prev => prev.filter(t => t.id !== task.id))
    } finally {
      setReopening(null)
    }
  }

  async function logCompletedTask() {
    if (!logTitle.trim()) return
    setLogSaving(true)
    try {
      const id = `manual-${Date.now()}`
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'cycles', operation: 'upsert',
          data: {
            id, title: logTitle.trim(), area: logArea,
            effort: 'medium', must: false, urgent: false,
            status: 'complete', trigger_label: null, sub_area: null,
            items: null, phases: null, notes: null,
            last_completed_at: `${logDate}T00:00:00.000Z`,
            next_due_at: null, mode: 'work',
          },
        }),
      })
      setLogTitle('')
      setLogDate(new Date().toISOString().slice(0, 10))
      setShowLogForm(false)
      await loadArchive()
    } finally {
      setLogSaving(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') setStatusMsg('Google Calendar connected!')
    if (params.get('error'))             setStatusMsg(`Connection failed: ${params.get('error')}`)
    loadStatus()
    loadArchive()
  }, [loadArchive])

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/calendars')
      if (res.status === 401) {
        setConn({ connected: false, email: null, selectedIds: [], calendarColors: {} })
        return
      }
      const [calData, authData] = await Promise.all([
        res.json(),
        fetch('/api/auth/google/status').then(r => r.json()),
      ])
      setConn({
        connected:      true,
        email:          authData.email ?? null,
        selectedIds:    authData.selectedIds ?? [],
        calendarColors: authData.calendarColors ?? {},
      })
      setCalendars(calData.calendars ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function savePrefs(next: Partial<ConnectionState>) {
    if (!conn) return
    const merged = { ...conn, ...next }
    setConn(merged)
    setSaving(true)
    await fetch('/api/calendar/calendars', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        selectedIds:    merged.selectedIds,
        calendarColors: merged.calendarColors,
      }),
    })
    setSaving(false)
  }

  async function toggleCalendar(id: string) {
    if (!conn) return
    const current = conn.selectedIds
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    await savePrefs({ selectedIds: next })
  }

  async function setColor(calId: string, hex: string) {
    if (!conn) return
    await savePrefs({ calendarColors: { ...conn.calendarColors, [calId]: hex } })
  }

  async function addCustomCalendar() {
    const id = customCalId.trim()
    if (!id || !conn) return
    setCalIdError(null)
    setAddingCal(true)
    try {
      // Add to selected IDs directly — if the ID is invalid, events won't load but no harm done
      const alreadyInList = calendars.some(c => c.id === id)
      if (!alreadyInList) {
        // Add synthetic entry to local list so it shows in the UI
        setCalendars(prev => [...prev, { id, summary: id, color: '#4285f4', primary: false }])
      }
      await savePrefs({ selectedIds: [...conn.selectedIds.filter(x => x !== id), id] })
      setCustomCalId('')
    } catch {
      setCalIdError('Could not add calendar. Check the ID and try again.')
    } finally {
      setAddingCal(false)
    }
  }

  async function disconnect() {
    await fetch('/api/auth/google/disconnect', { method: 'POST' })
    setConn({ connected: false, email: null, selectedIds: [], calendarColors: {} })
    setCalendars([])
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8">
      <h2 className="text-lg font-semibold text-white mb-6">Settings</h2>

      {/* ── Google Calendar ──────────────────────────────── */}
      <section className="border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-white/3">
          <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-base">📅</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Google Calendar</div>
            <div className="text-[11px] text-white/35 mt-0.5">
              {conn?.connected
                ? `Connected as ${conn.email ?? '…'}`
                : 'Sync your Google calendars with Navi'}
            </div>
          </div>
          {conn?.connected && (
            <button onClick={disconnect}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-red-400 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-white/30 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : !conn?.connected ? (
            <a href="/api/auth/google"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navi-blue text-white text-sm font-semibold hover:bg-blue-600 transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
              Connect Google Calendar
            </a>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold">
                  Select calendars to show
                </p>
                {saving && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
              </div>

              {calendars.map(cal => {
                const selected     = conn.selectedIds.includes(cal.id)
                const chosenColor  = conn.calendarColors[cal.id]
                const displayColor = chosenColor ?? cal.color

                return (
                  <div key={cal.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      selected ? 'border-white/15 bg-white/4' : 'border-white/8 bg-white/2'
                    }`}
                  >
                    <button
                      onClick={() => toggleCalendar(cal.id)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: displayColor }} />
                      <span className={`flex-1 min-w-0 ${selected ? 'text-white' : 'text-white/55'}`}>
                        <span className="text-sm block truncate">
                          {cal.summary}
                          {cal.primary && <span className="ml-2 text-[10px] text-white/25">primary</span>}
                        </span>
                        <span className="text-[9px] text-white/18 block truncate font-mono">{cal.id}</span>
                      </span>
                      {selected
                        ? <CheckCircle2 className="w-4 h-4 text-navi-blue flex-shrink-0" />
                        : <Circle      className="w-4 h-4 text-white/15 flex-shrink-0" />}
                    </button>

                    {selected && (
                      <div className="px-3.5 pb-3 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-white/30 mr-1">Colour:</span>
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c.hex}
                            title={c.name}
                            onClick={() => setColor(cal.id, c.hex)}
                            className={`w-5 h-5 rounded-full transition-all flex-shrink-0 ${
                              displayColor === c.hex
                                ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-[#1a1a1a] scale-110'
                                : 'hover:scale-110 opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Manual calendar ID — fallback if Birthdays doesn't appear above */}
              <div className="pt-1">
                <p className="text-[11px] text-white/30 mb-2 leading-relaxed">
                  Don&apos;t see Birthdays? Find the ID in Google Calendar → Settings → click Birthdays → Calendar ID, then paste below:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCalId}
                    onChange={e => setCustomCalId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomCalendar()}
                    placeholder="Paste calendar ID…"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/25 font-mono"
                  />
                  <button
                    onClick={addCustomCalendar}
                    disabled={!customCalId.trim() || addingCal}
                    className="px-3 py-1.5 rounded-lg bg-navi-blue/20 border border-navi-blue/30 text-navi-blue text-xs font-semibold hover:bg-navi-blue/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {addingCal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                </div>
                {calIdError && <p className="mt-1 text-[11px] text-red-400/80">{calIdError}</p>}
              </div>

              <button onClick={loadStatus}
                className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors mt-1">
                <RefreshCw className="w-3 h-3" />
                Refresh calendar list
              </button>
            </div>
          )}

          {statusMsg && (
            <p className="mt-3 text-xs text-navi-blue">{statusMsg}</p>
          )}
        </div>
      </section>

      {/* ── Display ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-white mb-1">Text Size</h3>
          <p className="text-xs text-white/40 mb-4 leading-relaxed">
            Scales all text across Navi. Saves automatically.
          </p>
          <div className="flex gap-2">
            {FONT_LABELS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFontScale(opt.value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center gap-0.5 ${
                  fontScale === opt.value
                    ? 'border-navi-blue bg-navi-blue/15 text-navi-blue'
                    : 'border-white/10 text-white/45 hover:border-white/20 hover:text-white/70'
                }`}
              >
                {opt.label}
                <span className="text-[10px] font-normal opacity-60">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-white mb-1">Notifications</h3>
          <p className="text-xs text-white/40 mb-4 leading-relaxed">
            Receive habit reminders and daily summaries on this device. Must be installed as a PWA (Add to Home Screen) on iPhone.
          </p>

          {pushStatus === 'unsupported' && (
            <p className="text-xs text-white/30 italic">Push notifications are not supported on this browser/device.</p>
          )}

          {pushStatus === 'denied' && (
            <p className="text-xs text-red-400/70">Notifications blocked. Go to Settings → Safari → Notifications to allow.</p>
          )}

          {pushStatus === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
            </div>
          )}

          {(pushStatus === 'subscribed' || pushStatus === 'unsubscribed') && (
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${pushStatus === 'subscribed' ? 'bg-green-400' : 'bg-white/20'}`} />
              <span className="text-sm text-white/70 flex-1">
                {pushStatus === 'subscribed' ? 'Notifications enabled on this device' : 'Notifications off'}
              </span>
              {pushStatus === 'subscribed' ? (
                <button
                  onClick={unsubscribe}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
                >
                  <BellOff className="w-3.5 h-3.5" /> Turn off
                </button>
              ) : (
                <button
                  onClick={subscribe}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-navi-blue/30 bg-navi-blue/10 text-navi-blue hover:bg-navi-blue/20 transition-all font-semibold"
                >
                  <Bell className="w-3.5 h-3.5" /> Enable
                </button>
              )}
            </div>
          )}

          {pushStatus === 'subscribed' && (
            <p className="mt-3 text-[11px] text-white/25 leading-relaxed">
              You&apos;ll receive habit reminders at times set in the Habits tab, plus a morning summary at 9am.
            </p>
          )}
        </div>
      </section>

      {/* ── Completed Tasks Archive ───────────────────────────── */}
      <section className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div>
            <h3 className="text-sm font-semibold text-white">Completed Tasks</h3>
            <p className="text-[11px] text-white/35 mt-0.5">Reopen anything finished by mistake</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogForm(v => !v)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-white/10 text-white/35 hover:text-navi-blue hover:border-navi-blue/30 transition-all"
            >
              <Plus className="w-3 h-3" />
              Log task
            </button>
            <button onClick={loadArchive} disabled={archiveLoading} className="text-white/25 hover:text-white/55 transition-colors disabled:opacity-40">
              {archiveLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Manual log form */}
        {showLogForm && (
          <div className="px-5 py-3 border-b border-white/6 bg-white/2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-white/40 font-semibold uppercase tracking-widest">Log completed task</p>
              <button onClick={() => setShowLogForm(false)} className="text-white/25 hover:text-white/50">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={logTitle}
                onChange={e => setLogTitle(e.target.value)}
                placeholder="Task title…"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25"
              />
              <div className="flex gap-2">
                <select
                  value={logArea}
                  onChange={e => setLogArea(e.target.value as typeof logArea)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/25"
                >
                  <option value="finance">Finance</option>
                  <option value="hr">HR</option>
                  <option value="ops">Ops</option>
                  <option value="others">Others</option>
                </select>
                <input
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/25"
                />
              </div>
              <button
                onClick={logCompletedTask}
                disabled={!logTitle.trim() || logSaving}
                className="w-full py-2 rounded-lg bg-navi-blue/20 border border-navi-blue/30 text-navi-blue text-sm font-semibold hover:bg-navi-blue/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {logSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add to archive
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-3">
          {archiveLoading ? (
            <div className="flex items-center gap-2 text-xs text-white/30 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : archive.length > 0 ? (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {archive.map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 capitalize ${AREA_BADGE[task.area] ?? AREA_BADGE.finance}`}>
                    {task.area === 'hr' ? 'HR' : task.area}
                  </span>
                  <span className="flex-1 text-xs text-white/70 truncate">{task.title}</span>
                  <span className="text-[10px] text-white/25 flex-shrink-0">
                    {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <button
                    onClick={() => reopenTask(task)}
                    disabled={reopening === task.id}
                    className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-white/10 text-white/35 hover:text-navi-blue hover:border-navi-blue/30 transition-all disabled:opacity-40"
                  >
                    {reopening === task.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RotateCcw className="w-3 h-3" />}
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 space-y-1">
              <p className="text-xs text-white/25">No completed tasks yet.</p>
              <p className="text-[11px] text-white/18 leading-relaxed">
                Check off all items in a cycle to archive it automatically, or tap &ldquo;Log task&rdquo; to add historical tasks manually.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
