import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isTriggerDueToday } from '@/shared/lib/sort-utils'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function checkAuth(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${process.env.NAVI_API_KEY}`
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mode = req.nextUrl.searchParams.get('mode') ?? 'work'
  const today = todayKey()

  if (mode === 'work') {
    const [todayTasksRes, cyclesRes] = await Promise.all([
      admin.from('today_tasks').select('data').eq('id', 'singleton').single(),
      admin.from('cycles').select('id,title,area,trigger_label,status,next_due_at,items,must,urgent,effort').neq('status', 'complete'),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawTasks: any[] = (todayTasksRes.data as { data: unknown[] } | null)?.data ?? []

    const allCycles = (cyclesRes.data ?? []) as Array<{
      id: string; title: string; area: string; trigger_label: string | null;
      status: string; next_due_at: string | null; items: Array<{ status: string }> | null;
      must: boolean; urgent: boolean; effort: string
    }>

    const todayDate = new Date(today + 'T00:00:00')

    // Cycles due today — use same logic as TodayView
    const dueSoon = allCycles
      .filter(c => {
        if (c.next_due_at) return false  // recurring, completed for this period
        return isTriggerDueToday(c.trigger_label ?? undefined, todayDate)
      })
      .map(c => {
        const items = c.items ?? []
        const total = items.length
        const done = items.filter(i => i.status === 'done').length
        return {
          id: c.id,
          title: c.title,
          area: c.area,
          due: c.trigger_label,
          must: c.must,
          urgent: c.urgent,
          effort: c.effort,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
          total,
          done,
        }
      })
      .sort((a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0) || (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))

    return NextResponse.json({
      mode: 'work',
      date: today,
      tasks: rawTasks,
      cycles: dueSoon,
    })
  }

  // Personal mode — habits
  const [habitDefRes, habitLogRes] = await Promise.all([
    admin.from('habit_definitions').select('habits').eq('id', 'singleton').single(),
    admin.from('habit_logs').select('logs').eq('id', today).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const habits: any[] = (habitDefRes.data as { habits: unknown[] } | null)?.habits ?? []
  const logs: Record<string, number> = (habitLogRes.data as { logs: unknown } | null)?.logs as Record<string, number> ?? {}

  const habitStatus = habits
    .sort((a, b) => a.order - b.order)
    .map(h => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      goal: h.goal,
      done: logs[h.id] ?? 0,
      complete: (logs[h.id] ?? 0) >= h.goal,
    }))

  return NextResponse.json({
    mode: 'personal',
    date: today,
    habits: habitStatus,
  })
}
