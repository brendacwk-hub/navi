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
    .select('font_scale')
    .eq('id', 'singleton')
    .single()
  return NextResponse.json({ font_scale: data?.font_scale ?? 'small' })
}

export async function POST(req: NextRequest) {
  const { font_scale } = await req.json()
  if (!['small', 'medium', 'large'].includes(font_scale)) {
    return NextResponse.json({ error: 'Invalid font_scale' }, { status: 400 })
  }
  await supabase.from('user_preferences').upsert({ id: 'singleton', font_scale })
  return NextResponse.json({ ok: true })
}
