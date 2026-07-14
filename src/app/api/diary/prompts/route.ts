import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { getAuthClient, getStoredAuth } from '@/shared/lib/google-auth'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BASE_QUESTIONS = [
  "What's one thing you finished today that you're glad you didn't leave for tomorrow?",
  "Did anything feel harder than it should have been today?",
  "What's one thing that surprised you today?",
  "Was there a moment today where you felt genuinely calm or in control?",
  "What's sitting in the back of your mind that hasn't made it onto a list yet?",
  "Did you make time for anything creative or hands-on today?",
  "Is there someone you meant to follow up with but haven't?",
  "What would make tomorrow feel like a good day?",
  "How's your energy compared to earlier this week?",
  "What's one thing you'd do differently about today?",
  "What's the one thing you most want to carry into tomorrow?",
  "Did anything shift your mood today — up or down?",
  "What felt satisfying to close out today?",
  "What's one thing you noticed about yourself today?",
  "Did you get to do something just for yourself today?",
]

interface CompletionRow {
  title: string
  area: string
  mode: string
  sub_area: string | null
  recurring: boolean
}

interface DayContext {
  gcal: string[]
  workTasks: string[]
  completedToday: CompletionRow[]
  weeklyByArea: { label: string; count: number; titles: string[] }[]
  pastDiary: { id: string; snippet: string }[]
  userContext: string | null
}

