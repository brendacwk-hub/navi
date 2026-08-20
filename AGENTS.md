<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MANDATORY: Bug log rule

**Every bug fix must be recorded in `BUGS.md` before the session ends. No exceptions.**

Format:
```
### B-{next number} · {short title}
**Symptom:** what the user saw
**Root cause:** why it happened
**Fix:** what was changed and where
**Lesson:** what to never repeat
```

Number sequentially from the last entry. The current highest is B-66.
Before building any feature that touches an existing area, re-read the relevant BUGS.md entries first.

---

# Recurring cycle reset rules (B-109)

When writing or modifying `resetCycle()` or any function that resets a cycle to a fresh state:

1. **Always reset `status` explicitly.** Never rely on `{ ...cycle }` to carry the right status — a completed cycle has `status='complete'`, which silently kills it after `applyRecurrenceResets` fires. The correct reset is `{ ...cycle, status: 'upcoming' as const, ... }`.

2. **Always shift sub-item `due` dates forward.** Sub-item `due` dates are relative to the cycle's period. Resetting item `status` but not `due` leaves stale dates from the previous period, which makes items appear overdue immediately and breaks analytics. Use `inferInterval(triggerLabel)` + `shiftDueDate()` (both in `sort-utils.ts`) to advance each `due` by one recurrence interval.

3. **`applyRecurrenceResets` only fires when `nextDueAt` is set.** Cycles that are never fully completed (partial ticks only) never get `nextDueAt`, so `applyRecurrenceResets` never runs for them. Sub-item dates on such cycles must be fixed manually or via a one-time migration.

---

# Date-dependent `useMemo` in PWA views (B-109)

Any `useMemo` that filters or classifies data by "today's date" (`cyclesToday`, `chainItems`, etc.) must account for the app being backgrounded past midnight on iOS.

- `today = new Date()` is called fresh each render, but a memoized result only updates when its deps change.
- If the iOS app is kept alive in background and foregrounded the next day, no re-render fires unless triggered explicitly.
- **Pattern**: add a `visibilitychange` listener that calls `setDateKey(prev => now !== prev ? now : prev)` using `new Date().toDateString()`. Add this state to the component that holds the date-dependent memo, so foregrounding on a new day forces a re-render and the memo recalculates with the correct date.

---

# Due date / recurrence UI — consistency rule

**Every place where users set a due date or schedule must have identical options:**

1. **One-time** — presets (Today, Tomorrow, In 2 Days) + `<input type="date">` for custom dates. TemplatesView additionally has: Next Mon, End of Month, Next Month.
2. **Recurring** — `<RecurrencePicker>` from `@/shared/components/RecurrencePicker.tsx`.  
   Format stored in `triggerLabel`/`due`: `every [N] unit [on spec] from YYYY-MM-DD`  
   Examples: `every day from 2026-06-17` · `every 3 weeks from 2026-06-01` · `every week on mon,thu from 2026-06-17` · `every month on 15 from 2026-06-17`
3. **Mutual exclusivity** — picking a one-time date clears the recurrence string; picking a recurring option clears the one-time date.

**All five touchpoints must stay in sync:**
- `QuickAddButton` (add task / cycle)
- `CycleCard` (edit cycle)
- `ChecklistItem` (edit sub-task due date)
- `TemplateFormModal` in `TemplatesView` (template schedule)
- Any future date/schedule input

Never use a plain text `<input>` for scheduling. Never add a new date UI without adding `RecurrencePicker` alongside it.

# Personal Mode — architecture reference

## Areas
| Area | Key | Sub-areas |
|------|-----|-----------|
| Housework | `housework` | none |
| Sidoi | `sidoi` | Orders, Marketing, Planning |
| To Buy | `tobuy` | none |

`PersonalArea = 'housework' | 'sidoi' | 'tobuy'`

> **Note:** Finance (personal) was merged into Housework. The `personal-finance` key no longer exists as a separate area.

## Mode switching
- Header badge: single pill, 💼 Work / 🏠 Personal, tap to switch
- Switches URL between `/work/*` and `/personal/*`; remembers last page per mode (localStorage)
- Instant, no animation
- Header + sidebar background: `#0c0c0c` (work) → `#0e1628` navy (personal)
- Sidebar content swaps completely

## Personal sidebar order
Today → Housework → Sidoi → To Buy → [divider] → Diary → Calendar → Analytics → Settings (footer)

