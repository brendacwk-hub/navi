import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function checkAuth(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${process.env.NAVI_API_KEY}`
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('inbox_items').select('*').order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, area = 'finance', effort = 'medium', must = false, urgent = false, dueText = '' } = body

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const item = {
    id: `i-${Date.now()}`,
    title: title.trim(),
    area, effort, must, urgent,
    due_text: dueText,
    source: 'api',
    captured_at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }

  const { data, error } = await supabase.from('inbox_items').insert(item).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
