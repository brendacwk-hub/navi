# Navi — Build Tracker

## Personal Mode

### Decisions locked in
- Areas: Housework · Finance (personal) · Sidoi (Orders/Marketing/Planning) · To Buy
- Area colors: Housework `#fb7185` · Finance `#22d3ee` · Sidoi `#f9a8d4` · To Buy `#fcd34d`
- Theme: background `#0e1628` navy · accent `#f0a8c8` soft pink · NO PURPLE anywhere
- Mode switching: header badge pill 💼/🏠 · URL-based `/work/*` ↔ `/personal/*` · instant, no animation
- Personal Today: includes Coming Up section (keep it shorter than Work version)
- Analytics: skip for personal MVP, build later
- Diary prompts: Gemini API (`GEMINI_API_KEY`) + `personal/personality.md` as context
- Personality notes source: `navi/personal/personality.md` — already filled, keep in sync with `/Users/brendaevg/work_control/personal-profile.md`
- Sidebar order: Today → Housework → Finance → Sidoi → To Buy → [divider] → Diary → Calendar → Analytics → Settings
- Shared tabs (both modes): Calendar · Analytics · Settings
- Work-only: Inbox · Habits
- Personal-only: Diary
- Templates storage: same `template_collections` table, personal keys = `housework` / `sidoi` / `tobuy` / `personal-finance`
- Weekly Review: mode-specific (personal reviews personal areas only)
- `mode` filter: WorkDataContext must filter `WHERE mode='work'` once migration runs

### Build checklist

- [ ] **Step 1 — DB migration**
  - Run: `ALTER TABLE cycles ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'work';`
  - Run: `CREATE TABLE IF NOT EXISTS diary_entries (id text PRIMARY KEY, mood text, prompts jsonb, body text, created_at timestamptz DEFAULT now());`
  - Run: `CREATE TABLE IF NOT EXISTS personal_weekly_reviews (id text PRIMARY KEY, week_start text, data jsonb, created_at timestamptz DEFAULT now());`
  - Add `WHERE mode='work'` filter to WorkDataContext DB query (prevents personal cycles leaking into work tabs)

- [ ] **Step 2 — `/personal/*` routes + layout**
  - `src/app/personal/layout.tsx` — PersonalDataContext + ToastProvider + Sidebar(mode=personal)
  - `src/app/personal/page.tsx` — redirect to `/personal/today`

- [ ] **Step 3 — Header badge toggle**
  - Single pill in header: 💼 Work / 🏠 Personal
  - Tap switches URL · remembers last page per mode in localStorage
  - Header + sidebar bg changes: `#0c0c0c` ↔ `#0e1628`

- [ ] **Step 4 — Personal sidebar**
  - Navy theme, area nav, shared tabs section with thin divider
  - Work sidebar: add thin divider before Calendar/Analytics/Settings

- [ ] **Step 5 — PersonalDataContext**
  - Mirrors WorkDataContext
  - Reads cycles WHERE `mode = 'personal'`
  - Writes new cycles with `mode = 'personal'`

- [ ] **Step 6 — Area tabs**
  - Housework (coral, no sub-areas)
  - Finance (cyan, no sub-areas)
  - Sidoi (rose pink, sub-areas: Orders / Marketing / Planning)
  - To Buy (amber, no sub-areas)
  - All: Task / Task+ / Cycle / Templates tabs (same as work mode)
  - Reuse CycleCard, ChecklistItem, RecurrencePicker unchanged

- [ ] **Step 7 — Personal Today**
  - Personal tasks due today (same smart filter logic as Work Today)
  - Weekly Review modal (Monday, personal areas only)
  - Coming Up section (shorter than Work version — 3–5 days max)
  - No Focus Strip

- [ ] **Step 8 — Diary tab**
  - Emoji mood picker: 😄 🙂 😐 😔 😢
  - Gemini API generates prompts live: personality notes + GCal events + completed tasks
  - 50% rotating base questions + 50% context-specific
  - Prompted fields + free write section
  - Past entries scrollable below today (most recent first), all editable
  - Daily push reminder (Settings → Notifications → Diary reminder)
  - Warm tone (see `personal/personality.md` → Tone Preferences)

- [ ] **Step 9 — Templates for personal areas**
  - Same TemplateFormModal, RunModal
  - Uses `housework` / `sidoi` / `tobuy` / `personal-finance` keys in template_collections

- [ ] **Step 10 — Calendar: personal cycles**
  - Show personal cycles alongside work cycles + GCal events
  - Personal cycles rendered in soft pink accent

- [ ] **Step 11 — QuickAdd in personal mode**
  - Area selector: Housework / Finance / Sidoi / To Buy
  - No QuickAdd on Calendar tab

---

## Pending (not personal mode)

- [ ] VAPID env vars → add to Vercel
- [ ] External cron: cron-job.org calling `/api/push/daily` every 5 minutes
- [ ] ⌘N shortcut (not functional)

## UX Improvements (discussed, not yet built)

- [ ] **Weekly Review — remove Monday-only gate** — Surface banner on Tue/Wed too until dismissed. A missed Monday means no review until next week.
- [ ] **Calendar — tap cycle opens CycleDetailSheet** — Tapping a cycle on the calendar grid currently does nothing. Should open the same CycleDetailSheet used on Today tab.
- [ ] **Templates — quick access from QuickAdd or Today** — Currently 3 navigations deep (area tab → Templates tab → Run). Needs a shortcut.
- [ ] Search highlight (no visual feedback on match location)
- [ ] Analytics tab (both modes — build after personal mode)
- [ ] iPhone widget `?mode=personal` (build after personal mode core)
- [ ] Work sidebar divider before Calendar/Analytics/Settings (do in Step 4)
