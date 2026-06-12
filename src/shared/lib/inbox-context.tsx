'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { mockInboxItems } from '@/features/work/inbox/data'
import type { InboxItem, InboxArea, InboxEffort } from '@/features/work/inbox/data'

export type { InboxItem }

interface InboxCtx {
  items: InboxItem[]
  unreadCount: number
  addItem: (title: string) => void
  approveItem: (id: string) => void
  dismissItem: (id: string) => void
  updateItem: (id: string, patch: Partial<Pick<InboxItem, 'title' | 'area' | 'effort' | 'must' | 'urgent' | 'dueText'>>) => void
}

const InboxContext = createContext<InboxCtx | null>(null)

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>(mockInboxItems)

  const addItem = useCallback((title: string) => {
    const newItem: InboxItem = {
      id: `i-${Date.now()}`,
      title: title.trim(),
      area: 'finance',
      effort: 'medium',
      must: false,
      urgent: false,
      dueText: '',
      source: 'manual',
      capturedAt: 'Just now',
    }
    setItems(prev => [newItem, ...prev])
  }, [])

  const approveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const dismissItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<Pick<InboxItem, 'title' | 'area' | 'effort' | 'must' | 'urgent' | 'dueText'>>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }, [])

  return (
    <InboxContext.Provider value={{
      items,
      unreadCount: items.length,
      addItem,
      approveItem,
      dismissItem,
      updateItem,
    }}>
      {children}
    </InboxContext.Provider>
  )
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be inside InboxProvider')
  return ctx
}
