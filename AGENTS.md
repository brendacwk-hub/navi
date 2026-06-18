<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
| Finance (personal) | `personal-finance` | none |
| Sidoi | `sidoi` | Orders, Marketing, Planning |
| To Buy | `tobuy` | none |

`PersonalArea = 'housework' | 'personal-finance' | 'sidoi' | 'tobuy'`

## Mode switching
- Header badge: single pill, 💼 Work / 🏠 Personal, tap to switch
- Switches URL between `/work/*` and `/personal/*`; remembers last page per mode (localStorage)
- Instant, no animation
- Header + sidebar background: `#0c0c0c` (work) → `#0e1628` navy (personal)
- Sidebar content swaps completely

## Personal sidebar order
Today → Housework → Finance → Sidoi → To Buy → [divider] → Diary → Calendar → Analytics → Settings (footer)

## Visual theme (Personal)
- Background: `#0e1628` (dark navy, from Stash app)
- Primary accent: `#f0a8c8` (soft pink)
- Borders/muted: `rgba(180,140,220,...)`
- Area accent colors: Housework `#6ee7b7` · Finance `#c4b5fd` · Sidoi `#f9a8d4` · To Buy `#fcd34d`

## Data layer
- All personal cycles stored in the same `cycles` table with `mode = 'personal'`
- `template_collections` — personal areas use distinct keys (`housework`, `sidoi`, `tobuy`, `personal-finance`)
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

## Build order
1. DB migration (`mode` column on `cycles`)
2. `/personal/*` routes + layout
3. Header badge toggle (💼 Work / 🏠 Personal, single pill, instant switch)
4. Personal sidebar (navy theme, area nav, shared tabs section with divider)
5. Work sidebar: add divider before Calendar/Analytics/Settings
6. `PersonalDataContext` (mirrors WorkDataContext, reads `mode='personal'`)
7. Area tabs: Housework → Finance → Sidoi (Orders/Marketing/Planning) → To Buy
8. Personal Today (today's personal tasks, Weekly Review modal, no focus strip, no Coming Up)
9. Diary tab (Gemini prompts, mood picker, history, push reminder)
10. Templates for personal areas
11. Calendar: show personal cycles alongside work cycles

## QuickAdd in Personal mode
- Same Task / Task+ / Cycle types as Work mode
- Area selector shows: Housework / Finance / Sidoi / To Buy
- Calendar tab: no QuickAdd button

## Sidoi MVP
- Orders / Marketing / Planning are standard task tabs (Task / Task+ / Cycle)
- No special order-tracking UI for now; enhance in a future session

## iPhone widget
- Existing `?mode=work` shows work tasks (unchanged)
- New `?mode=personal` to show today's personal tasks (build after core personal mode)

## Components reused from Work mode (no changes needed)
CycleCard, ChecklistItem, RecurrencePicker, sort-utils, filter-utils, search-utils, QuickAddButton (area selector extended)
