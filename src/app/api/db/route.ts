import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Service role key bypasses RLS — server-side only, never exposed to client
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-api-key') === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

// GET /api/db?table=cycles
// GET /api/db?table=today_tasks&eqCol=id&eqVal=singleton
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const table  = searchParams.get('table')
  const eqCol  = searchParams.get('eqCol')
  const eqVal  = searchParams.get('eqVal')

  if (!table) return NextResponse.json({ error: 'table required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin.from(table).select('*')
  if (eqCol && eqVal) query = query.eq(eqCol, eqVal)

  const { data, error } = await query
  if (error) {
    console.error(`[db] select ${table}:`, error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/db  { table, operation, data?, matchId? }
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as {
    table: string
    operation: 'upsert' | 'insert' | 'delete'
    data?: unknown
    matchId?: string
  }
  const { table, operation, data, matchId } = body

  let result: { error: { message: string } | null }

  if (operation === 'upsert') {
    result = await admin.from(table).upsert(data as object)
  } else if (operation === 'insert') {
    result = await admin.from(table).insert(data as object)
  } else if (operation === 'delete' && matchId) {
    result = await admin.from(table).delete().eq('id', matchId)
  } else {
    return NextResponse.json({ error: 'invalid operation' }, { status: 400 })
  }

  if (result.error) {
    console.error(`[db] ${operation} ${table}:`, result.error.message)
    return NextResponse.json({ error: result.error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
