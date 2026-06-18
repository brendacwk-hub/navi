import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth, saveAuth } from '@/shared/lib/google-auth'

// Google uses different Birthdays calendar IDs depending on account type/region
const BIRTHDAYS_IDS = [
  '#contacts@group.v.calendar.google.com',
  'contactsbirthdays@contacts.google.com',
]

function isBirthdaysCalendar(c: { id?: string | null; summary?: string | null }) {
  return BIRTHDAYS_IDS.some(id => c.id === id) ||
    (c.summary?.toLowerCase().includes('birthday') ?? false)
}

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

  // If no Birthdays calendar found (by known ID or by name), try inserting each known ID
  if (!items.find(isBirthdaysCalendar)) {
    for (const birthdayId of BIRTHDAYS_IDS) {
      try {
        await cal.calendarList.insert({ requestBody: { id: birthdayId } })
        // Insert succeeded — refetch and return the updated list
        const { data: refreshed } = await cal.calendarList.list({ maxResults: 50, showHidden: true })
        return NextResponse.json({ calendars: (refreshed.items ?? []).map(toCalItem) })
      } catch {
        // This ID didn't work — try the next one
      }
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
