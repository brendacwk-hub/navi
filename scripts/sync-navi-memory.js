#!/usr/bin/env node
// sync-navi-memory.js — runs after weekly review; writes usage insights to md files

'use strict'

const fs = require('fs')
const path = require('path')

const NAVI_DIR = path.join(__dirname, '..')
const ENV_PATH = path.join(NAVI_DIR, '.env.local')
const WORK_DIR = path.join(NAVI_DIR, '..')
const MEMORY_DIR = '/Users/brendaevg/.claude/projects/-Users-brendaevg-work-control/memory'

// ── env loader ────────────────────────────────────────────────────────────────
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {}
  const text = fs.readFileSync(ENV_PATH, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

// ── Supabase REST fetch ───────────────────────────────────────────────────────
async function supabaseFetch(env, endpoint, opts = {}) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${endpoint}`
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── md section replacer ───────────────────────────────────────────────────────
function replaceMdSection(filePath, sectionHeader, newContent) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ! ${filePath} not found — skipping`)
    return
  }
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split('\n')

  let startIdx = -1
  let endIdx = lines.length

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === sectionHeader) {
      startIdx = i
    } else if (startIdx >= 0 && i > startIdx && lines[i].startsWith('## ')) {
      endIdx = i
      break
    }
  }

  const newLines = newContent.split('\n')
  let updated
  if (startIdx >= 0) {
    updated = [...lines.slice(0, startIdx), ...newLines, '', ...lines.slice(endIdx)].join('\n')
  } else {
    updated = text.trimEnd() + '\n\n' + newContent + '\n'
  }
  fs.writeFileSync(filePath, updated)
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const env = loadEnv()

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('[sync-navi-memory] Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
    process.exit(1)
  }

  console.log('[sync-navi-memory] Fetching weekly reviews...')

  const reviews = await supabaseFetch(env, '/weekly_reviews?order=week_start.desc&limit=12')
  if (!Array.isArray(reviews) || reviews.length === 0) {
    console.log('[sync-navi-memory] No reviews yet — nothing to sync')
    return
  }

  const cycles = await supabaseFetch(env, '/cycles?select=id,title,area')
  const cycleMap = Object.fromEntries((cycles || []).map(c => [c.id, c]))

  // Compute patterns
  const weekCount = reviews.length
  const avgCompleted = reviews.reduce((s, r) => s + (r.completed_ids?.length ?? 0), 0) / weekCount

  const deferCounts = {}
  for (const r of reviews) {
    for (const d of (r.deferred ?? [])) {
      deferCounts[d.id] = (deferCounts[d.id] ?? 0) + 1
    }
  }
  const topDeferred = Object.entries(deferCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ name: cycleMap[id]?.title ?? id, count }))

  const focusCounts = {}
  for (const r of reviews) {
    for (const id of (r.focus_ids ?? [])) {
      focusCounts[id] = (focusCounts[id] ?? 0) + 1
    }
  }
  const topFocus = Object.entries(focusCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ name: cycleMap[id]?.title ?? id, count }))

  const recentNotes = reviews
    .filter(r => r.notes)
    .slice(0, 5)
    .map(r => `- *${r.week_start}:* ${r.notes}`)

  const runDate = new Date().toISOString().slice(0, 10)
  const latestReview = reviews[0]

  // ── Section: personal-profile.md ──
  const profileSection = [
    '## Observed Work Patterns',
    `_Auto-updated ${runDate} from ${weekCount} weekly review${weekCount !== 1 ? 's' : ''}_`,
    '',
    `**Average cycles completed per week:** ${avgCompleted.toFixed(1)}`,
    '',
    topDeferred.length > 0
      ? `**Consistently deferred (watch these):**\n${topDeferred.map(d => `- ${d.name} (deferred ${d.count}×)`).join('\n')}`
      : '**No consistent deferrals yet.**',
    '',
    topFocus.length > 0
      ? `**Recurring focus picks:**\n${topFocus.map(f => `- ${f.name} (picked ${f.count}×)`).join('\n')}`
      : '**Focus pattern still building — needs more weeks.**',
    '',
    recentNotes.length > 0 ? `**Recent reflections:**\n${recentNotes.join('\n')}` : '',
  ].filter(l => l !== '').join('\n')

  // ── Section: todo-app-requirements.md ──
  const insightsSection = [
    '## Usage Insights',
    `_Auto-updated ${runDate} from ${weekCount} weekly review${weekCount !== 1 ? 's' : ''}_`,
    '',
    `- Average cycles completed per week: **${avgCompleted.toFixed(1)}**`,
    topDeferred.length > 0 ? `- Most deferred: ${topDeferred.map(d => d.name).join(', ')}` : '',
    topFocus.length > 0 ? `- Consistent weekly focus: ${topFocus.map(f => f.name).join(', ')}` : '',
    `- Last review completed: ${latestReview.week_start}`,
    `- Total reviews recorded: ${weekCount}`,
  ].filter(Boolean).join('\n')

  // ── Memory file: user-work-patterns.md ──
  const rawLog = reviews.slice(0, 5).map(r =>
    `- **${r.week_start}**: ${r.completed_ids?.length ?? 0} done, focus=[${(r.focus_ids ?? []).map(id => cycleMap[id]?.title ?? id).join(', ')}]${r.notes ? ` — "${r.notes}"` : ''}`
  ).join('\n')

  const memoryContent = [
    '---',
    'name: user-work-patterns',
    'description: Auto-generated weekly usage patterns from Navi weekly reviews — updated every Monday',
    'metadata:',
    '  type: user',
    '---',
    '',
    profileSection,
    '',
    '## Recent Reviews (last 5)',
    rawLog,
  ].join('\n')

  // Write
  const personalProfilePath = path.join(WORK_DIR, 'personal-profile.md')
  const requirementsPath = path.join(WORK_DIR, 'todo-app-requirements.md')
  const workPatternsPath = path.join(MEMORY_DIR, 'user-work-patterns.md')

  replaceMdSection(personalProfilePath, '## Observed Work Patterns', profileSection)
  console.log('  → personal-profile.md updated')

  replaceMdSection(requirementsPath, '## Usage Insights', insightsSection)
  console.log('  → todo-app-requirements.md updated')

  fs.writeFileSync(workPatternsPath, memoryContent)
  console.log('  → memory/user-work-patterns.md updated')

  console.log('[sync-navi-memory] Done.')
}

main().catch(e => { console.error('[sync-navi-memory] Error:', e.message); process.exit(1) })
