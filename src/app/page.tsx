import { redirect } from 'next/navigation'
import { getAutoMode } from '@/shared/lib/hk-holidays'

export default function Home() {
  const mode = getAutoMode()
  redirect(mode === 'work' ? '/work' : '/personal/today')
}
