import { SearchProvider } from '@/shared/lib/search-context'
import { WorkDataProvider } from '@/shared/lib/work-data-context'
import { InboxProvider } from '@/shared/lib/inbox-context'
import { ToastProvider } from '@/shared/lib/toast-context'
import { HabitProvider } from '@/shared/lib/habit-context'
import { WorkShell } from '@/shared/components/WorkShell'

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkDataProvider>
      <InboxProvider>
        <HabitProvider>
          <SearchProvider>
            <ToastProvider>
              <WorkShell>{children}</WorkShell>
            </ToastProvider>
          </SearchProvider>
        </HabitProvider>
      </InboxProvider>
    </WorkDataProvider>
  )
}
