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
          const isBirthdayId = BIRTHDAY_IDS.includes(calId) || calId.toLowerCase().includes('birthday')
          const calList = await cal.calendarList.get({ calendarId: calId }).catch(() => null)
          const googleColor = calList?.data.backgroundColor ?? (isBirthdayId ? '#e91e63' : '#4285f4')
          const color   = row?.calendar_colors?.[calId] ?? googleColor
          const summary = isBirthdayId ? 'Birthdays' : (calList?.data.summary ?? calId)

          if (!isBirthdayId) {
            const { data } = await cal.events.list({
              calendarId: calId, timeMin, timeMax,
              singleEvents: true, orderBy: 'startTime', maxResults: 500,
            })
            return (data.items ?? []).map(e => mapEvent(e, calId, summary, color))
          }

          // Birthday system calendar: fetch full year so all birthdays appear regardless of view range.
          // Try 1: singleEvents=true — expands recurring rules into current-year instances (correct dates).
          // Try 2: no singleEvents — returns recurring base events (may have original year); adjust year manually.
          // Both omit orderBy:startTime per B-48 (orderBy causes silent empty response on this calendar).
          const fetchYear = new Date(timeMin).getUTCFullYear()
          const fetchMin  = `${fetchYear}-01-01T00:00:00Z`
          const fetchMax  = `${fetchYear + 1}-01-01T00:00:00Z`

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let bdItems: any[] = []
          try {
            const { data: d1 } = await cal.events.list({
              calendarId: calId, timeMin: fetchMin, timeMax: fetchMax,
              singleEvents: true, maxResults: 500,
            })
            bdItems = d1.items ?? []
          } catch { /* singleEvents may not be supported on this calendar */ }

          if (bdItems.length === 0) {
            try {
              const { data: d2 } = await cal.events.list({
                calendarId: calId, timeMin: fetchMin, timeMax: fetchMax, maxResults: 500,
              })
              // Without singleEvents, start.date may be the original year — force it to fetchYear
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              bdItems = (d2.items ?? []).map((e: any) => {
                const dateStr = (e.start?.date ?? e.start?.dateTime ?? '').slice(0, 10)
                const mmdd    = dateStr.slice(5)
                if (!mmdd) return e
                return { ...e, start: { date: `${fetchYear}-${mmdd}` }, end: { date: `${fetchYear}-${mmdd}` } }
              })
            } catch { /* ignore */ }
          }

          console.error(`[events] birthday ${calId}: ${bdItems.length} events for ${fetchYear}`)
          return bdItems.map(e => mapEvent(e, calId, summary, color))
        } catch (err) {
          console.error(`[events] failed to fetch ${calId}:`, err)
          return []
        }
      }),
    ),
    // Probe birthday calendar IDs unless one is already explicitly selected
    (async (): Promise<ReturnType<typeof mapEvent>[]> => {
      if (birthdayAlreadySelected) return []
      const probeYear = new Date(timeMin).getUTCFullYear()
      const yearMin   = `${probeYear}-01-01T00:00:00Z`
      const yearMax   = `${probeYear + 1}-01-01T00:00:00Z`
      const birthdayColor = row?.calendar_colors?.['__birthdays__'] ?? '#e91e63'
      for (const birthdayId of BIRTHDAY_IDS) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let bdItems: any[] = []
          try {
            const { data } = await cal.events.list({
              calendarId: birthdayId, timeMin: yearMin, timeMax: yearMax,
              singleEvents: true, maxResults: 500,
            })
            bdItems = data.items ?? []
          } catch { /* singleEvents may not be supported on this calendar */ }

          if (bdItems.length === 0) {
            const { data } = await cal.events.list({
              calendarId: birthdayId, timeMin: yearMin, timeMax: yearMax, maxResults: 500,
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            bdItems = (data.items ?? []).map((e: any) => {
              const mmdd = (e.start?.date ?? '').slice(5)
              return mmdd ? { ...e, start: { date: `${probeYear}-${mmdd}` }, end: { date: `${probeYear}-${mmdd}` } } : e
            })
          }
          return bdItems.map(e => mapEvent(e, birthdayId, 'Birthdays', birthdayColor))
        } catch { /* this ID not accessible — try next */ }
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