// Increment date string by N days (YYYY-MM-DD, no Date object needed for DST safety)
function addDaysToDate(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

// HK is UTC+8 — bracket queries so completions at e.g. 23:00 HK don't land on the wrong date
function hkBracket(date: string): { from: string; to: string } {
  return {
    from: `${date}T00:00:00+08:00`,
    to:   `${addDaysToDate(date, 1)}T00:00:00+08:00`,
  }
}

const AREA_LABELS: Record<string, string> = {
  finance: 'Finance', hr: 'HR', ops: 'Ops', others: 'Others',
  housework: 'Home', 'personal-finance': 'Personal Finance',
  sidoi: 'Sidoi', tobuy: 'To Buy',
}

async function fetchDayContext(date: string): Promise<DayContext> {
  const ctx: DayContext = { gcal: [], workTasks: [], completedToday: [], weeklyByArea: [], pastDiary: [], userContext: null }

  await Promise.allSettled([
    // GCal events for the day
    (async () => {
      try {
        const auth = await getAuthClient()
        if (!auth) return
        const row  = await getStoredAuth()
        const calIds: string[] = row?.selected_calendar_ids ?? []
        if (!calIds.length) return
        const cal = google.calendar({ version: 'v3', auth })
        const timeMin = `${date}T00:00:00+08:00`
        const timeMax = `${date}T23:59:59+08:00`
        const results = await Promise.all(
          calIds.map(id =>
            cal.events.list({ calendarId: id, timeMin, timeMax, singleEvents: true, maxResults: 50 })
              .catch(() => null)
          )
        )
        for (const r of results) {
          for (const e of r?.data.items ?? []) {
            if (e.summary && !e.summary.toLowerCase().includes('birthday')) {
              ctx.gcal.push(e.summary)
            }
          }
        }
      } catch { /* ignore */ }
    })(),

    // Work tasks marked done in today_tasks singleton
    (async () => {
      try {
        const { data } = await admin.from('today_tasks').select('data').eq('id', 'singleton').single()
        const rows = (data as { data?: unknown[] } | null)?.data ?? []
        ctx.workTasks = (rows as { status?: string; title?: string }[])
          .filter(t => t.status === 'done' && t.title)
          .map(t => t.title!)
          .slice(0, 8)
      } catch { /* ignore */ }
    })(),

    // Cycles completed today (work + personal) — from cycle_completions
    (async () => {
      try {
        const { from, to } = hkBracket(date)
        const { data } = await admin.from('cycle_completions')
          .select('title, area, mode, sub_area, recurring')
          .gte('completed_at', from)
          .lt('completed_at', to)
          .order('completed_at', { ascending: true })
        ctx.completedToday = (data ?? []) as CompletionRow[]
      } catch { /* ignore */ }
    })(),

    // Weekly completion summary — last 7 days grouped by area
    (async () => {
      try {
        const weekStart = addDaysToDate(date, -6) // 7-day window ending today
        const { from: wFrom } = hkBracket(weekStart)
        const { to: wTo }     = hkBracket(date)
        const { data } = await admin.from('cycle_completions')
          .select('title, area, mode')
          .gte('completed_at', wFrom)
          .lt('completed_at', wTo)
        const rows = (data ?? []) as { title: string; area: string; mode: string }[]
        // Group by area — combine mode into label for personal areas
        const map = new Map<string, { count: number; titles: string[] }>()
        for (const r of rows) {
          const label = AREA_LABELS[r.area] ?? r.area
          const entry = map.get(label) ?? { count: 0, titles: [] }
          entry.count++
          if (entry.titles.length < 3) entry.titles.push(r.title)
          map.set(label, entry)
        }
        ctx.weeklyByArea = [...map.entries()]
          .map(([label, v]) => ({ label, count: v.count, titles: v.titles }))
          .sort((a, b) => b.count - a.count)
      } catch { /* ignore */ }
    })(),

    // Past diary entries for continuity (last 6 before today)
    (async () => {
      try {
        const { data } = await admin.from('diary_entries')
          .select('id, mood, prompts, body')
          .lt('id', date)
          .order('id', { ascending: false })
          .limit(6)
        for (const row of (data ?? []) as { id: string; mood: string; prompts: { question: string; answer: string }[]; body: string }[]) {
          const firstAnswer = row.prompts?.find(p => p.answer?.trim())?.answer ?? ''
          const text = (firstAnswer || row.body || '').trim().replace(/\s+/g, ' ')
          if (text) ctx.pastDiary.push({ id: row.id, snippet: text.slice(0, 220) })
        }
      } catch { /* ignore */ }
    })(),

    // Nightly snapshot — longitudinal patterns across completions, ideas, diary themes
    (async () => {
      try {
        const { data } = await admin.from('user_context').select('*').eq('id', 'singleton').single()
        if (!data) return
        const parts: string[] = []
        if (data.completions_summary) parts.push(`Completions (30d): ${data.completions_summary}`)
        if (data.velocity_summary) parts.push(`Momentum: ${data.velocity_summary}`)
        if (data.ideas_summary) parts.push(`Active ideas: ${data.ideas_summary}`)
        if (data.shelved_patterns && data.shelved_patterns !== 'No shelved ideas') parts.push(data.shelved_patterns)
        if (data.mood_trends && data.mood_trends !== 'No mood data yet') parts.push(`Mood (30d): ${data.mood_trends}`)
        if (data.diary_themes && data.diary_themes !== 'No diary history yet') parts.push(`Diary patterns: ${data.diary_themes}`)
        if (data.calendar_patterns && data.calendar_patterns !== 'No calendar data') parts.push(`Calendar: ${data.calendar_patterns}`)
        if (parts.length) ctx.userContext = parts.join('. ')
      } catch { /* ignore */ }
    })(),
  ])

  return ctx
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const seed = parseInt(searchParams.get('seed') ?? '0', 10) || 0

  // Rotating base question — advances by day AND by refresh seed so "New questions" always differs
  const [y, m, d] = date.split('-').map(Number)
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000)
  const baseQuestion = BASE_QUESTIONS[(dayOfYear + seed) % BASE_QUESTIONS.length]

  const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-HK', { weekday: 'long' })

  // Read personality notes (source 4)
  let personality = ''
  try {
    personality = fs.readFileSync(path.join(process.cwd(), 'personal', 'personality.md'), 'utf8')
    if (personality.length > 2000) personality = personality.slice(0, 2000) + '\n...'
  } catch { /* continue without */ }

  // Fetch all context sources
  const ctx = await fetchDayContext(date)

  // Group today's completions by mode
  const workDone    = ctx.completedToday.filter(c => c.mode === 'work')
  const personalDone = ctx.completedToday.filter(c => c.mode === 'personal')

  const fmtCycles = (rows: CompletionRow[]) =>
    rows.map(c => c.sub_area ? `${c.title} (${c.sub_area})` : c.title).join('; ')

  // Source 1: tasks completed today
  const taskSection = [
    ctx.workTasks.length   ? `Work tasks done: ${ctx.workTasks.join('; ')}` : '',
    workDone.length        ? `Work cycles done: ${fmtCycles(workDone)}`     : '',
    personalDone.length    ? `Personal done: ${fmtCycles(personalDone)}`    : '',
  ].filter(Boolean).join('\n')

  // Weekly summary — shown to Gemini for richer context
  const weeklySection = ctx.weeklyByArea.length
    ? `This week (7 days) completions by area:\n${ctx.weeklyByArea.map(a => `  ${a.label}: ${a.count} (${a.titles.join(', ')})`).join('\n')}`
    : ''

  // Source 2: calendar events today
  const calSection = ctx.gcal.length ? `Calendar events: ${ctx.gcal.join('; ')}` : ''

  // Source 3: recent diary entries
  const diarySection = ctx.pastDiary.length
    ? `Recent diary entries (most recent first):\n${ctx.pastDiary.map(e => `${e.id}: ${e.snippet}`).join('\n')}`
    : ''

  const todaySection = [taskSection, calSection].filter(Boolean).join('\n')

  const prompt = `You are a warm, encouraging diary assistant for Brenda.

${personality ? `About Brenda:\n${personality}\n` : ''}${ctx.userContext ? `\nLongitudinal patterns (past weeks):\n${ctx.userContext}\n` : ''}${diarySection ? `\n${diarySection}\n` : ''}${weeklySection ? `\n${weeklySection}\n` : ''}${todaySection ? `\nWhat Brenda did on ${date} (${dayName}):\n${todaySection}\n` : ''}
Generate exactly 3 short diary prompt questions for tonight's entry (${dayName}, ${date}).${seed > 0 ? ` Refresh #${seed} — do NOT repeat any question already shown today.` : ''}

RULES:
- Question 1 MUST be this exact question: "${baseQuestion}"
- Question 2: pick the most specific, interesting thread from today's tasks or calendar events (e.g. "How did [concrete thing] go?"). If no tasks/events, use a follow-up on a recent diary theme.
- Question 3: draw from Brenda's personality — a personal dimension like health, relationships, Sidoi business, energy levels, something she's looking forward to, or a pattern from recent diary entries.
- CRITICAL: Never generate "Anything else on your mind?" or any other generic catch-all question. Every question must be specific and personal.
- Each question must be 1–2 sentences. Warm, conversational, never clinical.
- Return ONLY valid JSON, no extra text: {"prompts":["question 1","question 2","question 3"]}`

  const q2Fallback = BASE_QUESTIONS[(dayOfYear + seed + 1) % BASE_QUESTIONS.length]
  const q3Fallback = BASE_QUESTIONS[(dayOfYear + seed + 2) % BASE_QUESTIONS.length]

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json({ prompts: [baseQuestion, q2Fallback, q3Fallback] })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 400 },
        }),
      }
    )
    const json = await res.json()
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON in response')
    const parsed = JSON.parse(match[0])
    const prompts: string[] = Array.isArray(parsed.prompts) ? parsed.prompts.slice(0, 3) : []
    if (prompts.length < 3) throw new Error('not enough prompts')
    return NextResponse.json({ prompts })
  } catch {
    return NextResponse.json({ prompts: [baseQuestion, q2Fallback, q3Fallback] })
  }
}
