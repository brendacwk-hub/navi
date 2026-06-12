import { Sidebar } from '@/shared/components/Sidebar'
import { Header } from '@/shared/components/Header'
import { QuickAddButton } from '@/shared/components/QuickAddButton'
import { SearchProvider } from '@/shared/lib/search-context'
import { WorkDataProvider } from '@/shared/lib/work-data-context'
import { InboxProvider } from '@/shared/lib/inbox-context'

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkDataProvider>
      <InboxProvider>
        <SearchProvider>
          <div className="flex h-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-hidden flex relative">
                {children}
                <QuickAddButton />
              </main>
            </div>
          </div>
        </SearchProvider>
      </InboxProvider>
    </WorkDataProvider>
  )
}
