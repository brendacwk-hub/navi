import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webPush from 'web-push'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.NAVI_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { title, body, url, tag } = await req.json()

    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (!subs?.length) return NextResponse.json({ sent: 0 })

    const payload = JSON.stringify({ title, body, url: url ?? '/', tag })
    const results = await Promise.allSettled(
      subs.map(row => webPush.sendNotification(row.subscription, payload))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    return NextResponse.json({ sent, failed })
  } catch (e) {
    console.error('[push/send]', e)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
