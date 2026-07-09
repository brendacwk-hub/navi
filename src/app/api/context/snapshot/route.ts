import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth } from '@/shared/lib/google-auth'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MOOD_WORDS: Record<string, string> = {
  '😄': 'Great',
  '🙂': 'Good',
  '😐': 'Okay',
  '😔': 'Low',
  '😢': 'Rough',
}

// Start of N days ago, HKT-aware, returned as UTC ISO string
function hkDaysAgo(n: number): string {
  const hkOffset = 8 * 60 * 60 * 1000
  const hkNow = new Date(Date.now() + hkOffset)
  hkNow.setDate(hkNow.getDate() - n)
  hkNow.setHours(0, 0, 0, 0)
  return new Date(hkNow.getTime() - hkOffset).toISOString()
}

// YYYY-MM-DD for N days ago in HKT (for GCal timeMin param)
function hkDaysAgoDate(n: number): string {
  const hkOffset = 8 * 60 * 60 * 1000
  const hkNow = new Date(Date.now() + hkOffset)
  hkNow.setDate(hkNow.getDate() - n)
  return hkNow.toISOString().slice(0, 10)
}

async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
        }),
      }
    )
    const json = await res.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch {
    return null
  }
}

function extractJson(raw: string | null, field: string): string | null {
  if (!raw) return null
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    return parsed[field] ?? null
  } catch {
    return null
  }
}

