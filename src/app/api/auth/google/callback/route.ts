import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { makeOAuthClient, saveAuth } from '@/shared/lib/google-auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://navi-ruby.vercel.app'

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/work/settings?error=oauth_denied`)
  }

  try {
    const client = makeOAuthClient()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    // Fetch user email
    const oauth2   = google.oauth2({ version: 'v2', auth: client })
    const { data } = await oauth2.userinfo.get()

    await saveAuth({
      access_token:  tokens.access_token  ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      token_expiry:  tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      email:         data.email ?? null,
    })

    return NextResponse.redirect(`${APP_URL}/work/settings?connected=1`)
  } catch (err) {
    console.error('[google/callback]', err)
    return NextResponse.redirect(`${APP_URL}/work/settings?error=token_exchange`)
  }
}
