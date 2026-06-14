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

  const area = req.nextUrl.searchParams.get('area')
  let query = supabase.from('cycles').select('*').order('created_at', { ascending: false })
  if (area) query = query.eq('area', area)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cycles: data })
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { area, title, effort = 'medium', must = false, urgent = false, items } = body

  if (!area || !title) {
    return NextResponse.json({ error: 'area and title are required' }, { status: 400 })
  }

  const cycle = {
    id: `cycle-${Date.now()}`,
    area, title, effort, must, urgent,
    trigger_label: null, status: 'active',
    items: items ?? [{ id: `task-${Date.now()}`, label: title, status: 'todo', effort, must, urgent }],
    phases: null,
  }

  const { data, error } = await supabase.from('cycles').insert(cycle).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cycle: data }, { status: 201 })
}
