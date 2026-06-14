import { NextResponse } from 'next/server'
import { getStoredAuth } from '@/shared/lib/google-auth'

export async function GET() {
  const row = await getStoredAuth()
  if (!row?.access_token) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected:      true,
    email:          row.email,
    selectedIds:    row.selected_calendar_ids ?? [],
    calendarColors: row.calendar_colors ?? {},
  })
}
