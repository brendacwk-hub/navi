import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

interface Question {
  id: number
  category: string
  text: string
}

function loadQuestions(): Question[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'personal', 'diary-questions.json'), 'utf8')
    return JSON.parse(raw) as Question[]
  } catch {
    return []
  }
}

// Deterministic seed from date string
function dateSeed(date: string): number {
  return date.split('-').reduce((acc, n) => acc * 31 + parseInt(n, 10), 7)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date   = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const single = searchParams.get('single') === '1'
  const count  = single ? 1 : 3

  const excludeIds = new Set(
    (searchParams.get('exclude') ?? '').split(',').filter(Boolean).map(Number)
  )

  const all = loadQuestions()
  if (!all.length) {
    return NextResponse.json({ prompts: [], ids: [] })
  }

  // Filter excluded; fall back to full list if pool would be too small
  let available = all.filter(q => !excludeIds.has(q.id))
  if (available.length < count) available = all

  const seed = dateSeed(date)

  // Group by category
  const byCategory = new Map<string, Question[]>()
  for (const q of available) {
    const arr = byCategory.get(q.category) ?? []
    arr.push(q)
    byCategory.set(q.category, arr)
  }

  const categories = [...byCategory.keys()]
  const picks: Question[] = []
  const usedCats = new Set<string>()

  // Pick one question per category, rotating start by date seed
  for (let i = 0; i < categories.length && picks.length < count; i++) {
    const cat = categories[(seed + i) % categories.length]
    if (usedCats.has(cat)) continue
    usedCats.add(cat)
    const catQs = byCategory.get(cat)!
    picks.push(catQs[(seed + picks.length) % catQs.length])
  }

  // Fallback if categories ran out before filling count
  if (picks.length < count) {
    const picked = new Set(picks.map(p => p.id))
    for (const q of available) {
      if (picks.length >= count) break
      if (!picked.has(q.id)) picks.push(q)
    }
  }

  return NextResponse.json({
    prompts: picks.map(p => p.text),
    ids: picks.map(p => p.id),
  })
}
