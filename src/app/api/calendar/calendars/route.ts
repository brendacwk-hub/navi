import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth, saveAuth } from '@/shared/lib/google-auth'

// Google uses different Birthdays calendar IDs depending on account type/region
const BIRTHDAYS_IDS = [
  '#contacts@group.v.calendar.google.com',
  'contactsbirthdays@contacts.google.com',
  'addressbook#contacts@group.v.calendar.google.com',
]

function isBirthdaysCalendar(c: { id?: string | null; summary?: string | null }) {
  const id   = (c.id   ?? '').toLowerCase()
  const name = (c.summary ?? '').toLowerCase()
  return BIRTHDAYS_IDS.some(bid => c.id === bid) ||
    name.includes('birthday') ||
    id.includes('birthday') ||
    (id.includes('contacts') && id.includes('calendar'))
}

interface CalItem {
  id?: string | null
  summary?: string | null
  description?: string | null
  backgroundColor?: string | null
  primary?: boolean | null
}

function toCalItem(c: CalItem) {
  const isBirthday = isBirthdaysCalendar(c)
  return {
    id:          c.id,
    summary:     c.summary ?? (isBirthday ? 'Birthdays' : c.id ?? 'Calendar'),
    description: c.description ?? null,
    color:       c.backgroundColor ?? (isBirthday ? '#e91e63' : '#4285f4'),
    primary:     c.primary ?? false,
  }
}

export async function GET() {
  const client = await getAuthClient()
  if (!client) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const cal = google.calendar({ version: 'v3', auth: client })
  const { data } = await cal.calendarList.list({ maxResults: 250, showHidden: true })

  const items: CalItem[] = data.items ?? []
  let mapped = items.map(toCalItem)

  // If Birthdays not in the subscription list, probe it via events.list() —
  // Google's Birthdays calendar is a system calendar that may not appear in calendarList
  // but IS accessible via the events API for accounts where it's enabled
  if (!mapped.some(c => isBirthdaysCalendar({ id: c.id, summary: c.summary }))) {
    const probeYear = new Date().getFullYear()
    const probeMin  = `${probeYear}-01-01T00:00:00Z`
    const probeMax  = `${probeYear + 1}-01-01T00:00:00Z`

    for (const birthdayId of BIRTHDAYS_IDS) {
      try {
        await cal.events.list({
          calendarId: birthdayId,
          timeMin: probeMin,
          timeMax: probeMax,
          maxResults: 1,
        })
        // No exception = calendar is accessible — add it as a selectable option
        mapped = [...mapped, {
          id: birthdayId,
          summary: 'Birthdays',
          description: null,
          color: '#e91e63',
          primary: false,
        }]
        break
      } catch (err) {
        console.error(`[calendars] birthday probe failed for ${birthdayId}:`, (err as Error).message ?? err)
      }
    }
  }

  return NextResponse.json({ calendars: mapped })
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
