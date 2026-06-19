import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface DiaryEntry {
  id: string
  mood: string
  prompts: { question: string; answer: string }[]
  body: string
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

function formatDate(id: string) {
  return new Date(id + 'T12:00:00').toLocaleDateString('en-HK', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// Build batchUpdate requests that write all entries into a doc starting at index 1
function buildRequests(entries: DiaryEntry[], year: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqs: any[] = []
  let idx = 1

  function ins(text: string, style?: string) {
    reqs.push({ insertText: { location: { index: idx }, text } })
    if (style) {
      reqs.push({
        updateParagraphStyle: {
          range: { startIndex: idx, endIndex: idx + text.length },
          paragraphStyle: { namedStyleType: style },
          fields: 'namedStyleType',
        },
      })
    }
    idx += text.length
  }

  ins(`Diary — ${year}\n`, 'HEADING_1')
  ins('\n', 'NORMAL_TEXT')

  for (const entry of entries) {
    const heading = `${formatDate(entry.id)}${entry.mood ? `  ${entry.mood}` : ''}\n`
    ins(heading, 'HEADING_2')

    const answered = (entry.prompts ?? []).filter(p => p.answer?.trim())
    for (const p of answered) {
      ins(`${p.question}\n`, 'HEADING_3')
      ins(`${p.answer.trim()}\n`, 'NORMAL_TEXT')
    }

    if (entry.body?.trim()) {
      if (answered.length > 0) ins('Free write\n', 'HEADING_3')
      ins(`${entry.body.trim()}\n`, 'NORMAL_TEXT')
    }

    ins('\n', 'NORMAL_TEXT')
  }

  return reqs
}

export async function POST(req: NextRequest) {
  // Optional API key guard — soft-fail for unauthenticated callers
  const apiKey = req.headers.get('x-api-key') ?? new URL(req.url).searchParams.get('apiKey')
  const validKey = process.env.NAVI_API_KEY
  if (validKey && apiKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let auth
  try {
    auth = getAuth()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  const docs  = google.docs({ version: 'v1', auth })
  const drive = google.drive({ version: 'v3', auth })

  // All diary entries, newest first per year
  const { data: rows, error } = await supabase
    .from('diary_entries')
    .select('id, mood, prompts, body')
    .order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by year, preserve descending order within year
  const byYear: Record<number, DiaryEntry[]> = {}
  for (const row of (rows ?? []) as DiaryEntry[]) {
    const y = parseInt(row.id.slice(0, 4))
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(row)
  }

  // Load doc ID registry
  const { data: registry } = await supabase
    .from('diary_gdoc_registry')
    .select('year, doc_id')

  const docIdByYear: Record<number, string> = {}
  for (const r of registry ?? []) docIdByYear[r.year] = r.doc_id

  const shareEmail = process.env.GOOGLE_SHARE_EMAIL ?? 'brendacwk@gmail.com'
  const result: { year: number; url: string; entries: number }[] = []

  for (const [yearStr, entries] of Object.entries(byYear).sort(([a], [b]) => Number(b) - Number(a))) {
    const year = parseInt(yearStr)
    let docId  = docIdByYear[year]

    // Verify existing doc still exists in Drive
    if (docId) {
      try {
        await drive.files.get({ fileId: docId, fields: 'id' })
      } catch {
        docId = ''
      }
    }

    // Create doc if needed
    if (!docId) {
      const created = await docs.documents.create({
        requestBody: { title: `Diary — ${year}` },
      })
      docId = created.data.documentId!

      // Share with owner
      await drive.permissions.create({
        fileId: docId,
        sendNotificationEmail: false,
        requestBody: { role: 'writer', type: 'user', emailAddress: shareEmail },
      })
    }

    // Clear existing content (everything except the mandatory trailing newline)
    const existing = await docs.documents.get({ documentId: docId })
    const content  = existing.data.body?.content ?? []
    const lastEnd  = (content[content.length - 1]?.endIndex ?? 2) - 1
    if (lastEnd > 1) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: lastEnd } } }],
        },
      })
    }

    // Write all entries
    const requests = buildRequests(entries, year)
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests },
      })
    }

    // Upsert registry
    await supabase.from('diary_gdoc_registry').upsert({
      year,
      doc_id: docId,
      updated_at: new Date().toISOString(),
    })

    result.push({
      year,
      url: `https://docs.google.com/document/d/${docId}/edit`,
      entries: entries.length,
    })
  }

  return NextResponse.json({ ok: true, docs: result })
}
