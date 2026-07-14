import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webPush from 'web-push'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST() {
  try {
    webPush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )
  } catch {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  const { data: subs, error } = await supabase.from('push_subscriptions').select('subscription')
  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  if (!subs?.length) return NextResponse.json({ error: 'No subscriptions found — enable notifications first' }, { status: 404 })

  const payload = JSON.stringify({
    title: '✅ Navi test',
    body: 'Push notifications are working!',
    url: '/work/settings',
    tag: 'push-test',
  })

  const results = await Promise.allSettled(
    subs.map(row => webPush.sendNotification(row.subscription, payload))
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  if (sent === 0) {
    const firstErr = (results[0] as PromiseRejectedResult).reason
    return NextResponse.json({ error: `Send failed: ${firstErr?.message ?? firstErr}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent, failed })
}
