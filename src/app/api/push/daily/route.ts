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

interface SubRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription: any
  diary_reminder_hour: number | null
}

async function fetchSubs(): Promise<SubRow[]> {
  const { data, error } = await supabase.from('push_subscriptions').select('subscription, diary_reminder_hour')
  if (error) {
    // diary_reminder_hour column may not exist yet — fall back to subscription only
    const { data: fallback } = await supabase.from('push_subscriptions').select('subscription')
    return (fallback ?? []).map(r => ({ subscription: r.subscription, diary_reminder_hour: null }))
  }
  return (data ?? []) as SubRow[]
}

async function sendToAll(title: string, body: string, url: string, tag: string) {
  const subs = await fetchSubs()
  if (!subs.length) return 0
  const payload = JSON.stringify({ title, body, url, tag })
  const results = await Promise.allSettled(subs.map(r => webPush.sendNotification(r.subscription, payload)))
  return results.filter(r => r.status === 'fulfilled').length
}

export async function GET(req: NextRequest) {
  initWebPush()
  // Accept either: NAVI_API_KEY (x-api-key header or query param) for manual calls,
  // OR Vercel cron's automatic Authorization: Bearer CRON_SECRET
  const apiKey = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('apiKey')
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const validCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const validApiKey = apiKey && apiKey === process.env.NAVI_API_KEY
  if (!validCron && !validApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // All time checks use HKT (UTC+8) — Vercel serverless runs in UTC
  const hktNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const nh = hktNow.getUTCHours()
  const nm = hktNow.getUTCMinutes()
  const hktDay = hktNow.getUTCDay() // 0 = Sunday

  // Fetch habit definitions
  const { data: defRows } = await supabase.from('habit_definitions').select('habits').eq('id', 'work-singleton')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const habits: any[] = defRows?.[0]?.habits ?? []

  // Fire notifications for habits whose reminderTime matches now (within ±5 min)
  const fired: string[] = []
  for (const h of habits) {
    if (!h.reminderTime) continue
    const [rh, rm] = h.reminderTime.split(':').map(Number)
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

  // Diary reminder — daily at each subscription's configured hour (default 21 = 9pm HKT)
  // Only sends if today's diary entry has no content yet
  const allSubs = await fetchSubs()
  for (const sub of allSubs) {
    const reminderHour = sub.diary_reminder_hour ?? 21
    if (nh === reminderHour && nm <= 5) {
      const todayKey = hktNow.toISOString().slice(0, 10)
      const { data: entry } = await supabase
        .from('diary_entries')
        .select('id, mood, body, prompts')
        .eq('id', todayKey)
        .single()
      const hasContent = entry && (
        (entry as { mood?: string }).mood ||
        (entry as { body?: string }).body?.trim() ||
        (Array.isArray((entry as { prompts?: unknown[] }).prompts) &&
          (entry as { prompts: { answer?: string }[] }).prompts.some(p => p.answer?.trim()))
      )
      if (!hasContent) {
        await webPush.sendNotification(
          sub.subscription,
          JSON.stringify({ title: '📓 Diary', body: 'How was your day? A few lines before the day closes.', url: '/personal/diary', tag: 'diary-reminder' }),
        )
        fired.push('diary')
      }
    }
  }

  return NextResponse.json({ ok: true, fired })
}
