'use client'

import { useState, useEffect } from 'react'

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    // Register SW
    navigator.serviceWorker.register('/sw.js').then(async () => {
      const perm = Notification.permission
      if (perm === 'denied') { setStatus('denied'); return }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      setStatus(existing ? 'subscribed' : 'unsubscribed')
    }).catch(() => setStatus('unsupported'))
  }, [])

  const subscribe = async () => {
    setStatus('loading')
    setSubscribeError(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as Uint8Array<ArrayBuffer>,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      setStatus('subscribed')
    } catch (e) {
      console.error('[push subscribe]', e)
      const msg = e instanceof Error ? e.message : String(e)
      setSubscribeError(msg)
      setStatus('unsubscribed')
    }
  }

  const unsubscribe = async () => {
    setStatus('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('unsubscribed')
    } catch (e) {
      console.error('[push unsubscribe]', e)
      setStatus('subscribed')
    }
  }

  return { status, subscribe, unsubscribe, subscribeError }
}
