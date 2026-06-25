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

interface DayContext {
  gcal: string[]
  workTasks: string[]
  workCycles: string[]
  personalCycles: string[]
  pastDiary: { id: string; snippet: string }[]
}

async function fetchDayContext(date: string): Promise<DayContext> {
  const ctx: DayContext = { gcal: [], workTasks: [], workCycles: [], personalCycles: [], pastDiary: [] }

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

    // Work cycles completed on this date
    (async () => {
      try {
        const { data } = await admin.from('cycles')
          .select('title, updated_at')
          .eq('mode', 'work')
          .eq('status', 'complete')
        ctx.workCycles = ((data ?? []) as { title: string; updated_at?: string }[])
          .filter(c => c.updated_at?.startsWith(date))
          .map(c => c.title)
          .slice(0, 5)
      } catch { /* ignore */ }
    })(),

    // Personal cycles completed on this date
    (async () => {
      try {
        const { data } = await admin.from('cycles')
          .select('title, updated_at')
          .eq('mode', 'personal')
          .eq('status', 'complete')
        ctx.personalCycles = ((data ?? []) as { title: string; updated_at?: string }[])
          .filter(c => c.updated_at?.startsWith(date))
          .map(c => c.title)
          .slice(0, 5)
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
  const allWork = [...ctx.workTasks, ...ctx.workCycles]

  // Source 1: tasks completed today
  const taskSection = [
    allWork.length           ? `Work tasks/projects done: ${allWork.join('; ')}`              : '',
    ctx.personalCycles.length ? `Personal tasks done: ${ctx.personalCycles.join('; ')}`       : '',
  ].filter(Boolean).join('\n')

  // Source 2: calendar events today
  const calSection = ctx.gcal.length ? `Calendar events: ${ctx.gcal.join('; ')}` : ''

  // Source 3: recent diary entries
  const diarySection = ctx.pastDiary.length
    ? `Recent diary entries (most recent first):\n${ctx.pastDiary.map(e => `${e.id}: ${e.snippet}`).join('\n')}`
    : ''

  const todaySection = [taskSection, calSection].filter(Boolean).join('\n')

  const prompt = `You are a warm, encouraging diary assistant for Brenda.

${personality ? `About Brenda:\n${personality}\n` : ''}${diarySection ? `\n${diarySection}\n` : ''}${todaySection ? `\nWhat Brenda did on ${date} (${dayName}):\n${todaySection}\n` : ''}
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
