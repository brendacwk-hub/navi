import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Returns an ISO timestamp for the start of N days ago in HKT (UTC+8)
function hkDaysAgo(n: number): string {
  const hkOffset = 8 * 60 * 60 * 1000
  const hkNow = new Date(Date.now() + hkOffset)
  hkNow.setDate(hkNow.getDate() - n)
  hkNow.setHours(0, 0, 0, 0)
  return new Date(hkNow.getTime() - hkOffset).toISOString()
}

export async function GET(req: NextRequest) {
  // Accept NAVI_API_KEY for manual calls, or Vercel's CRON_SECRET for scheduled calls
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

  const [completionsResult, ideasResult, diaryResult] = await Promise.allSettled([
    admin
      .from('cycle_completions')
      .select('title, area')
      .gte('completed_at', since30d),
    admin
      .from('personal_ideas')
      .select('title, status')
      .neq('status', 'converted'),
    admin
      .from('diary_entries')
      .select('date, prompts, body')
      .order('date', { ascending: false })
      .limit(14),
  ])

  // --- Completions summary ---
  const completions =
    completionsResult.status === 'fulfilled' ? (completionsResult.value.data ?? []) : []
  const byArea: Record<string, { count: number; titles: string[] }> = {}
  for (const c of completions as { title: string; area: string }[]) {
    if (!byArea[c.area]) byArea[c.area] = { count: 0, titles: [] }
    byArea[c.area].count++
    if (byArea[c.area].titles.length < 4) byArea[c.area].titles.push(c.title)
  }
  const completionsSummary =
    Object.entries(byArea)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([area, v]) => `${v.count} ${area} (${v.titles.join(', ')})`)
      .join('; ') || 'No completions in last 30 days'

  // --- Ideas summary ---
  const ideas =
    ideasResult.status === 'fulfilled' ? (ideasResult.value.data ?? []) : []
  const byStatus: Record<string, string[]> = {}
  for (const idea of ideas as { title: string; status: string }[]) {
    if (!byStatus[idea.status]) byStatus[idea.status] = []
    byStatus[idea.status].push(idea.title)
  }
  const ready = byStatus['ready'] ?? []
  const developing = [...(byStatus['developing'] ?? []), ...(byStatus['exploring'] ?? [])]
  const newIdeas = byStatus['new'] ?? []
  const shelved = byStatus['shelved'] ?? []

  const ideasSummary =
    [
      ready.length ? `${ready.length} ready: ${ready.slice(0, 3).join(', ')}` : null,
      developing.length ? `${developing.length} developing: ${developing.slice(0, 3).join(', ')}` : null,
      newIdeas.length ? `${newIdeas.length} new` : null,
    ]
      .filter(Boolean)
      .join('. ') || 'No active ideas'

  const shelvedPatterns = shelved.length
    ? `Shelved: ${shelved.slice(0, 6).join(', ')}`
    : 'No shelved ideas'

  // --- Diary themes via Gemini ---
  let diaryThemes = 'No diary history yet'
  const diaryEntries =
    diaryResult.status === 'fulfilled'
      ? ((diaryResult.value.data ?? []) as Array<{
          date: string
          prompts: Array<{ question: string; answer: string }> | null
          body: string | null
        }>)
      : []

  if (diaryEntries.length > 0) {
    const diaryText = diaryEntries
      .map(e => {
        const answers = (e.prompts ?? [])
          .filter(p => p.answer?.trim())
          .map(p => p.answer)
          .join(' ')
        return `${e.date}: ${(answers || e.body || '').slice(0, 300)}`
      })
      .join('\n')

    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Analyse these diary entries and return ONLY {"themes":"..."} — a single string listing 3-5 specific recurring emotional or behavioural patterns you notice. Be concrete (e.g. "high energy around Sidoi, scattered mid-week, late nights"). Under 160 characters.\n\n${diaryText}`,
                    },
                  ],
                },
              ],
              generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
            }),
          }
        )
        const json = await res.json()
        const raw: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (parsed.themes) diaryThemes = parsed.themes
        }
      } catch { /* fall through to default */ }
    }
  }

  // --- Write snapshot ---
  await admin.from('user_context').upsert({
    id: 'singleton',
    built_at: new Date().toISOString(),
    completions_summary: completionsSummary,
    ideas_summary: ideasSummary,
    shelved_patterns: shelvedPatterns,
    diary_themes: diaryThemes,
  })

  return NextResponse.json({
    ok: true,
    built_at: new Date().toISOString(),
    completions_summary: completionsSummary,
    ideas_summary: ideasSummary,
    shelved_patterns: shelvedPatterns,
    diary_themes: diaryThemes,
  })
}
