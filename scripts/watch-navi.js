#!/usr/bin/env node
// watch-navi.js — Supabase Realtime watcher; triggers sync-navi-memory.js on weekly_reviews changes
// Kept alive by launchd (com.navi.memory-sync.plist)

'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const NAVI_DIR = path.join(__dirname, '..')
const ENV_PATH = path.join(NAVI_DIR, '.env.local')
const SYNC_SCRIPT = path.join(__dirname, 'sync-navi-memory.js')
const NODE_BIN = process.execPath

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

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[watch-navi] Missing Supabase credentials in .env.local')
  process.exit(1)
}

// Require Supabase client from navi's own node_modules
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require(path.join(NAVI_DIR, 'node_modules', '@supabase', 'supabase-js'))

const supabase = createClient(supabaseUrl, supabaseKey)

function runSync(weekStart) {
  console.log(`[watch-navi] Review saved for ${weekStart} — running sync...`)
  try {
    execSync(`"${NODE_BIN}" "${SYNC_SCRIPT}"`, { stdio: 'inherit', cwd: NAVI_DIR })
    console.log('[watch-navi] Sync complete.')
  } catch (e) {
    console.error('[watch-navi] Sync failed:', e.message)
  }
}

console.log('[watch-navi] Watching weekly_reviews for changes...')

supabase
  .channel('navi-weekly-reviews')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'weekly_reviews' },
    payload => runSync(payload.new.week_start)
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'weekly_reviews' },
    payload => runSync(payload.new.week_start)
  )
  .subscribe(status => {
    console.log(`[watch-navi] Channel status: ${status}`)
  })

// Keep the process alive
process.on('SIGTERM', () => { console.log('[watch-navi] Received SIGTERM, shutting down'); process.exit(0) })
process.on('SIGINT',  () => { console.log('[watch-navi] Received SIGINT, shutting down');  process.exit(0) })
