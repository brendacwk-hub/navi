import { NextResponse } from 'next/server'
import { getStoredAuth } from '@/shared/lib/google-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const row = await getStoredAuth()
    if (!row?.access_token) {
      return NextResponse.json({ connected: false })
    }
    return NextResponse.json({ connected: true, email: row.email ?? null })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
