import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth } from '@/shared/lib/google-auth'

// System birthday calendar IDs — Google uses different IDs per account type
const BIRTHDAY_IDS = [
  '#contacts@group.v.calendar.google.com',
  'contactsbirthdays@contacts.google.com',
  'addressbook#contacts@group.v.calendar.google.com',
]

function mapEvent(
  e: {
    id?: string | null; summary?: string | null
    start?: { dateTime?: string | null; date?: string | null } | null
    end?: { dateTime?: string | null; date?: string | null } | null
    location?: string | null; description?: string | null; htmlLink?: string | null
  },
  calId: string, calName: string, color: string,
) {
  return {
    id: e.id, calendarId: calId, calendarName: calName, color,
    title: e.summary ?? '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end:   e.end?.dateTime   ?? e.end?.date   ?? '',
    allDay: !e.start?.dateTime,
    location: e.location ?? null, description: e.description ?? null, htmlLink: e.htmlLink ?? null,
  }
}

export async function GET(req: NextRequest) {
  const client = await getAuthClient()
  if (!client) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const row = await getStoredAuth()
  const calendarIds: string[] = row?.selected_calendar_ids ?? []
  if (calendarIds.length === 0) return NextResponse.json({ events: [] })

  const timeMin = req.nextUrl.searchParams.get('timeMin')
  const timeMax = req.nextUrl.searchParams.get('timeMax')
  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: 'timeMin and timeMax required' }, { status: 400 })
  }

  const cal = google.calendar({ version: 'v3', auth: client })

  // Is a birthday calendar already explicitly selected by the user?
  const birthdayAlreadySelected = calendarIds.some(id => {
    const lid = id.toLowerCase()
    return BIRTHDAY_IDS.includes(id) || lid.includes('birthday') || (lid.includes('contact') && lid.includes('calendar'))
  })

  // Fetch selected calendars + probe birthday calendars concurrently
  const [selectedResults, birthdayEvents] = await Promise.all([
    Promise.all(
      calendarIds.map(async calId => {
        try {
          // Birthday system calendar doesn't support orderBy:startTime — use singleEvents only
          const isBirthdayId = BIRTHDAY_IDS.includes(calId) || calId.toLowerCase().includes('birthday')
          const { data } = await cal.events.list({
            calendarId: calId, timeMin, timeMax,
            singleEvents: true,
            ...(isBirthdayId ? {} : { orderBy: 'startTime' }),
            maxResults: 250,
          })
          const calList = await cal.calendarList.get({ calendarId: calId }).catch(() => null)
          const googleColor = calList?.data.backgroundColor ?? '#4285f4'
          const color   = row?.calendar_colors?.[calId] ?? googleColor
          const summary = calList?.data.summary ?? calId
          return (data.items ?? []).map(e => mapEvent(e, calId, summary, color))
        } catch (err) {
          console.error(`[events] failed to fetch ${calId}:`, err)
          return []
        }
      }),
    ),
    // Probe birthday calendar IDs unless one is already explicitly selected
    (async (): Promise<ReturnType<typeof mapEvent>[]> => {
      if (birthdayAlreadySelected) return []
      for (const birthdayId of BIRTHDAY_IDS) {
        try {
          const { data: bData } = await cal.events.list({
            calendarId: birthdayId, timeMin, timeMax,
            singleEvents: true, orderBy: 'startTime', maxResults: 250,
          })
          const birthdayColor = row?.calendar_colors?.['__birthdays__'] ?? '#e91e63'
          // No exception = calendar accessible; events may be empty if no birthdays in this window
          return (bData.items ?? []).map(e => mapEvent(e, birthdayId, 'Birthdays', birthdayColor))
        } catch {
          // This ID not accessible for this account, try the next
        }
      }
      return []
    })(),
  ])

  return NextResponse.json({ events: [...selectedResults.flat(), ...birthdayEvents] })
}

// POST — create a new event
export async function POST(req: Request) {
  const client = await getAuthClient()
  if (!client) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const row = await getStoredAuth()
  const primaryId = row?.selected_calendar_ids?.[0] ?? 'primary'

  const body = await req.json()
  const cal  = google.calendar({ version: 'v3', auth: client })

  const { data } = await cal.events.insert({
    calendarId: body.calendarId ?? primaryId,
    requestBody: {
      summary:     body.title,
      description: body.description ?? undefined,
      location:    body.location    ?? undefined,
      start: body.allDay
        ? { date: body.start }
        : { dateTime: body.start, timeZone: 'Asia/Hong_Kong' },
      end: body.allDay
        ? { date: body.end }
        : { dateTime: body.end, timeZone: 'Asia/Hong_Kong' },
    },
  })

  return NextResponse.json({ event: data })
}
