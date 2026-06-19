'use client'

import { useState, useRef } from 'react'
import { Header } from './Header'
import { PersonalSidebar } from './PersonalSidebar'
import { PersonalQuickAddButton } from './PersonalQuickAddButton'

export function PersonalShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openSidebar  = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setSidebarOpen(true) }
  const scheduledClose = () => { closeTimer.current = setTimeout(() => setSidebarOpen(false), 180) }
  const cancelClose  = () => { if (closeTimer.current) clearTimeout(closeTimer.current) }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0e1628' }}>
      <Header onMenuClick={() => setSidebarOpen(o => !o)} onMenuHover={openSidebar} />

      <div className="flex-1 relative overflow-hidden">
        {sidebarOpen && (
          <div className="absolute inset-0 z-30 bg-black/60" onClick={() => setSidebarOpen(false)} />
        )}

        <div
          className={`absolute top-0 left-0 bottom-0 z-40 w-[220px] transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduledClose}
        >
          <PersonalSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <main className="h-full overflow-hidden flex relative">
          <div className="flex-1 overflow-hidden flex">
            {children}
          </div>
          <PersonalQuickAddButton />
        </main>
      </div>
    </div>
  )
}
