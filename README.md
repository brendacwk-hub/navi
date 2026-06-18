# Navi

Personal productivity app for Brenda — Work mode live, Personal mode in progress.

Built with Next.js 16 · Supabase · Tailwind CSS · Vercel.

---

## What it does

**Work mode** (`/work/*`)
- Finance / HR / Ops / Others area tabs — cycles, tasks, task+ with sub-items
- Today tab — smart daily view, weekly review (Monday), focus strip, coming up
- Inbox — capture → review → approve into cycles
- Habits — streak tracking, daily logging, push reminders
- Calendar — Google Calendar OAuth, habit dots, Navi cycles on grid
- Settings — calendar connection, font size, notifications, completed tasks archive
- Templates — per-area reusable cycle templates with run modal

**Personal mode** (`/personal/*`) — in progress, see TODO.md

---

## Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Calendar OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Push notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=

# Widget auth
NAVI_API_KEY=

# Diary (Personal mode)
GEMINI_API_KEY=
```

---

## Gemini API key setup

1. Go to **aistudio.google.com** → sign in
2. **Get API key** → Create API key → copy
3. Add `GEMINI_API_KEY=...` to `.env.local`
4. Add same key to Vercel: Settings → Environment Variables

Used server-side only for Diary prompt generation.

---

## Deploy

```bash
git push   # triggers Vercel auto-deploy on main
```

No `vercel` CLI needed.

---

## Supabase tables

| Table | Purpose |
|-------|---------|
| `cycles` | All work + personal cycles (`mode` column separates them) |
| `today_tasks` | Today tab task list (singleton row) |
| `completed_tasks` | Auto-archived finished cycles |
| `template_collections` | Per-area templates (one row per area key) |
| `google_auth` | OAuth tokens + selected calendar IDs + calendar colors |
| `habit_definitions` | Habit list (singleton) |
| `habit_logs` | One row per date, all habit log data |
| `push_subscriptions` | Device push subscription JSON |
| `weekly_reviews` | Work Monday reviews |
| `personal_weekly_reviews` | Personal Monday reviews |
| `diary_entries` | Daily diary (id = YYYY-MM-DD) |

**Pending SQL (run in Supabase SQL editor):**
```sql
-- Completed tasks archive
CREATE TABLE IF NOT EXISTS completed_tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  area text NOT NULL,
  effort text,
  sub_area text,
  items jsonb,
  completed_at timestamptz DEFAULT now(),
  notes text
);

-- Personal mode
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'work';

-- Diary
CREATE TABLE IF NOT EXISTS diary_entries (
  id text PRIMARY KEY,
  mood text,
  prompts jsonb,
  body text,
  created_at timestamptz DEFAULT now()
);

-- Personal weekly reviews
CREATE TABLE IF NOT EXISTS personal_weekly_reviews (
  id text PRIMARY KEY,
  week_start text,
  data jsonb,
  created_at timestamptz DEFAULT now()
);
```

---

## Key files

| File | Purpose |
|------|---------|
| `src/shared/lib/work-data-context.tsx` | All work cycle state + DB sync |
| `src/shared/lib/sort-utils.ts` | `isTriggerDueToday`, `allCycleDone`, `sortCycles` |
| `src/shared/components/CycleCard.tsx` | Main cycle card (edit, drag, progress) |
| `src/shared/components/ChecklistItem.tsx` | Sub-task row |
| `src/shared/lib/toast-context.tsx` | Toast with optional undo action |
| `BUGS.md` | Living bug log — update after every fix |
| `TODO.md` | Build tracker — personal mode checklist |
| `personal/personality.md` | Brenda's profile for Diary prompts |
| `AGENTS.md` | Architecture rules Claude must follow |
