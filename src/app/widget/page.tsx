import { createClient } from '@supabase/supabase-js'
import { isTriggerDueToday } from '@/shared/lib/sort-utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Navi Widget' }

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function todayKey() {
  // Vercel runs UTC; offset to HKT (UTC+8)
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function formatDate() {
  return new Date().toLocaleDateString('en-HK', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterDueTodayCycles(cycles: any[], today: Date) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cycles.filter((c: any) => {
    if (c.next_due_at) return false
    return isTriggerDueToday(c.trigger_label ?? undefined, today)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).sort((a: any, b: any) => (b.must ? 1 : 0) - (a.must ? 1 : 0) || (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
}

// ── Sub-components (all server-rendered) ───────────────────────────────────────


function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: '12px 0 6px' }}>
      {children}
    </p>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CycleRow({ cycle, accent }: { cycle: any; accent: string }) {
  const items = cycle.items ?? []
  const total = items.length
  const done  = items.filter((i: { status: string }) => i.status === 'done').length
  return (
    <div style={{
      padding: '7px 10px', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {(cycle.must || cycle.urgent) && (
          <span style={{ fontSize: 8, color: cycle.must ? '#f87171' : '#fbbf24' }}>
            {cycle.must ? '●' : '◐'}
          </span>
        )}
        <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cycle.title}
        </span>
        {total > 0 && (
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            {done}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div style={{ marginTop: 4, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, background: accent }} />
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TaskRow({ task }: { task: any }) {
  return (
    <div style={{
      padding: '7px 10px', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {(task.must || task.urgent) && (
        <span style={{ fontSize: 8, color: task.must ? '#f87171' : '#fbbf24' }}>
          {task.must ? '●' : '◐'}
        </span>
      )}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function WidgetPage() {
  const today    = todayKey()
  const todayDate = new Date(`${today}T00:00:00`)

  const [
    personalHabitDefRow,
    personalHabitLogRow,
    workHabitDefRow,
    workHabitLogRow,
    personalCyclesRes,
    workCyclesRes,
    workTasksRes,
  ] = await Promise.all([
    admin.from('habit_definitions').select('habits').eq('id', 'personal-singleton').single(),
    admin.from('habit_logs').select('logs').eq('id', `personal-${today}`).single(),
    admin.from('habit_definitions').select('habits').eq('id', 'work-singleton').single(),
    admin.from('habit_logs').select('logs').eq('id', `work-${today}`).single(),
    admin.from('cycles')
      .select('id,title,area,trigger_label,status,next_due_at,items,must,urgent')
      .eq('mode', 'personal').neq('status', 'complete'),
    admin.from('cycles')
      .select('id,title,area,trigger_label,status,next_due_at,items,must,urgent')
      .eq('mode', 'work').neq('status', 'complete'),
    admin.from('today_tasks').select('data').eq('id', 'singleton').single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personalHabits: any[] = (personalHabitDefRow.data as { habits: unknown[] } | null)?.habits ?? []
  const personalLogs: Record<string, number> = (personalHabitLogRow.data as { logs: unknown } | null)?.logs as Record<string, number> ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workHabits: any[] = (workHabitDefRow.data as { habits: unknown[] } | null)?.habits ?? []
  const workLogs: Record<string, number> = (workHabitLogRow.data as { logs: unknown } | null)?.logs as Record<string, number> ?? {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personalDueTodayCycles = filterDueTodayCycles((personalCyclesRes.data ?? []) as any[], todayDate)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workDueTodayCycles     = filterDueTodayCycles((workCyclesRes.data ?? []) as any[], todayDate)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workTasks: any[] = (((workTasksRes.data as { data: unknown[] } | null)?.data ?? []) as any[])
    .filter((t: { status?: string }) => t.status !== 'done')

  const PINK = '#f0a8c8'
  const BLUE = '#3b82f6'

  const personalHabitsSorted = [...personalHabits].sort((a, b) => a.order - b.order)
  const workHabitsSorted     = [...workHabits].sort((a, b) => a.order - b.order)

  const hasPersonalContent = personalHabitsSorted.length > 0 || personalDueTodayCycles.length > 0
  const hasWorkContent     = workHabitsSorted.length > 0 || workTasks.length > 0 || workDueTodayCycles.length > 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100svh', overflow: 'hidden',
      background: '#0c0c0c', color: 'white',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#111',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>Navi</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{formatDate()}</span>
      </div>

      {/* Columns */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Personal */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '10px 10px 20px',
          background: '#0e1628',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: 11, flexShrink: 0 }}>🏠</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: PINK, flexShrink: 0 }}>Home</span>
            <div style={{ display: 'flex', gap: 3, marginLeft: 2, flexShrink: 0 }}>
              {personalHabitsSorted.slice(0, 3).map(h => {
                const complete = (personalLogs[h.id] ?? 0) >= h.goal
                return <span key={h.id} style={{ fontSize: 11, opacity: complete ? 1 : 0.35 }}>{h.emoji}</span>
              })}
            </div>
          </div>

          {!hasPersonalContent && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 24 }}>Nothing today 🌿</p>
          )}

          {personalDueTodayCycles.length > 0 && (
            <>
              <SectionTitle>Due Today</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {personalDueTodayCycles.slice(0, 4).map((c: { id: string }) => (
                  <CycleRow key={c.id} cycle={c} accent={PINK} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Work */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: 11, flexShrink: 0 }}>💼</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>Work</span>
            <div style={{ display: 'flex', gap: 3, marginLeft: 2, flexShrink: 0 }}>
              {workHabitsSorted.slice(0, 3).map(h => {
                const complete = (workLogs[h.id] ?? 0) >= h.goal
                return <span key={h.id} style={{ fontSize: 11, opacity: complete ? 1 : 0.35 }}>{h.emoji}</span>
              })}
            </div>
          </div>

          {!hasWorkContent && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 24 }}>Nothing today ✓</p>
          )}

          {(workTasks.length > 0 || workDueTodayCycles.length > 0) && (() => {
            const cappedTasks  = workTasks.slice(0, 4)
            const cappedCycles = workDueTodayCycles.slice(0, Math.max(0, 4 - cappedTasks.length))
            return (
              <>
                <SectionTitle>Due Today</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {cappedTasks.map((t: { id: string }) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                  {cappedCycles.map((c: { id: string }) => (
                    <CycleRow key={c.id} cycle={c} accent={BLUE} />
                  ))}
                </div>
              </>
            )
          })()}
        </div>

      </div>
    </div>
  )
}
