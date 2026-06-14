import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth } from '@/shared/lib/google-auth'

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

  const results = await Promise.all(
    calendarIds.map(async calId => {
      const { data } = await cal.events.list({
        calendarId:   calId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   250,
      })
      // Get the calendar color from the list
      const calList = await cal.calendarList.get({ calendarId: calId }).catch(() => null)
      const googleColor = calList?.data.backgroundColor ?? '#4285f4'
      const color       = row?.calendar_colors?.[calId] ?? googleColor
      const summary = calList?.data.summary ?? calId

      return (data.items ?? []).map(e => ({
        id:          e.id,
        calendarId:  calId,
        calendarName: summary,
        color,
        title:       e.summary ?? '(no title)',
        start:       e.start?.dateTime ?? e.start?.date ?? '',
        end:         e.end?.dateTime   ?? e.end?.date   ?? '',
        allDay:      !e.start?.dateTime,
        location:    e.location ?? null,
        description: e.description ?? null,
        htmlLink:    e.htmlLink ?? null,
      }))
    }),
  )

  return NextResponse.json({ events: results.flat() })
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
