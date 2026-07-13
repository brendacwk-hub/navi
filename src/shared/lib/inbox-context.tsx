'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { InboxItem } from '@/features/work/inbox/data'

export type { InboxItem }

type DbOp = { table: string; operation: 'upsert' | 'insert' | 'delete'; data?: unknown; matchId?: string }

function dbWrite(op: DbOp) {
  fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    body: JSON.stringify(op),
  }).catch(e => console.error('[dbWrite]', e))
}

async function dbRead(table: string): Promise<unknown[]> {
  try {
    const res = await fetch(`/api/db?table=${table}`, { headers: { 'x-api-key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } })
    const json = await res.json()
    return json.data ?? []
  } catch (e) {
    console.error('[dbRead]', e)
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): InboxItem {
  return {
    id: r.id, title: r.title, area: r.area, effort: r.effort,
    must: r.must, urgent: r.urgent,
    dueText: r.due_text, source: r.source, capturedAt: r.captured_at,
  }
}

function toRow(i: InboxItem) {
  return {
    id: i.id, title: i.title, area: i.area, effort: i.effort,
    must: i.must, urgent: i.urgent,
    due_text: i.dueText, source: i.source, captured_at: i.capturedAt,
  }
}

interface InboxCtx {
  items: InboxItem[]
  unreadCount: number
  addItem: (title: string, area?: InboxItem['area']) => void
  approveItem: (id: string) => void
  dismissItem: (id: string) => void
  updateItem: (id: string, patch: Partial<Pick<InboxItem, 'title' | 'area' | 'effort' | 'must' | 'urgent' | 'dueText' | 'notes'>>) => void
}

const InboxContext = createContext<InboxCtx | null>(null)

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([])

  useEffect(() => {
    async function init() {
      const rows = await dbRead('inbox_items')
      setItems(rows.map(r => fromRow(r)))
    }
    init()
  }, [])

  const addItem = useCallback((title: string, area: InboxItem['area'] = 'finance') => {
    const item: InboxItem = {
      id: `i-${Date.now()}`,
      title: title.trim(),
      area, effort: 'medium',
      must: false, urgent: false, dueText: '',
      source: 'manual',
      capturedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
    setItems(prev => [item, ...prev])
    dbWrite({ table: 'inbox_items', operation: 'insert', data: toRow(item) })
  }, [])

  const approveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    dbWrite({ table: 'inbox_items', operation: 'delete', matchId: id })
  }, [])

  const dismissItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    dbWrite({ table: 'inbox_items', operation: 'delete', matchId: id })
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<Pick<InboxItem, 'title' | 'area' | 'effort' | 'must' | 'urgent' | 'dueText' | 'notes'>>) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, ...patch } : i)
      const changed = next.find(i => i.id === id)
      if (changed) dbWrite({ table: 'inbox_items', operation: 'upsert', data: toRow(changed) })
      return next
    })
  }, [])

  return (
    <InboxContext.Provider value={{ items, unreadCount: items.length, addItem, approveItem, dismissItem, updateItem }}>
      {children}
    </InboxContext.Provider>
  )
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be inside InboxProvider')
  return ctx
}
