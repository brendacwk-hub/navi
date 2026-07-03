import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  const { data } = await supabase
    .from('user_preferences')
    .select('font_scale, today_order')
    .eq('id', 'singleton')
    .single()
  return NextResponse.json({
    font_scale: data?.font_scale ?? 'small',
    today_order: data?.today_order ?? null,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const updates: Record<string, unknown> = { id: 'singleton' }

  if ('font_scale' in body) {
    if (!['small', 'medium', 'large'].includes(body.font_scale)) {
      return NextResponse.json({ error: 'Invalid font_scale' }, { status: 400 })
    }
    updates.font_scale = body.font_scale
  }

  if ('today_order' in body) {
    const ord = body.today_order
    if (!ord || typeof ord.date !== 'string' || !Array.isArray(ord.order)) {
      return NextResponse.json({ error: 'Invalid today_order' }, { status: 400 })
    }
    updates.today_order = ord
  }

  await supabase.from('user_preferences').upsert(updates)
  return NextResponse.json({ ok: true })
}
