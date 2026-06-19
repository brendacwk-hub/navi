import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webPush from 'web-push'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function initWebPush() {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

async function sendToAll(title: string, body: string, url: string, tag: string) {
  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs?.length) return 0
  const payload = JSON.stringify({ title, body, url, tag })
  const results = await Promise.allSettled(subs.map(r => webPush.sendNotification(r.subscription, payload)))
  return results.filter(r => r.status === 'fulfilled').length
}

export async function GET(req: NextRequest) {
  initWebPush()
  const apiKey = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('apiKey')
  if (apiKey !== process.env.NAVI_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Fetch habit definitions
  const { data: defRows } = await supabase.from('habit_definitions').select('habits').eq('id', 'work-singleton')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const habits: any[] = defRows?.[0]?.habits ?? []

  // Fire notifications for habits whose reminderTime matches now (within ±5 min)
  const fired: string[] = []
  for (const h of habits) {
    if (!h.reminderTime) continue
    const [rh, rm] = h.reminderTime.split(':').map(Number)
    const [nh, nm] = hhmm.split(':').map(Number)
    const diffMin = Math.abs(rh * 60 + rm - (nh * 60 + nm))
    if (diffMin <= 5) {
      await sendToAll(
        `${h.emoji} ${h.name} reminder`,
        `Time to log your ${h.name.toLowerCase()} (goal: ${h.goal}×)`,
        '/work/habits',
        `habit-${h.id}`,
      )
      fired.push(h.name)
    }
  }

  // Morning summary at 09:00
  const [nh, nm] = hhmm.split(':').map(Number)
  if (nh === 9 && nm <= 5) {
    await sendToAll(
      '☀️ Good morning',
      'Your Navi daily summary is ready. Tap to see what\'s due today.',
      '/work',
      'daily-summary',
    )
  }

  // Diary reminder at 21:00 on Sundays — only if today's entry is empty
  const hktDay = new Date(now.getTime() + 8 * 60 * 60 * 1000).getUTCDay() // 0 = Sunday
  if (nh === 21 && nm <= 5 && hktDay === 0) {
    const todayKey = now.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
    const { data: entry } = await supabase
      .from('diary_entries')
      .select('id, mood, body, prompts')
      .eq('id', todayKey)
      .single()

    const hasContent = entry && (
      entry.mood ||
      entry.body?.trim() ||
      (Array.isArray(entry.prompts) && entry.prompts.some((p: { answer?: string }) => p.answer?.trim()))
    )

    if (!hasContent) {
      await sendToAll(
        '📓 Diary',
        'How was your day? A few lines before the day closes.',
        '/personal/diary',
        'diary-reminder',
      )
      fired.push('diary')
    }
  }

  return NextResponse.json({ ok: true, fired })
}
