#!/usr/bin/env node
// seed-tasks.mjs — insert tasks/cycles/templates for Navi
// Run: node scripts/seed-tasks.mjs

const SUPABASE_URL = 'https://orzucmilxvgojrhpnyur.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yenVjbWlseHZnb2pyaHBueXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NDg4MiwiZXhwIjoyMDk2ODYwODgyfQ.AYu8WQ8Tdit1cXaCy4fB8PqxzyTdcxzXhRS175MBS4E'

const HEADERS = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:         'resolution=merge-duplicates,return=minimal',
}

async function upsertCycles(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cycles`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`cycles upsert failed: ${await res.text()}`)
}

async function deleteCycles(ids) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cycles?id=in.(${ids.join(',')})`, {
    method:  'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`cycles delete failed: ${await res.text()}`)
}

async function upsertTemplate(area, newTemplate) {
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/template_collections?id=eq.${area}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!getRes.ok) throw new Error(`template_collections fetch failed: ${await getRes.text()}`)
  const rows     = await getRes.json()
  const existing = rows[0]?.templates ?? []
  const merged   = [...existing.filter(t => t.id !== newTemplate.id), newTemplate]

  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/template_collections`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify({ id: area, templates: merged, updated_at: new Date().toISOString() }),
  })
  if (!putRes.ok) throw new Error(`template_collections upsert failed: ${await putRes.text()}`)
}

// ── Cycles (tasks = single-item cycles) ───────────────────────────────────────

const cycles = [
  // Finance > Administrative — Mugen Reap Fraud follow-up (task)
  {
    id:            'finance-admin-mugen-reap-fraud',
    area:          'finance',
    sub_area:      'Administrative',
    title:         'Mugen Reap Fraud transactions follow',
    effort:        'quick',
    must:          false,
    urgent:        false,
    status:        'active',
    trigger_label: null,
    notes:         'Waiting on: wait for Reap reply',
    items: [{ id: 'finance-admin-mugen-reap-fraud-item', label: 'Mugen Reap Fraud transactions follow', status: 'todo' }],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // Finance > AI — Build subscription database (task)
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
    notes:         null,
    items: [{ id: 'finance-ai-subscription-db-item', label: 'Build subscription database', status: 'todo' }],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // Ops > Arrangements — Check ops@vibration.one (task, due 10 Jul)
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
    notes:         null,
    items: [{ id: 'ops-arrangements-check-ops-email-item', label: 'Check ops@vibration.one', status: 'todo' }],
    phases:        null,
    next_due_at:   null,
    last_completed_at: null,
  },

  // HR > Records — Regular check (cycle, next 1 Aug)
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
    notes:         'Recurring every 3 months — update date after each completion',
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
]

// IDs to remove — HR onboarding cycles moved to templates
const onboardingCycleIds = [
  'hr-onboarding-prep-onboard',
  'hr-onboarding-date-onboard',
  'hr-onboarding-probation',
]

// ── Templates ─────────────────────────────────────────────────────────────────

const financeTemplate = {
  id:          'tmpl-finance-admin-regular-check',
  title:       'Regular check',
  description: 'Quarterly accounts & entities review — every 3 months. Next run: 1 Sep 2026.',
  area:        'finance',
  subArea:     'Administrative',
  effort:      'quick',
  must:        false,
  items: [
    {
      id:       'tmpl-rc-1a',
      label:    'All accounts',
      notes:    'https://docs.google.com/spreadsheets/d/1b6aUN_6UTxw1RBpCsK7-HXuLeWTej7mv_ZFo09WG7-Y/edit?gid=0#gid=0',
      optional: false,
    },
    {
      id:       'tmpl-rc-1b',
      label:    'All entities',
      notes:    'https://docs.google.com/spreadsheets/d/1OPKYI4vlw_yYDc-DaEG9Uqwa5cR2sSFSSF2jsfT2GM8/edit?gid=1527524646#gid=1527524646',
      optional: false,
    },
  ],
}

const hrTemplates = [
  {
    id:          'tmpl-hr-onboarding-prep',
    title:       'Onboarding (prep on board)',
    description: 'By demand — run when new hire is confirmed.',
    area:        'hr',
    subArea:     'Onboarding & Offboarding',
    effort:      'heavy',
    must:        false,
    items: [
      { id: 'tmpl-ob1-1a', label: 'Save CV + prep offer letter', optional: false },
      { id: 'tmpl-ob1-1b', label: 'Send offer letter + ask HKID Card copy + create P-file', optional: false },
      { id: 'tmpl-ob1-1c', label: 'Draft contract / service agreement', optional: false },
      { id: 'tmpl-ob1-1d', label: 'Sign via Docusign', optional: false },
      { id: 'tmpl-ob1-1e', label: 'Save in P-file', optional: false },
      { id: 'tmpl-ob1-1f', label: 'Inform Admin to prep laptop + seat', optional: false },
      {
        id: 'tmpl-ob1-1g', label: 'Prep gmail + lark account', optional: false,
        notes: 'Fill in: Name, Last name, User ID (Staff ID), Work email, Department, EE Number, Gender, Workforce Type, Start Date, Direct Mgr, Job Title',
      },
      {
        id: 'tmpl-ob1-1h', label: 'Send onboarding email', optional: false,
        notes: 'https://docs.google.com/document/d/1QowndUKYYrUTYonRaoKTNbKWgkcsKRAdhnLbjEVeqSo/edit?usp=sharing',
      },
      { id: 'tmpl-ob1-1i', label: 'Prep welcome lunch', optional: false },
      {
        id: 'tmpl-ob1-1j', label: 'Update HR Onboarding Tracker in Lark', optional: false,
        notes: 'https://esgr19l2eky8.sg.larksuite.com/base/U0XmbE3hOad93jsTw3slo67Pgnd?from=from_copylink',
      },
    ],
  },
  {
    id:          'tmpl-hr-onboarding-date',
    title:       'Date onboard',
    description: 'By demand — run on the actual onboarding day.',
    area:        'hr',
    subArea:     'Onboarding & Offboarding',
    effort:      'heavy',
    must:        false,
    items: [
      {
        id: 'tmpl-ob2-2a', label: 'Induction + office tour (add wiki access)', optional: false,
        notes: 'Wiki: https://esgr19l2eky8.sg.larksuite.com/wiki/MrWdw3GnNihLGFkLqfHlB2y5gVw?from=from_copylink | Seating plan: https://docs.google.com/spreadsheets/d/1EZ-8g7noJ2aNyEw-qQB3sE_3Day5NvC1bXbwV1m1Kbg/edit?usp=sharing',
      },
      { id: 'tmpl-ob2-2b', label: 'Add to HKHQ group', optional: false },
      { id: 'tmpl-ob2-2c', label: 'Remind welcome lunch', optional: false },
      { id: 'tmpl-ob2-2d', label: 'Follow up — Policy Acknowledgement Approval Form in Lark', optional: false },
      {
        id: 'tmpl-ob2-2e', label: 'Update Gsheet Staff list', optional: false,
        notes: 'https://docs.google.com/spreadsheets/d/1GbNYWbX9MDtRd3uHQCHPy9ZSakLgWh9oNYmFnUUjhns/edit?gid=616664634#gid=616664634',
      },
      {
        id: 'tmpl-ob2-2f', label: 'Update payroll details', optional: false,
        notes: 'https://docs.google.com/spreadsheets/d/1Zdv0ZvWb28Tni2792BaSW2g2letnfcPHesnZYeBH510/edit?gid=1335009474#gid=1335009474',
      },
      {
        id: 'tmpl-ob2-2g', label: 'Update payment details', optional: false,
        notes: 'https://docs.google.com/spreadsheets/d/1g9IMv-V0XNKZ8Pnkjud4-R5zufQlg-xAHOSSsn5NT_4/edit?gid=418550028#gid=418550028',
      },
      {
        id: 'tmpl-ob2-2h', label: 'Check P-file', optional: false,
        notes: 'Save in P-file: offer letter, employment contract, HKID, bank account proof, edu cert, work proof',
      },
      { id: 'tmpl-ob2-2i', label: 'Add MPF', optional: false },
      { id: 'tmpl-ob2-2j', label: 'Set probation prep cycle', optional: false },
    ],
  },
  {
    id:          'tmpl-hr-probation',
    title:       'Probation',
    description: 'By demand — run at end of probation period.',
    area:        'hr',
    subArea:     'Onboarding & Offboarding',
    effort:      'heavy',
    must:        false,
    items: [
      { id: 'tmpl-ob3-3a', label: 'Remind supervisor to reflect with new joiner', optional: false },
      { id: 'tmpl-ob3-3b', label: 'Get probation result', optional: false },
      { id: 'tmpl-ob3-3c', label: 'Send pass probation email', optional: false },
      { id: 'tmpl-ob3-3d', label: 'Help re-enrol their medical insurance', optional: false },
    ],
  },
]

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Upserting 4 cycles/tasks…')
  await upsertCycles(cycles)
  console.log(`  ✓ ${cycles.length} cycles done`)

  console.log('Deleting 3 HR onboarding cycles (moved to templates)…')
  await deleteCycles(onboardingCycleIds)
  console.log('  ✓ Deleted')

  console.log('Upserting Finance > Administrative template…')
  await upsertTemplate('finance', financeTemplate)
  console.log('  ✓ Finance "Regular check" saved')

  console.log('Upserting 3 HR > Onboarding & Offboarding templates…')
  for (const tmpl of hrTemplates) {
    await upsertTemplate('hr', tmpl)
    console.log(`  ✓ HR "${tmpl.title}" saved`)
  }

  console.log('\nAll done ✓')
}

main().catch(err => { console.error(err); process.exit(1) })