## Visual theme (Personal)
- Background: `#0e1628` (dark navy, from Stash app)
- Primary accent: `#f0a8c8` (soft pink)
- Borders/muted: `rgba(180,140,220,...)`
- Area accent colors: Housework `#fb7185` (coral) · Sidoi `#f9a8d4` (rose pink) · To Buy `#fcd34d` (amber)
- NOTE: NO PURPLE anywhere in personal mode or any other UI. User explicitly hates purple.

## Data layer
- All personal cycles stored in the same `cycles` table with `mode = 'personal'`
- `template_collections` — personal areas use distinct keys (`housework`, `sidoi`, `tobuy`)
- `diary_entries` table: `id` (YYYY-MM-DD PK), `mood` text, `prompts` jsonb, `body` text, `created_at` timestamptz
- DB migration: `ALTER TABLE cycles ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'work';`

## Shared vs isolated
- **Shared:** Calendar, Analytics, Settings (all appear in both sidebars)
- **Work-only:** Inbox, Habits (habit dots appear on shared Calendar)
- **Personal-only:** Diary tab
- **Isolated:** QuickAdd is mode-aware (personal mode = personal areas only); Calendar has NO QuickAdd
- **Search:** mode-aware (personal mode searches personal cycles only; work searches work only)

## Diary tab
- One entry per day; emoji mood picker (😄 🙂 😐 😔 😢) + prompted fields + free write
- **Gemini API** called live on every open — context passed: personality notes + today's GCal events + personal tasks completed + cross-mode busy day detection
- 50% basic rotating questions (no daily repeats) + 50% context-specific questions
- Scrollable past entries below today's entry (most recent first); past entries editable
- Daily push reminder at user-set time (Settings → Notifications → Diary reminder)
- Personality notes: `navi/personal/personality.md` (inside repo, traits + values + goals + routines)
- **Weekly Review**: mode-specific — Personal mode Monday review covers personal areas only; Work covers work only
- **Calendar**: shows personal cycles alongside work cycles and GCal events (personal cycles in pink/soft accent)

## Architecture decisions

**Mode detection:** URL-based. `/work/*` = work, `/personal/*` = personal, `/calendar|/settings|/analytics` = shared.
Header reads `usePathname()` to determine active mode for the badge pill.
`remember last page` stored in localStorage per mode — badge tap navigates to `localStorage.getItem('lastWork')` or `localStorage.getItem('lastPersonal')`.

**Layouts:** Separate `src/app/work/layout.tsx` and `src/app/personal/layout.tsx`. Both use the ONE shared `Sidebar.tsx` (receives mode from URL). Any structural Sidebar changes happen once.

**Shared pages:** `/calendar`, `/settings`, `/analytics` — top-level routes, no mode prefix. Both sidebars link here.

**Weekly Reviews DB:** Separate `personal_weekly_reviews` table (same schema as `weekly_reviews`, no mode column).

## Build order
1. DB migration (`mode` column on `cycles`)
2. `/personal/*` routes + layout
3. Header badge toggle (💼 Work / 🏠 Personal, single pill, instant switch)
4. Personal sidebar (navy theme, area nav, shared tabs section with divider)
5. Work sidebar: add divider before Calendar/Analytics/Settings
6. `PersonalDataContext` (mirrors WorkDataContext, reads `mode='personal'`)
7. Area tabs: Housework → Sidoi (Orders/Marketing/Planning) → To Buy
8. Personal Today (today's personal tasks, Weekly Review modal, no focus strip, no Coming Up)
9. Diary tab (Gemini prompts, mood picker, history, push reminder)
10. Templates for personal areas
11. Calendar: show personal cycles alongside work cycles

## QuickAdd in Personal mode
- Same Task / Task+ / Cycle types as Work mode
- Area selector shows: Housework / Sidoi / To Buy
- Calendar tab: no QuickAdd button

## Sidoi MVP
- Orders / Marketing / Planning are standard task tabs (Task / Task+ / Cycle)
- No special order-tracking UI for now; enhance in a future session

## iPhone widget
- Existing `?mode=work` shows work tasks (unchanged)
- New `?mode=personal` to show today's personal tasks (build after core personal mode)

## Components reused from Work mode (no changes needed)
CycleCard, ChecklistItem, RecurrencePicker, sort-utils, filter-utils, search-utils, QuickAddButton (area selector extended)
