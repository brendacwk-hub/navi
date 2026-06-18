'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface ToastItem {
  id: number
  msg: string
  action?: { label: string; onClick: () => void }
}

interface ToastCtx {
  showToast: (msg: string, options?: { action?: { label: string; onClick: () => void }; duration?: number }) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((msg: string, options?: { action?: { label: string; onClick: () => void }; duration?: number }) => {
    const id = Date.now()
    const duration = options?.duration ?? 2200
    setToasts(prev => [...prev, { id, msg, action: options?.action }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-[#2a2a2a] border border-white/15 text-white/80 text-xs px-4 py-2.5 rounded-xl shadow-2xl whitespace-nowrap pointer-events-auto"
            >
              <span>{t.msg}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    setToasts(prev => prev.filter(x => x.id !== t.id))
                  }}
                  className="ml-1 text-navi-blue font-semibold hover:text-blue-300 transition-colors"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
