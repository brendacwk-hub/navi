import { NextResponse } from 'next/server'
import { makeOAuthClient } from '@/shared/lib/google-auth'

export function GET() {
  const client = makeOAuthClient()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
  return NextResponse.redirect(url)
}
