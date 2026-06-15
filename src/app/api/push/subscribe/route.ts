import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json()
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const endpoint = subscription.endpoint as string
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ id: endpoint, subscription }, { onConflict: 'id' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/subscribe]', e)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    await supabase.from('push_subscriptions').delete().eq('id', endpoint)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/unsubscribe]', e)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