function avgDays(dates: string[]): number {
  if (!dates.length) return 0
  const now = Date.now()
  const total = dates.reduce((sum, d) => sum + Math.floor((now - new Date(d).getTime()) / 86_400_000), 0)
  return Math.round(total / dates.length)
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('apiKey')
  const authHeader = req.headers.get('authorization')
  const naviKey = process.env.NAVI_API_KEY
  const cronSecret = process.env.CRON_SECRET

  const authed =
    (naviKey && apiKey === naviKey) ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since30d = hkDaysAgo(30)
  const since14d = hkDaysAgo(14)
  const since7d  = hkDaysAgo(7)

  // ── Fetch all data sources in parallel ──────────────────────────────────
  const [completionsResult, ideasResult, diaryResult, calendarResult] = await Promise.allSettled([

    admin
      .from('cycle_completions')
      .select('title, area, sub_area, effort, completed_at')
      .gte('completed_at', since30d),

    admin
      .from('personal_ideas')
      .select('title, status, created_at')
      .neq('status', 'converted'),

    admin
      .from('diary_entries')
      .select('date, mood, prompts, body')
      .order('date', { ascending: false })
      .limit(30),

    // Personal GCal events — last 4 weeks
    (async (): Promise<string[]> => {
      try {
        const auth = await getAuthClient()
        if (!auth) return []
        const row = await getStoredAuth()
        const calIds: string[] = row?.selected_calendar_ids ?? []
        if (!calIds.length) return []
        const cal = google.calendar({ version: 'v3', auth })
        const timeMin = `${hkDaysAgoDate(28)}T00:00:00+08:00`
        const timeMax = new Date().toISOString()
        const results = await Promise.all(
          calIds.map(id =>
            cal.events.list({ calendarId: id, timeMin, timeMax, singleEvents: true, maxResults: 100 })
              .catch(() => null)
          )
        )
        const events: string[] = []
        for (const r of results) {
          for (const e of r?.data.items ?? []) {
            if (e.summary && !e.summary.toLowerCase().includes('birthday')) {
              const date = (e.start?.date ?? e.start?.dateTime ?? '').slice(0, 10)
              events.push(`${date}: ${e.summary}`)
            }
          }
        }
        return events
      } catch {
        return []
      }
    })(),

  ])

  // ── COMPLETIONS: sub-area + effort breakdown (30d) ───────────────────────
  type CompRow = { title: string; area: string; sub_area: string | null; effort: string | null; completed_at: string }
  const completions30d = completionsResult.status === 'fulfilled'
    ? (completionsResult.value.data ?? []) as CompRow[]
    : []

  const areaMap: Record<string, {
    count: number
    titles: string[]
    subAreas: Record<string, number>
    efforts: Record<string, number>
  }> = {}

  for (const c of completions30d) {
    if (!areaMap[c.area]) areaMap[c.area] = { count: 0, titles: [], subAreas: {}, efforts: {} }
    const e = areaMap[c.area]
    e.count++
    if (e.titles.length < 3) e.titles.push(c.title)
    if (c.sub_area) e.subAreas[c.sub_area] = (e.subAreas[c.sub_area] ?? 0) + 1
    if (c.effort)   e.efforts[c.effort]    = (e.efforts[c.effort]    ?? 0) + 1
  }

  const completionsSummary = Object.entries(areaMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([area, v]) => {
      const subStr    = Object.entries(v.subAreas).map(([s, n]) => `${s}×${n}`).join(', ')
      const effortStr = (['heavy', 'medium', 'quick'] as const)
        .filter(ef => v.efforts[ef])
        .map(ef => `${ef}×${v.efforts[ef]}`)
        .join(', ')
      const detail = [subStr && `sub: ${subStr}`, effortStr && `effort: ${effortStr}`].filter(Boolean).join('; ')
      return `${area}: ${v.count} tasks${detail ? ` (${detail})` : ''}`
    })
    .join(' | ') || 'No completions in last 30 days'

  // ── VELOCITY: this week vs last week ─────────────────────────────────────
  const thisWeek = completions30d.filter(c => c.completed_at >= since7d)
  const lastWeek = completions30d.filter(c => c.completed_at >= since14d && c.completed_at < since7d)

  const effortStr = (rows: CompRow[]) =>
    (['heavy', 'medium', 'quick'] as const)
      .filter(e => rows.some(r => r.effort === e))
      .map(e => `${e}×${rows.filter(r => r.effort === e).length}`)
      .join(', ') || 'no effort data'

  const trend =
    thisWeek.length > lastWeek.length ? '↑ accelerating' :
    thisWeek.length < lastWeek.length ? '↓ slowing' : '→ steady'

  const velocitySummary =
    `This week: ${thisWeek.length} tasks (${effortStr(thisWeek)}). ` +
    `Last week: ${lastWeek.length} tasks (${effortStr(lastWeek)}). ${trend}`

  // ── IDEAS: pipeline age ───────────────────────────────────────────────────
  type IdeaRow = { title: string; status: string; created_at: string }
  const ideas = ideasResult.status === 'fulfilled'
    ? (ideasResult.value.data ?? []) as IdeaRow[]
    : []

  const byStatus: Record<string, { titles: string[]; dates: string[] }> = {}
  for (const idea of ideas) {
    if (!byStatus[idea.status]) byStatus[idea.status] = { titles: [], dates: [] }
    byStatus[idea.status].titles.push(idea.title)
    byStatus[idea.status].dates.push(idea.created_at)
  }

  const shelved = byStatus['shelved']?.titles ?? []
  const ready   = byStatus['ready']?.titles ?? []
  const developing = [
    ...(byStatus['developing']?.titles ?? []),
    ...(byStatus['exploring']?.titles ?? []),
  ]
  const developingDates = [
    ...(byStatus['developing']?.dates ?? []),
    ...(byStatus['exploring']?.dates ?? []),
  ]
  const newIdeas = byStatus['new']?.titles ?? []

  const ideasSummary = [
    ready.length
      ? `${ready.length} ready (avg ${avgDays(byStatus['ready']?.dates ?? [])}d old): ${ready.slice(0, 3).join(', ')}`
      : null,
    developing.length
      ? `${developing.length} developing (avg ${avgDays(developingDates)}d old): ${developing.slice(0, 3).join(', ')}`
      : null,
    newIdeas.length
      ? `${newIdeas.length} new (avg ${avgDays(byStatus['new']?.dates ?? [])}d old)`
      : null,
  ].filter(Boolean).join('. ') || 'No active ideas'

  const shelvedPatterns = shelved.length
    ? `Shelved: ${shelved.slice(0, 6).join(', ')}`
    : 'No shelved ideas'

  // ── MOOD TRENDS ───────────────────────────────────────────────────────────
  type DiaryRow = {
    date: string
    mood: string | null
    prompts: Array<{ question: string; answer: string }> | null
    body: string | null
  }
  const diaryEntries = diaryResult.status === 'fulfilled'
    ? (diaryResult.value.data ?? []) as DiaryRow[]
    : []

  const moodCounts: Record<string, number> = {}
  for (const e of diaryEntries) {
    if (e.mood && MOOD_WORDS[e.mood]) {
      const word = MOOD_WORDS[e.mood]
      moodCounts[word] = (moodCounts[word] ?? 0) + 1
    }
  }
  const moodTrends = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => `${word}×${count}`)
    .join(', ') || 'No mood data yet'

  // ── GEMINI: diary themes + calendar patterns in parallel ──────────────────
  const last14 = diaryEntries.slice(0, 14)
  const calEvents = calendarResult.status === 'fulfilled'
    ? calendarResult.value as string[]
    : []

  const diaryText = last14
    .map(e => {
      const answers = (e.prompts ?? []).filter(p => p.answer?.trim()).map(p => p.answer).join(' ')
      return `${e.date}: ${(answers || e.body || '').slice(0, 300)}`
    })
    .join('\n')

  const [diaryRaw, calRaw] = await Promise.allSettled([
    last14.length > 0
      ? callGemini(
          `Analyse these diary entries and return ONLY {"themes":"..."} — a single string listing 3-5 specific recurring emotional or behavioural patterns. Be concrete (e.g. "high energy around Sidoi, scattered mid-week, late nights"). Under 160 characters.\n\n${diaryText}`
        )
      : Promise.resolve(null),
    calEvents.length > 0
      ? callGemini(
          `Analyse these personal calendar events from the last 4 weeks and return ONLY {"patterns":"..."} — a single string describing 3-4 recurring scheduling patterns (e.g. "busy Tuesdays, free Friday mornings, monthly X"). Under 160 characters.\n\nEvents:\n${calEvents.join('\n')}`
        )
      : Promise.resolve(null),
  ])

  const diaryThemes =
    extractJson(diaryRaw.status === 'fulfilled' ? diaryRaw.value : null, 'themes') ??
    'No diary history yet'

  const calendarPatterns =
    extractJson(calRaw.status === 'fulfilled' ? calRaw.value : null, 'patterns') ??
    'No calendar data'

  // ── Write snapshot ────────────────────────────────────────────────────────
  await admin.from('user_context').upsert({
    id: 'singleton',
    built_at: new Date().toISOString(),
    completions_summary: completionsSummary,
    velocity_summary:    velocitySummary,
    ideas_summary:       ideasSummary,
    shelved_patterns:    shelvedPatterns,
    diary_themes:        diaryThemes,
    mood_trends:         moodTrends,
    calendar_patterns:   calendarPatterns,
  })

  return NextResponse.json({
    ok: true,
    built_at: new Date().toISOString(),
    completions_summary: completionsSummary,
    velocity_summary:    velocitySummary,
    ideas_summary:       ideasSummary,
    shelved_patterns:    shelvedPatterns,
    diary_themes:        diaryThemes,
    mood_trends:         moodTrends,
    calendar_patterns:   calendarPatterns,
  })
}
