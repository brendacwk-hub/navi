import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EFFORT_WEIGHT: Record<string, number> = { quick: 1, medium: 2, heavy: 3 }

function hkToday(): string {
  const now = new Date()
  const hk = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return hk.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return ''
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
      }),
    }
  )
  const json = await res.json()
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function POST(req: Request) {
  if (req.headers.get('x-api-key') !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { itemType, item, parentCycle } = body

    const today = hkToday()
    const windowEnd = addDays(today, 14)

    const [loadRes, ctxRes] = await Promise.all([
      admin.from('cycles')
        .select('title, effort, triggerLabel')
        .gte('triggerLabel', today)
        .lte('triggerLabel', windowEnd),
      admin.from('user_context')
        .select('velocity_summary, completions_summary, diary_themes')
        .eq('id', 'singleton')
        .single(),
    ])

    // Compute daily effort-weighted load
    const dailyLoad: Record<string, { count: number; weight: number; titles: string[] }> = {}
    for (const c of (loadRes.data ?? []) as { title: string; effort?: string; triggerLabel: string }[]) {
      const d = c.triggerLabel
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
      if (!dailyLoad[d]) dailyLoad[d] = { count: 0, weight: 0, titles: [] }
      dailyLoad[d].count++
      dailyLoad[d].weight += EFFORT_WEIGHT[c.effort ?? ''] ?? 1
      if (dailyLoad[d].titles.length < 3) dailyLoad[d].titles.push(c.title)
    }

    const loadSummary = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
      .map(d => {
        const v = dailyLoad[d]
        if (!v) return `${fmtShort(d)} (${d}): free`
        return `${fmtShort(d)} (${d}): ${v.count} tasks, load=${v.weight}`
      })
      .join('\n')

    const ctx = ctxRes.data
    const snapshot = [
      ctx?.velocity_summary ? `Momentum: ${ctx.velocity_summary}` : '',
      ctx?.completions_summary ? `Completions (30d): ${ctx.completions_summary}` : '',
      ctx?.diary_themes ? `Patterns: ${ctx.diary_themes}` : '',
    ].filter(Boolean).join('\n')

    let itemDesc: string
    if (itemType === 'subtask') {
      itemDesc = `Sub-task: "${item.label}" (effort: ${item.effort ?? 'unset'}, current due: ${item.due})`
      if (parentCycle) {
        const siblingList = (parentCycle.items ?? [])
          .map((i: { label: string; status: string }) => `"${i.label}" [${i.status}]`)
          .join(', ')
        itemDesc += `\nParent cycle: "${parentCycle.title}" (effort: ${parentCycle.effort}, due: ${parentCycle.triggerLabel ?? 'none'})`
        if (siblingList) itemDesc += `\nSibling items: ${siblingList}`
      }
    } else {
      itemDesc = `Task/Cycle: "${item.title}" (effort: ${item.effort}, must: ${item.must ? 'yes' : 'no'}, current due: ${item.currentDue})`
    }

    const prompt = `You are Navi, a smart personal assistant for Brenda. Suggest a new deadline for an overdue item.

Today: ${today}

Overdue item:
${itemDesc}

Schedule for next 14 days:
${loadSummary}

${snapshot ? `Brenda's context:\n${snapshot}` : ''}

Rules:
- Pick the best date in range ${addDays(today, 1)} to ${addDays(today, 14)} (YYYY-MM-DD format)
- Prefer days with lower load or free days
- For must-do or heavy-effort items, don't push past 3 days unless schedule is very full
- For quick or optional items, pushing 4–7 days is fine when load is high
- If this is a subtask and postponing it risks the parent cycle deadline, include a short parentRisk warning
- Reason: 1 short specific sentence (e.g. "Thursday only has 2 tasks" not "your schedule looks lighter")
- Return ONLY valid JSON, no extra text: {"suggestedDate":"YYYY-MM-DD","reason":"...","parentRisk":"..."} — omit parentRisk key entirely if not applicable`

    const raw = await callGemini(prompt)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ suggestedDate: addDays(today, 1), reason: 'No capacity data — pushed to tomorrow.' })
    }

    const parsed = JSON.parse(match[0])
    return NextResponse.json({
      suggestedDate: parsed.suggestedDate ?? addDays(today, 1),
      reason: parsed.reason ?? '',
      ...(parsed.parentRisk ? { parentRisk: parsed.parentRisk } : {}),
    })
  } catch {
    const today = hkToday()
    return NextResponse.json({ suggestedDate: addDays(today, 1), reason: 'Pushed to tomorrow.' })
  }
}
