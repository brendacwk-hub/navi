import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://navi-ruby.vercel.app'

export function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${APP_URL}/api/auth/google/callback`,
  )
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface GoogleAuthRow {
  id: string
  access_token: string
  refresh_token: string
  token_expiry: string | null
  email: string | null
  selected_calendar_ids: string[]
  calendar_colors: Record<string, string>   // calendarId → hex color
}

export async function getStoredAuth(): Promise<GoogleAuthRow | null> {
  const { data } = await supabase()
    .from('google_auth')
    .select('*')
    .eq('id', 'singleton')
    .single()
  return data ?? null
}

export async function saveAuth(patch: Partial<Omit<GoogleAuthRow, 'id'>>) {
  const { error } = await supabase().from('google_auth').upsert({
    id: 'singleton',
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (error) console.error('[saveAuth]', error.message)
}

// Returns an authenticated OAuth2 client, auto-refreshing if needed
export async function getAuthClient() {
  const row = await getStoredAuth()
  if (!row?.access_token) return null

  const client = makeOAuthClient()
  client.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
  })

  // Auto-refresh if token is expired or expires within 5 min
  const expiresAt = row.token_expiry ? new Date(row.token_expiry).getTime() : 0
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken()
    await saveAuth({
      access_token: credentials.access_token ?? row.access_token,
      token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : row.token_expiry,
    })
    client.setCredentials(credentials)
  }

  return client
}
