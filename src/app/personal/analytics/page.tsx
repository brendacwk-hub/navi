import { createClient } from '@supabase/supabase-js'
import { AnalyticsView } from '@/features/analytics/AnalyticsView'
import type { AnalyticsData, CompletedCycle, OpenCycle, HabitDef, TaskCompletion } from '@/features/analytics/AnalyticsView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics — Navi' }

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export default async function PersonalAnalyticsPage() {
  const [completedCyclesRes, personalCompletedRes, openCyclesRes, workHabitDefs, personalHabitDefs, habitLogsRes, diaryRes, taskCompletionsRes] = await Promise.all([
    admin.from('cycles')
      .select('id,title,area,mode,trigger_label,created_at,last_completed_at,effort,must,urgent,items')
      .eq('status', 'complete')
      .not('last_completed_at', 'is', null),
    admin.from('completed_tasks')
      .select('id,title,area,effort,completed_at'),
    admin.from('cycles')
      .select('id,title,area,mode,trigger_label,created_at,effort,must,urgent')
      .neq('status', 'complete'),
    admin.from('habit_definitions').select('habits').eq('id', 'work-singleton').single(),
    admin.from('habit_definitions').select('habits').eq('id', 'personal-singleton').single(),
    admin.from('habit_logs').select('id,logs'),
    admin.from('diary_entries').select('id,mood').order('id', { ascending: false }).limit(400),
    admin.from('task_completions')
      .select('title,area,effort,must,urgent,mode,completed_at')
      .order('completed_at', { ascending: false }),
  ])

  type CycleRow = {
    id: string; title: string; area: string; mode: string
    trigger_label: string | null; created_at: string; last_completed_at: string
    effort: string; must: boolean; urgent: boolean
    items: { status: string }[] | null
  }

  type PersonalCompRow = { id: string; title: string; area: string; effort: string; completed_at: string }
  const personalCompleted: CompletedCycle[] = ((personalCompletedRes.data ?? []) as PersonalCompRow[]).map(r => ({
    id: r.id, title: r.title, area: r.area, mode: 'personal' as const,
    triggerLabel: null, createdAt: r.completed_at, lastCompletedAt: r.completed_at,
    effort: (r.effort as 'quick' | 'medium' | 'heavy') ?? 'quick',
    must: false, urgent: false, items: null,
  }))

  const cycles: CompletedCycle[] = [
    ...((completedCyclesRes.data ?? []) as CycleRow[]).map(r => ({
      id: r.id, title: r.title, area: r.area,
      mode: (r.mode as 'work' | 'personal') ?? 'work',
      triggerLabel: r.trigger_label,
      createdAt: r.created_at, lastCompletedAt: r.last_completed_at,
      effort: (r.effort as 'quick' | 'medium' | 'heavy') ?? 'quick',
      must: r.must ?? false, urgent: r.urgent ?? false,
      items: r.items ?? null,
    })),
    ...personalCompleted,
  ]

  type OpenCycleRow = {
    id: string; title: string; area: string; mode: string
    trigger_label: string | null; created_at: string
    effort: string; must: boolean; urgent: boolean
  }

  const openCycles: OpenCycle[] = ((openCyclesRes.data ?? []) as OpenCycleRow[]).map(r => ({
    id: r.id, title: r.title, area: r.area,
    mode: (r.mode as 'work' | 'personal') ?? 'work',
    triggerLabel: r.trigger_label,
    createdAt: r.created_at,
    effort: (r.effort as 'quick' | 'medium' | 'heavy') ?? 'quick',
    must: r.must ?? false, urgent: r.urgent ?? false,
  }))

  type HabitRow = { id: string; name: string; emoji: string; goal: number; frequency?: unknown }
  const workHabits: HabitDef[] = ((workHabitDefs.data as { habits: HabitRow[] } | null)?.habits ?? [])
    .map(h => ({ id: h.id, name: h.name, emoji: h.emoji, goal: h.goal, mode: 'work' as const, frequency: h.frequency as HabitDef['frequency'] }))
  const personalHabits: HabitDef[] = ((personalHabitDefs.data as { habits: HabitRow[] } | null)?.habits ?? [])
    .map(h => ({ id: h.id, name: h.name, emoji: h.emoji, goal: h.goal, mode: 'personal' as const, frequency: h.frequency as HabitDef['frequency'] }))
  const habits = [...workHabits, ...personalHabits]

  type LogRow = { id: string; logs: Record<string, number> }
  const habitLogsByDate: Record<string, Record<string, number>> = {}
  ;((habitLogsRes.data ?? []) as LogRow[]).forEach(row => { habitLogsByDate[row.id] = row.logs ?? {} })

  type DiaryRow = { id: string; mood: string | null }
  const diaryEntries = ((diaryRes.data ?? []) as DiaryRow[])
    .filter(e => e.mood)
    .map(e => ({ date: e.id, mood: e.mood! }))

  type TaskCompRow = { title: string; area: string; effort: string; must: boolean; urgent: boolean; mode: string; completed_at: string }
  const taskCompletions: TaskCompletion[] = taskCompletionsRes.error
    ? []
    : ((taskCompletionsRes.data ?? []) as TaskCompRow[]).map(r => ({
        title: r.title, area: r.area,
        effort: (r.effort as 'quick' | 'medium' | 'heavy') ?? 'quick',
        must: r.must ?? false, urgent: r.urgent ?? false,
        mode: (r.mode as 'work' | 'personal') ?? 'work',
        completedAt: r.completed_at,
      }))

  const analyticsData: AnalyticsData = { cycles, openCycles, taskCompletions, habits, habitLogsByDate, diaryEntries }
  return <AnalyticsView data={analyticsData} />
}
