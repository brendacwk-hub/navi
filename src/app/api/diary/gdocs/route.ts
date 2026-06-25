import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { getAuthClient } from '@/shared/lib/google-auth'

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

const MOOD_SCORE: Record<string, number> = { '😄': 5, '🙂': 4, '😐': 3, '😔': 2, '😢': 1 }
const FOLDER_SENTINEL = 0 // year=0 row in registry stores the folder ID

function formatDate(id: string) {
  return new Date(id + 'T12:00:00').toLocaleDateString('en-HK', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRequests(entries: DiaryEntry[], year: number): any[] {
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

  ins(`${year} Diary\n`, 'HEADING_1')
  ins('\n', 'NORMAL_TEXT')

  for (const entry of entries) {
    const score     = MOOD_SCORE[entry.mood] ? ` · ${MOOD_SCORE[entry.mood]}/5` : ''
    const moodPart  = entry.mood ? `  ${entry.mood}${score}` : ''
    const heading   = `◆ ${entry.id} — ${formatDate(entry.id)}${moodPart}\n`
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

// ── Find or create the "diary" folder in Drive ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateFolder(drive: any): Promise<string> {
  const { data: reg } = await supabase
    .from('diary_gdoc_registry')
    .select('doc_id')
    .eq('year', FOLDER_SENTINEL)
    .single()

  if (reg?.doc_id) {
    try {
      await drive.files.get({ fileId: reg.doc_id, fields: 'id' })
      return reg.doc_id
    } catch { /* folder was deleted — fall through to recreate */ }
  }

  const { data: folder } = await drive.files.create({
    requestBody: { name: 'diary', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  })
  const folderId = folder.id as string

  await supabase.from('diary_gdoc_registry').upsert({
    year: FOLDER_SENTINEL,
    doc_id: folderId,
    updated_at: new Date().toISOString(),
  })

  return folderId
}

// ── Main sync handler ─────────────────────────────────────────────────────────

export async function POST() {
  let auth
  try {
    auth = await getAuthClient()
  } catch {
    return NextResponse.json({ error: 'needs_reauth' }, { status: 401 })
  }

  if (!auth) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const docs  = google.docs({ version: 'v1', auth })
  const drive = google.drive({ version: 'v3', auth })

  // Fetch all diary entries
  const { data: rows, error } = await supabase
    .from('diary_entries')
    .select('id, mood, prompts, body')
    .order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by year
  const byYear: Record<number, DiaryEntry[]> = {}
  for (const row of (rows ?? []) as DiaryEntry[]) {
    const y = parseInt(row.id.slice(0, 4))
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(row)
  }

  if (Object.keys(byYear).length === 0) {
    return NextResponse.json({ ok: true, docs: [] })
  }

  // Ensure diary folder exists
  let folderId: string
  try {
    folderId = await getOrCreateFolder(drive)
  } catch (e: unknown) {
    const msg = (e as Error).message ?? ''
    if (msg.includes('insufficientPermissions') || msg.includes('invalid_grant') || msg.includes('401')) {
      return NextResponse.json({ error: 'needs_reauth' }, { status: 401 })
    }
    throw e
  }

  // Load doc ID registry for year docs
  const { data: registry } = await supabase
    .from('diary_gdoc_registry')
    .select('year, doc_id')
    .neq('year', FOLDER_SENTINEL)

  const docIdByYear: Record<number, string> = {}
  for (const r of registry ?? []) docIdByYear[r.year] = r.doc_id

  const result: { year: number; url: string; entries: number }[] = []

  for (const [yearStr, entries] of Object.entries(byYear).sort(([a], [b]) => Number(b) - Number(a))) {
    const year = parseInt(yearStr)
    let docId  = docIdByYear[year]

    // Verify doc still exists
    if (docId) {
      try {
        await drive.files.get({ fileId: docId, fields: 'id' })
      } catch {
        docId = ''
      }
    }

    // Create doc inside diary folder
    if (!docId) {
      try {
        const { data: file } = await drive.files.create({
          requestBody: {
            name: `${year}`,
            mimeType: 'application/vnd.google-apps.document',
            parents: [folderId],
          },
          fields: 'id',
        })
        docId = file.id as string
      } catch (e: unknown) {
        const msg = (e as Error).message ?? ''
        if (msg.includes('insufficientPermissions') || msg.includes('invalid_grant') || msg.includes('401')) {
          return NextResponse.json({ error: 'needs_reauth' }, { status: 401 })
        }
        throw e
      }
    }

    // Clear existing doc content and rewrite
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

    const requests = buildRequests(entries, year)
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests },
      })
    }

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
