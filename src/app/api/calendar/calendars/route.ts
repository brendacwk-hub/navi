import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth, saveAuth } from '@/shared/lib/google-auth'

const BIRTHDAYS_ID = '#contacts@group.v.calendar.google.com'

function toCalItem(c: { id?: string | null; summary?: string | null; description?: string | null; backgroundColor?: string | null; primary?: boolean | null }) {
  return {
    id:          c.id,
    summary:     c.summary,
    description: c.description ?? null,
    color:       c.backgroundColor ?? '#4285f4',
    primary:     c.primary ?? false,
  }
}

export async function GET() {
  const client = await getAuthClient()
  if (!client) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const cal = google.calendar({ version: 'v3', auth: client })
  const { data } = await cal.calendarList.list({ maxResults: 50, showHidden: true })

  const items = data.items ?? []

  // Birthdays is a special system calendar Google hides by default.
  // If it's not in the list, insert it so the user can select it.
  if (!items.find(c => c.id === BIRTHDAYS_ID)) {
    try {
      await cal.calendarList.insert({ requestBody: { id: BIRTHDAYS_ID } })
      const { data: refreshed } = await cal.calendarList.list({ maxResults: 50, showHidden: true })
      return NextResponse.json({ calendars: (refreshed.items ?? []).map(toCalItem) })
    } catch {
      // Already in list or not available — continue with original results
    }
  }

  return NextResponse.json({ calendars: items.map(toCalItem) })
}

// PATCH — save selected calendars and/or color overrides
export async function PATCH(req: Request) {
  const body: { selectedIds?: string[]; calendarColors?: Record<string, string> } = await req.json()
  const row = await getStoredAuth()
  if (!row) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const patch: Record<string, unknown> = {}
  if (body.selectedIds    !== undefined) patch.selected_calendar_ids = body.selectedIds
  if (body.calendarColors !== undefined) patch.calendar_colors       = body.calendarColors

  await saveAuth(patch as Parameters<typeof saveAuth>[0])
  return NextResponse.json({ ok: true })
}
