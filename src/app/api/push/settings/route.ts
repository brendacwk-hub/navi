import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET — return the diary reminder hour for this browser's subscription
export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ diaryReminderHour: 21 })

  const { data } = await supabase
    .from('push_subscriptions')
    .select('diary_reminder_hour')
    .eq('id', endpoint)
    .single()

  return NextResponse.json({ diaryReminderHour: data?.diary_reminder_hour ?? 21 })
}

// PATCH — update the diary reminder hour for this browser's subscription
export async function PATCH(req: NextRequest) {
  const { endpoint, diaryReminderHour } = await req.json()
  if (!endpoint || typeof diaryReminderHour !== 'number') {
    return NextResponse.json({ error: 'Missing endpoint or diaryReminderHour' }, { status: 400 })
  }
  await supabase
    .from('push_subscriptions')
    .update({ diary_reminder_hour: diaryReminderHour })
    .eq('id', endpoint)

  return NextResponse.json({ ok: true })
}
