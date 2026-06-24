import { createClient } from '@supabase/supabase-js'
import { AnalyticsView } from '@/features/analytics/AnalyticsView'
import type { AnalyticsData, CompletedCycle, HabitDef } from '@/features/analytics/AnalyticsView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics — Navi' }

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export default async function WorkAnalyticsPage() {
  const [cyclesRes, workHabitDefs, personalHabitDefs, habitLogsRes, diaryRes] = await Promise.all([
    admin.from('cycles')
      .select('id,title,area,mode,trigger_label,created_at,last_completed_at,effort')
      .eq('status', 'complete')
      .not('last_completed_at', 'is', null),
    admin.from('habit_definitions').select('habits').eq('id', 'work-singleton').single(),
    admin.from('habit_definitions').select('habits').eq('id', 'personal-singleton').single(),
    admin.from('habit_logs').select('id,logs'),
    admin.from('diary_entries').select('id,mood').order('id', { ascending: false }).limit(400),
  ])

  type CycleRow = {
    id: string; title: string; area: string; mode: string
    trigger_label: string | null; created_at: string; last_completed_at: string; effort: string
  }

  const cycles: CompletedCycle[] = ((cyclesRes.data ?? []) as CycleRow[]).map(r => ({
    id: r.id,
    title: r.title,
    area: r.area,
    mode: (r.mode as 'work' | 'personal') ?? 'work',
    triggerLabel: r.trigger_label,
    createdAt: r.created_at,
    lastCompletedAt: r.last_completed_at,
    effort: r.effort,
  }))

  type HabitRow = { id: string; name: string; emoji: string; goal: number }
  const workHabits: HabitDef[] = ((workHabitDefs.data as { habits: HabitRow[] } | null)?.habits ?? [])
    .map(h => ({ ...h, mode: 'work' as const }))
  const personalHabits: HabitDef[] = ((personalHabitDefs.data as { habits: HabitRow[] } | null)?.habits ?? [])
    .map(h => ({ ...h, mode: 'personal' as const }))
  const habits = [...workHabits, ...personalHabits]

  type LogRow = { id: string; logs: Record<string, number> }
  const habitLogsByDate: Record<string, Record<string, number>> = {}
  ;((habitLogsRes.data ?? []) as LogRow[]).forEach(row => {
    habitLogsByDate[row.id] = row.logs ?? {}
  })

  type DiaryRow = { id: string; mood: string | null }
  const diaryEntries = ((diaryRes.data ?? []) as DiaryRow[])
    .filter(e => e.mood)
    .map(e => ({ date: e.id, mood: e.mood! }))

  const analyticsData: AnalyticsData = { cycles, habits, habitLogsByDate, diaryEntries }

  return <AnalyticsView data={analyticsData} />
}
