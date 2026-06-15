#!/usr/bin/env node
// seed-tasks.mjs — insert tasks/cycles/templates for Navi
// Run: node scripts/seed-tasks.mjs

const SUPABASE_URL = 'https://orzucmilxvgojrhpnyur.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yenVjbWlseHZnb2pyaHBueXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NDg4MiwiZXhwIjoyMDk2ODYwODgyfQ.AYu8WQ8Tdit1cXaCy4fB8PqxzyTdcxzXhRS175MBS4E'

const HEADERS = {
  apikey:          SERVICE_KEY,
  Authorization:   `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json',
  Prefer:          'resolution=merge-duplicates,return=minimal',
}

async function upsertCycles(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cycles`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`cycles upsert failed: ${await res.text()}`)
}

async function upsertTemplate(area, newTemplate) {
  // Load existing templates for this area
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/template_collections?id=eq.${area}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!getRes.ok) throw new Error(`template_collections fetch failed: ${await getRes.text()}`)
  const rows  = await getRes.json()
  const existing = rows[0]?.templates ?? []

  // Avoid duplicate by id
  const merged = [...existing.filter(t => t.id !== newTemplate.id), newTemplate]

  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/template_collections`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify({ id: area, templates: merged, updated_at: new Date().toISOString() }),
  })
  if (!putRes.ok) throw new Error(`template_collections upsert failed: ${await putRes.text()}`)
}

// ── Cycles ────────────────────────────────────────────────────────────────────

const cycles = [
  // Finance > Administrative — Mugen Reap Fraud follow-up
  {
    id:            'finance-admin-mugen-reap-fraud',
    area:          'finance',
    sub_area:      'Administrative',
    title:         'Mugen Reap Fraud transactions follow — waiting on Reap reply',
    effort:        'quick',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: null,
    items:         null,
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // Finance > AI — Build subscription database
  {
    id:            'finance-ai-subscription-db',
    area:          'finance',
    sub_area:      'AI',
    title:         'Build subscription database',
    effort:        'medium',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: null,
    items:         null,
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // Ops > Arrangements — Check ops@vibration.one (due 10 Jul)
  {
    id:            'ops-arrangements-check-ops-email',
    area:          'ops',
    sub_area:      'Arrangements',
    title:         'Check ops@vibration.one',
    effort:        'quick',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: '2026-07-10',
    items:         null,
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // HR > Records — Regular check (every 3 months, next 1 Aug)
  {
    id:            'hr-records-regular-check',
    area:          'hr',
    sub_area:      'Records',
    title:         'Regular check',
    effort:        'medium',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: '2026-08-01',
    items: [
      { id: 'hr-rc-1a', label: '1pw', status: 'todo' },
      { id: 'hr-rc-1b', label: 'Dashlane', status: 'todo' },
      { id: 'hr-rc-1c', label: 'Google gmail users', status: 'todo' },
      { id: 'hr-rc-1d', label: 'Subscriptions due dates', status: 'todo' },
    ],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // HR > Onboarding & Offboarding — Onboarding (prep on board)
  {
    id:            'hr-onboarding-prep-onboard',
    area:          'hr',
    sub_area:      'Onboarding & Offboarding',
    title:         'Onboarding (prep on board)',
    effort:        'heavy',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: null,
    items: [
      { id: 'hr-ob1-1a', label: 'Save CV + prep offer letter', status: 'todo' },
      { id: 'hr-ob1-1b', label: 'Send offer letter + ask HKID Card copy + create P-file', status: 'todo' },
      { id: 'hr-ob1-1c', label: 'Draft contract / service agreement', status: 'todo' },
      { id: 'hr-ob1-1d', label: 'Sign via Docusign', status: 'todo' },
      { id: 'hr-ob1-1e', label: 'Save in P-file', status: 'todo' },
      { id: 'hr-ob1-1f', label: 'Inform Admin to prep laptop + seat', status: 'todo' },
      {
        id: 'hr-ob1-1g', label: 'Prep gmail + lark account', status: 'todo',
        notes: 'Fill in: Name, Last name, User ID (Staff ID), Work email, Department, EE Number, Gender, Workforce Type, Start Date, Direct Mgr, Job Title',
      },
      {
        id: 'hr-ob1-1h', label: 'Send onboarding email', status: 'todo',
        notes: 'https://docs.google.com/document/d/1QowndUKYYrUTYonRaoKTNbKWgkcsKRAdhnLbjEVeqSo/edit?usp=sharing',
      },
      { id: 'hr-ob1-1i', label: 'Prep welcome lunch', status: 'todo' },
      {
        id: 'hr-ob1-1j', label: 'Update HR Onboarding Tracker in Lark', status: 'todo',
        notes: 'https://esgr19l2eky8.sg.larksuite.com/base/U0XmbE3hOad93jsTw3slo67Pgnd?from=from_copylink',
      },
    ],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // HR > Onboarding & Offboarding — Date onboard
  {
    id:            'hr-onboarding-date-onboard',
    area:          'hr',
    sub_area:      'Onboarding & Offboarding',
    title:         'Date onboard',
    effort:        'heavy',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: null,
    items: [
      {
        id: 'hr-ob2-2a', label: 'Induction + office tour (add wiki access)', status: 'todo',
        notes: 'Wiki: https://esgr19l2eky8.sg.larksuite.com/wiki/MrWdw3GnNihLGFkLqfHlB2y5gVw?from=from_copylink | Seating plan: https://docs.google.com/spreadsheets/d/1EZ-8g7noJ2aNyEw-qQB3sE_3Day5NvC1bXbwV1m1Kbg/edit?usp=sharing',
      },
      { id: 'hr-ob2-2b', label: 'Add to HKHQ group', status: 'todo' },
      { id: 'hr-ob2-2c', label: 'Remind welcome lunch', status: 'todo' },
      { id: 'hr-ob2-2d', label: 'Follow up — Policy Acknowledgement Approval Form in Lark', status: 'todo' },
      {
        id: 'hr-ob2-2e', label: 'Update Gsheet Staff list', status: 'todo',
        notes: 'https://docs.google.com/spreadsheets/d/1GbNYWbX9MDtRd3uHQCHPy9ZSakLgWh9oNYmFnUUjhns/edit?gid=616664634#gid=616664634',
      },
      {
        id: 'hr-ob2-2f', label: 'Update payroll details', status: 'todo',
        notes: 'https://docs.google.com/spreadsheets/d/1Zdv0ZvWb28Tni2792BaSW2g2letnfcPHesnZYeBH510/edit?gid=1335009474#gid=1335009474',
      },
      {
        id: 'hr-ob2-2g', label: 'Update payment details', status: 'todo',
        notes: 'https://docs.google.com/spreadsheets/d/1g9IMv-V0XNKZ8Pnkjud4-R5zufQlg-xAHOSSsn5NT_4/edit?gid=418550028#gid=418550028',
      },
      {
        id: 'hr-ob2-2h', label: 'Check P-file', status: 'todo',
        notes: 'Save in P-file: offer letter, employment contract, HKID, bank account proof, edu cert, work proof',
      },
      { id: 'hr-ob2-2i', label: 'Add MPF', status: 'todo' },
      { id: 'hr-ob2-2j', label: 'Set probation prep cycle', status: 'todo' },
    ],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // HR > Onboarding & Offboarding — Probation
  {
    id:            'hr-onboarding-probation',
    area:          'hr',
    sub_area:      'Onboarding & Offboarding',
    title:         'Probation',
    effort:        'heavy',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: null,
    items: [
      { id: 'hr-ob3-3a', label: 'Remind supervisor to reflect with new joiner', status: 'todo' },
      { id: 'hr-ob3-3b', label: 'Get probation result', status: 'todo' },
      { id: 'hr-ob3-3c', label: 'Send pass probation email', status: 'todo' },
      { id: 'hr-ob3-3d', label: 'Help re-enrol their medical insurance', status: 'todo' },
    ],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },
]

// ── Template ──────────────────────────────────────────────────────────────────

const financeTemplate = {
  id:          'tmpl-finance-admin-regular-check',
  title:       'Regular check',
  description: 'Quarterly accounts & entities review — recurring every 3 months. Next run: 1 Sep 2026.',
  area:        'finance',
  subArea:     'Administrative',
  effort:      'quick',
  must:        false,
  items: [
    {
      id:    'tmpl-rc-1a',
      label: 'All accounts — https://docs.google.com/spreadsheets/d/1b6aUN_6UTxw1RBpCsK7-HXuLeWTej7mv_ZFo09WG7-Y/edit?gid=0#gid=0',
      optional: false,
    },
    {
      id:    'tmpl-rc-1b',
      label: 'All entities — https://docs.google.com/spreadsheets/d/1OPKYI4vlw_yYDc-DaEG9Uqwa5cR2sSFSSF2jsfT2GM8/edit?gid=1527524646#gid=1527524646',
      optional: false,
    },
  ],
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Inserting cycles…')
  await upsertCycles(cycles)
  console.log(`  ✓ ${cycles.length} cycles inserted`)

  console.log('Inserting Finance template…')
  try {
    await upsertTemplate('finance', financeTemplate)
    console.log('  ✓ Finance template "Regular check" saved')
  } catch (err) {
    if (String(err).includes('template_collections')) {
      console.log('  ⚠️  template_collections table missing — template skipped')
    } else {
      throw err
    }
  }

  console.log('\n─────────────────────────────────────────────────────────')
  console.log('⚠️  Run this SQL in Supabase dashboard → SQL editor:')
  console.log('')
  console.log('  ALTER TABLE cycles ADD COLUMN IF NOT EXISTS notes text;')
  console.log('')
  console.log('  CREATE TABLE IF NOT EXISTS template_collections (')
  console.log('    id text PRIMARY KEY,')
  console.log('    templates jsonb NOT NULL DEFAULT \'[]\'::jsonb,')
  console.log('    updated_at timestamptz DEFAULT now()')
  console.log('  );')
  console.log('')
  console.log('Then re-run this script to add the Finance template.')
  console.log('─────────────────────────────────────────────────────────\n')
}

main().catch(err => { console.error(err); process.exit(1) })
