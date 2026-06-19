import { ToastProvider } from '@/shared/lib/toast-context'
import { PersonalDataProvider } from '@/shared/lib/personal-data-context'
import { PreferencesProvider } from '@/shared/lib/preferences-context'
import { HabitProvider } from '@/shared/lib/habit-context'
import { PersonalShell } from '@/shared/components/PersonalShell'

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ToastProvider>
        <PersonalDataProvider>
          <HabitProvider>
            <PersonalShell>{children}</PersonalShell>
          </HabitProvider>
        </PersonalDataProvider>
      </ToastProvider>
    </PreferencesProvider>
  )
}
