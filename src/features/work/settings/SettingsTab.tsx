'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, ExternalLink, Loader2, LogOut, RefreshCw, Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '@/shared/lib/use-push-notifications'

interface CalendarItem {
  id: string
  summary: string
  color: string
  primary: boolean
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

export function SettingsTab() {
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications()
  const [conn, setConn]           = useState<ConnectionState | null>(null)
  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') setStatusMsg('Google Calendar connected!')
    if (params.get('error'))             setStatusMsg(`Connection failed: ${params.get('error')}`)
    loadStatus()
  }, [])

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
    let next: string[]
    if (current.includes(id)) {
      next = current.filter(x => x !== id)
    } else {
      if (current.length >= 2) {
        setStatusMsg('You can connect up to 2 calendars')
        setTimeout(() => setStatusMsg(null), 3000)
        return
      }
      next = [...current, id]
    }
    await savePrefs({ selectedIds: next })
  }

  async function setColor(calId: string, hex: string) {
    if (!conn) return
    await savePrefs({ calendarColors: { ...conn.calendarColors, [calId]: hex } })
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
                  Select up to 2 calendars
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
                    {/* Calendar row */}
                    <button
                      onClick={() => toggleCalendar(cal.id)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: displayColor }} />
                      <span className={`flex-1 text-sm ${selected ? 'text-white' : 'text-white/55'}`}>
                        {cal.summary}
                        {cal.primary && <span className="ml-2 text-[10px] text-white/25">primary</span>}
                      </span>
                      {selected
                        ? <CheckCircle2 className="w-4 h-4 text-navi-blue flex-shrink-0" />
                        : <Circle      className="w-4 h-4 text-white/15 flex-shrink-0" />}
                    </button>

                    {/* Color picker — only when selected */}
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
    </div>
  )
}
