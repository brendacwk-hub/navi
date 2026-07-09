# Bug Log & Lessons Learned

A living document. Update after every fix session to avoid repeating the same mistakes.

---

### B-74 · IdeasView not filling full width on desktop
**Symptom:** On desktop/laptop, the Ideas tab capture bar appeared narrow in the bottom-left corner instead of spanning the full width. Empty state text was cut off on the left edge.
**Root cause:** IdeasView's root div used `h-full` instead of `flex-1`. PersonalShell wraps content in a flex ROW container — `h-full` sets height but doesn't expand the element horizontally. The view only took its natural content width, leaving the rest of the row empty.
**Fix:** Changed root div from `h-full flex flex-col` to `flex-1 flex flex-col` in `IdeasView.tsx`. `flex-1` expands both horizontally (fills the flex row) and vertically (via `align-self: stretch`).
**Lesson:** Any view inside PersonalShell (or WorkShell) must use `flex-1` on its root div, not `h-full`. `h-full` only works when the parent is a flex column — in a flex row parent, width comes from `flex-1`. Check DiaryView as the reference pattern.

---

### B-73 · Task created with "Today" due date not appearing in Today tab
**Symptom:** A task/task+ created from the + button with "Today" as the due date did not appear in the Today tab. It was visible on the category page (Finance/HR/etc.) but not on Today. After navigating to the category page and back, it would appear.  
**Root cause:** Date preset buttons (Today / Tomorrow / In 2 Days) used a toggle pattern: clicking a preset that was already selected cleared the date instead of keeping it. On the Today tab, `dueLabel` defaults to today's ISO date, so the "Today" pill appears highlighted. If the user tapped "Today" to confirm the selection, the toggle fired and cleared `dueLabel` to `''`. The task then saved with `triggerLabel = ''`, which fails `isTriggerDueToday` and is never shown on Today tab. Category pages show all active cycles regardless of trigger date, so the task appeared there.  
**Fix:** Removed the toggle behaviour from date preset buttons in `QuickAddButton.tsx`, `PersonalQuickAddButton.tsx`, and `TemplatesView.tsx`. Clicking a preset now always sets that date; to remove a date the user must use the "Clear" button.  
**Lesson:** Preset buttons that look "selected" must never deselect on re-click — that violates user expectation. Toggle-off belongs only on explicit Clear/Reset controls.

---

## Recurring / Persistent Bugs

### B-01 · Static cycles can have their trigger overwritten by stale DB values
**Symptom:** Budgets (a static cycle) appeared in Due Today every day — DB had `trigger_label: 'Today'` from a UI edit.  
**Root cause:** `loadFromSupabase` was spreading the raw DB row over the static definition, so DB values silently won.  
**Fix:** Merge logic now explicitly overrides `triggerLabel`, `effort`, `must`, `title`, `subArea`, `area` from the static `data.ts` definition. DB owns only item states, `nextDueAt`, `lastCompletedAt`, `notes`.  
**Lesson:** For static cycles, code is the source of truth. DB owns runtime state only. Never let a DB row overwrite a static field.

---

### B-02 · Literal `'Today'` trigger never expires
**Symptom:** User-created cycles with `trigger_label: 'Today'` appeared in Due Today every single day forever.  
**Root cause:** `isTriggerDueToday('Today', ...)` always returns `true`. QuickAdd was not calling `resolveLabel` before saving, so the literal string 'Today' went straight to DB.  
**Fix:** `QuickAddButton.handleSave` now calls `resolveLabel(dueLabel)` which converts 'Today' → ISO date (e.g. `'2026-06-14'`). Old stale cycles patched directly in DB.  
**Lesson:** Always call `resolveLabel()` before writing a triggerLabel to DB. Never store relative date strings ('Today', 'Tomorrow') — convert to ISO at save time.

---

### B-03 · Renamed cycle IDs cause stale references
**Symptom:** Finance tab "Monthly" chip filter stopped finding Budgets after the cycle was renamed from `'budgets'` to `'budgets-monthly'`.  
**Root cause:** `cadenceMap` in `FinanceTab.tsx` hardcoded the old ID `'budgets'`.  
**Fix:** Updated `cadenceMap` key to `'budgets-monthly'`.  
**Lesson:** When renaming a static cycle ID, search the whole codebase for the old ID. Check: `cadenceMap`, `staticTrigger` maps, any hardcoded references in components.

---

### B-04 · CycleCard edit form cannot clear the trigger label
**Symptom:** Once a trigger was set on a cycle, the user could not clear it — editing and saving with a blank due field would silently restore the original value.  
**Root cause:** `saveTitle` used `resolveLabel(editDue || cycle.triggerLabel || '')` — the `||` fallback to `cycle.triggerLabel` kicked in when `editDue` was empty.  
**Fix:** Changed to `resolveLabel(editDue)` — empty string is a valid "no trigger" choice.  
**Lesson:** Never use `editValue || originalValue` as a fallback when clearing is a valid operation. Only fall back if the field is required.

---

## Seeding / Data Mistakes

### B-05 · Tasks seeded as cycles (items: null)
**Symptom:** 3 items appeared as empty cycles with no checklist — "Mugen Reap Fraud", "Build subscription database", "Check ops@vibration.one".  
**Root cause:** Seed script created them with `items: null` instead of `items: [{ id, label: title, status: 'todo' }]`.  
**Fix:** Task = single item where `items[0].label === cycle.title`. Added correct item array to each.  
**Lesson:** A task is a cycle where `items[0].label === cycle.title`. Never seed a task with `items: null`.

---

### B-06 · HR Onboarding seeded as cycles instead of templates
**Symptom:** Onboarding (prep), Date onboard, Probation appeared as live cycles in the HR tab, not in Templates.  
**Root cause:** Seed script wrote them to the `cycles` table instead of `template_collections`.  
**Fix:** Deleted from `cycles`, inserted into `template_collections` under area `'hr'`.  
**Lesson:** Template items go in `template_collections`, not `cycles`. Templates are one-off boilerplates that users apply, not recurring work.

---

## UI / Display Bugs

### B-07 · "Add step" button added flat items on task-form cycles
**Symptom:** On cycles that are actually tasks (single item, item label = cycle title), clicking "Add step" appended a new top-level item instead of adding a sub-task indented under the first item.  
**Root cause:** `addCycleItem` in the context always appended to `cycle.items`, with no awareness of the task-form pattern.  
**Fix:** `addCycleItem` now detects the task-form (`items[0].label === cycle.title`) and appends to `items[0].subItems` instead. Button label also changed to "Add sub-task".  
**Lesson:** Check the task-form pattern whenever writing code that adds to cycle items. The first item IS the task — new items go under it as sub-tasks.

---

### B-08 · Monthly chain showed duplicate labels
**Symptom:** "Bank Statements" appeared 3 times in the monthly chain widget (Weekly, Monthly, Mid-Month variants all truncated to the same 2-word label).  
**Root cause:** Chain labels used `title.split(/\s+/).slice(0, 2).join(' ')` — all three "Bank Statements — X" variants collapsed to "Bank Statements".  
**Fix:** If title contains ` — `, use the text after the dash as the label. Otherwise fall back to first 2 words.  
**Lesson:** When generating short labels from titles, test with actual data. Em-dash suffixes are the convention for variants — use them.

---

### B-09 · Verbose trigger labels with parenthetical context
**Symptom:** MPF and HR Overhead Cost showed `'Last 5 days of month (after Payroll Phase 2)'` as their trigger — ugly in the card subtitle and chain.  
**Root cause:** The parenthetical was added to the trigger string itself to document dependencies, but the trigger is displayed verbatim.  
**Fix:** Removed the parenthetical from `triggerLabel`. If ordering notes are needed, put them in `notes`.  
**Lesson:** `triggerLabel` is displayed in the UI. Keep it short and human-readable. Use `notes` for dependency/sequencing context.

---

## Habit Tracker Bugs

### B-11 · Habit logs not visible in calendar
**Symptom:** Completed habits (water, standing desk) on June 15 showed no dots or details in MonthView or DayPopover.  
**Root cause (layout):** Habit dots row was at the bottom of each month cell with `flex-1` on the chip container, pushing dots below the cell boundary and clipping via `overflow-hidden`.  
**Root cause (data):** `DayPopover` had no habits display section — it only showed events and tasks.  
**Fix:** Moved habit dots to the top row (inline with the date number), removed `flex-1` from the chip container. Rewrote `DayPopover` to accept `habits` and `weekLogs` props and render a "Habits" section showing emoji, name, count/goal, ✓ for done. Also added habits display to `DayView`.  
**Lesson:** When integrating a new data type into a shared view (calendar), wire it all the way through — chip, popover, and day detail. Don't leave any view showing only partial data.

---

### B-12 · `todayKey()` used UTC time instead of local time
**Symptom:** For users in UTC+8 (HKT), between midnight and 08:00 local time, habit logs were keyed to yesterday's UTC date, causing a mismatch with calendar which used local time.  
**Root cause:** `todayKey()` called `new Date().toISOString()` which returns the UTC date string.  
**Fix:** Changed to use `getFullYear() / getMonth()+1 / getDate()` (local time methods).  
**Lesson:** Never use `toISOString().slice(0,10)` for date keys that must match local calendar dates. Always use local-time getters.

---

### B-13 · Habits did not reset to 0 on new day while app was open
**Symptom:** If the app was open across midnight, `todayLogs` still showed yesterday's habit counts on the new day.  
**Root cause:** `todayLogs` was only initialized once at app load from the DB; no mechanism detected day change.  
**Fix:** Added day-change detection: `setInterval(60s)` + `document.addEventListener('visibilitychange', check)` both call `check()` which compares current `todayKey()` to `lastKey`. On change, resets `todayLogs` to the new day's data (from `weekLogsRef` to avoid stale closures).  
**Lesson:** Habit/task apps that display "today" data must handle midnight crossover. Always pair a daily-reset mechanism alongside initial load. Use `useRef` for values the interval closure needs to read.

---

## Infrastructure

### B-21 · webPush.setVapidDetails() at module level crashed Vercel build
**Symptom:** Every deployment after adding push notifications failed with a 53s build error. No new deployments appeared for 4 commits. Local builds passed every time.  
**Root cause:** `webPush.setVapidDetails(process.env.VAPID_EMAIL!, ...)` was called at module top level in `/api/push/daily` and `/api/push/send`. At Vercel build time, `VAPID_EMAIL`, `VAPID_PRIVATE_KEY`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` don't exist (they're only in local `.env.local`). `web-push` validates its inputs immediately and throws, crashing module initialization before any handler runs.  
**Why it took 3 attempts:** The build passes locally because `.env.local` has the keys. Without direct access to Vercel's build log, two red herrings were investigated first: the `crons` field blocking webhooks (real but separate), and TypeScript errors (also real but separate). The module-level init was only identified by code inspection after both other theories were ruled out.  
**Fix:** Moved `webPush.setVapidDetails()` inside each request handler. It now only runs when a real request arrives, where env vars are guaranteed present.  
**Lesson:** Module-level code in API routes runs at build time where secrets don't exist. Any SDK init that validates env vars (throws on undefined) must live inside the handler, not at the top of the file. As a parallel safeguard: always add secrets to Vercel Environment Variables at the same time you add them to `.env.local`.

---

### B-10 · Vercel CDN caching stale API responses
**Symptom:** Code fixes were deployed but the app still served old cycle data because `/api/db` responses were cached.  
**Root cause:** Next.js server route was missing `export const dynamic = 'force-dynamic'` and the response lacked `Cache-Control: no-store`.  
**Fix:** Added both. Client-side `dbRead` fetch also uses `cache: 'no-store'`.  
**Lesson:** Any route that reads live DB data must be `force-dynamic` + `no-store`. Never assume Next.js doesn't cache your API routes.

---

## UX Bugs (session 4 power-user audit)

### B-14 · Monthly Chain hidden for half the month
**Symptom:** Monthly Chain section disappeared from Today view between the 6th and 16th of every month.  
**Root cause:** Date gate `showChain = dayOfMonth >= 17 || dayOfMonth <= 5` was intended to show chain only near month-close but also hid it mid-cycle.  
**Fix:** Removed the gate entirely. Chain is always visible when `chainItems.length > 0`. Items are already styled active/done/upcoming so context is clear.  
**Lesson:** Visibility gates in date-sensitive views need an escape hatch or should not exist at all.

---

### B-15 · QuickAdd form silently destroyed on backdrop tap
**Symptom:** Tapping outside the QuickAdd form while composing a multi-step cycle destroyed all work with no warning.  
**Root cause:** Backdrop `onClick` called `handleClose()` unconditionally.  
**Fix:** Changed backdrop `onClick` to `() => { if (!title.trim()) handleClose() }` — only closes when form is empty.  
**Lesson:** Mobile form backdrops must not destroy in-progress work. Guard on content before dismissing.

---

### B-16 · WeeklyReview hard-locked at exactly 3 focus items
**Symptom:** If user had fewer than 3 must/urgent cycles, they could not complete the Weekly Review — the Commit button stayed disabled.  
**Root cause:** `disabled={focusIds.length !== 3}` — strict equality check.  
**Fix:** Changed to `disabled={focusIds.length < 1}`. Now 1–3 items are all valid.  
**Lesson:** Minimum thresholds are good; hard-exact requirements usually aren't. Don't block users from completing a flow because their data is lighter than expected.

---

### B-20 · Global search missed Ops and Others cycles
**Symptom:** Searching "vendor", "expenses", or any Ops/Others cycle in the header search returned zero results even when cycles existed.  
**Root cause:** `GlobalSearchResults.tsx` only called `extractCycleResults` for `financeCycles` and `hrCycles`. `opsCycles` and `othersCycles` were not passed to the component.  
**Fix:** Added `opsCycles` and `othersCycles` from `useWorkData()` and included them in the results array. Added Ops and Others to `groupChip` colour map.  
**Lesson:** Any feature using a subset of work areas must be audited when new areas are added. Search components should import ALL areas from `useWorkData`.

---

### B-17 · ExternalLink button on checklist items did nothing
**Symptom:** Clicking the link icon on a checklist item with a URL had no effect.  
**Root cause:** Button had no `onClick`, no `href` — it was just a decorative icon.  
**Fix:** Added `onClick={() => window.open(item.url!, '_blank', 'noopener,noreferrer')}` and `title={item.url}` tooltip.  
**Lesson:** Any interactive-looking element must do something. Dead buttons erode trust.

---

### B-18 · Inbox capture bar always defaulted new items to Finance
**Symptom:** Capturing from Inbox always created a Finance-tagged item regardless of what you were working on.  
**Root cause:** `addItem()` in inbox-context.tsx hardcoded `area: 'finance'`.  
**Fix:** Added `area` parameter to `addItem(title, area = 'finance')`. Added area pill selector above the Inbox capture bar so users pick the area before capturing.  
**Lesson:** Defaults should match context or be explicitly choosable. A hidden default that's always wrong is worse than no default.

---

### B-19 · Today view: Must/Urgent cycles buried under plain tasks
**Symptom:** Recurring cycles marked Must or Urgent appeared after all plain tasks in Today view, regardless of priority.  
**Root cause:** Render order was always `visibleTasks` (plain) → `cyclesToday` (all cycles). No cross-type priority sort.  
**Fix:** Render order is now: must/urgent cycles → plain tasks → other cycles.  
**Lesson:** Priority flags (must, urgent) must be honored across all item types in a unified list view.

---

### B-22 · Progress counter included parent "header" item in task+ cycles
**Symptom:** A task+ cycle with 4 completed sub-tasks showed "4/5" instead of "4/4" — the parent item (whose label = cycle title) was counted alongside its own sub-tasks.  
**Root cause:** `countItems()` in `CycleCard.tsx` incremented `total` for every item regardless of whether it had sub-items. A parent with 4 sub-items counted as 5 (1 parent + 4 children).  
**Fix:** If an item has `subItems.length > 0`, skip counting the parent and count only its sub-items. Items with no sub-items count normally as a leaf.  
**Lesson:** Progress should count leaf tasks only. A parent item with sub-tasks is a grouping header, not a trackable unit — its completion is implicit when all its children are done.

---

### B-23 · Cycle with a due sub-task did not appear in Today tab
**Symptom:** Setting a due date on an individual checklist item (or sub-task) inside a cycle had no effect on Today tab visibility — the cycle only appeared if the cycle-level `triggerLabel` was due today.  
**Root cause:** `cyclesToday` in `TodayView.tsx` filtered exclusively on `isTriggerDueToday(c.triggerLabel)`. Per-item `due` fields on `ChecklistItem` were never evaluated.  
**Fix:** After the trigger check, also scan `c.items` and their `subItems` — if any has a `due` matching today, include the cycle.  
**Lesson:** "Due today" logic must operate at the item level, not just the cycle level. ChecklistItem already has a `due` field; any Today-tab filter must check it.

---

### B-24 · Task+ sub-task input: each typed character appeared on its own row
**Symptom:** Typing "send" in a sub-task input produced four separate rows — "s", "e", "n", "d" — each on its own line.  
**Root cause:** `handleSubChange` appended a new empty row whenever the user typed in the last input (`val.trim() !== ''`). A `useEffect` watching `subs.length` auto-focused the new empty row immediately after. So every keystroke: character lands → new empty row added → focus jumps to new row → next character lands there.  
**Fix:** Removed the auto-append from `handleSubChange`. New rows are now only added when the user presses **Enter** on the last input. The useEffect auto-focus on length change is now correct (only fires on Enter, not on every keystroke).  
**Lesson:** Never auto-append list rows on `onChange`. Row creation is an explicit user action (Enter / Add button). Combining auto-append with a focus-on-length-change effect creates a per-character row explosion.

---

### B-25 · Template search: step-label search silently failed
**Symptom:** Typing a keyword that appeared only in a template's step labels returned no results.
**Root cause:** `t.items.some(s => s.label.toLowerCase().includes(q))` threw a `TypeError` for any template where `items` was `undefined` (e.g., manually seeded rows). The uncaught error inside `useMemo` killed the filter silently, making all keyword-only searches return nothing.
**Fix:** Guard with `Array.isArray(t.items) && t.items.some(s => (s.label ?? '').toLowerCase().includes(q))`.
**Lesson:** Never call `.some()` on a JSON field from Supabase without an `Array.isArray` guard — legacy rows may lack the field entirely.

---

### B-26 · Pinch-to-zoom not fully prevented on iOS Safari
**Symptom:** App could still be pinch-zoomed despite `maximum-scale=1, user-scalable=no` in the viewport meta and `touch-action: manipulation` in CSS.
**Root cause:** iOS 10+ ignores `user-scalable=no`. CSS `touch-action: manipulation` prevents double-tap zoom but not multi-touch pinch zoom. No JS handler intercepted the `touchmove` event.
**Fix:** Added JS event listeners in `PortraitLock.tsx` (the always-mounted root client component): `touchmove` with `e.touches.length > 1 → preventDefault()`, `gesturestart`/`gesturechange` (Safari-specific), and `wheel` with `e.ctrlKey` (desktop Ctrl+scroll zoom). All applied globally without device detection.
**Lesson:** Viewport meta alone cannot prevent pinch zoom on modern iOS. Must combine with JS event listeners on `document`. Apply the same fix for both mobile and desktop — no device-specific code paths.

---

### B-27 · Sub-task due date picker missing custom date input + stores unresolved strings
**Symptom:** Sub-task (ChecklistItem) due date picker only showed 4 preset chips with no way to pick a custom date. The cycle header edit form had a full date picker. Presets stored raw strings ('Today') while the cycle header resolved them to ISO dates.
**Root cause:** `ChecklistItem.tsx` lacked an `<input type="date">` and called `onDueChange(item.id, preset)` with raw strings instead of running through `resolveLabel`.
**Fix:** Added `<input type="date">` to the due-date picker section. Preset clicks now call `resolveLabel(preset)` before saving, matching the cycle header behavior.
**Lesson:** Any UI that lets users set dates must include both presets and a custom date picker. Stored date strings must always be ISO format (resolved via `resolveLabel`) for consistent Today-tab filtering.

---

### B-28 · Completed cycles stayed visible with a "show completed" toggle
**Symptom:** After marking a cycle complete, it remained in the list (hidden behind a "N completed — show" button), never archived.
**Root cause:** `updateCycle` with `status: 'complete'` only updated the in-memory state and synced to the `cycles` table. No archival or removal logic existed.
**Fix:** `updateCycle` now detects `status: 'complete'` on a non-recurring cycle → writes to `completed_tasks` table → deletes from `cycles` → removes from in-memory list. On first load, any pre-existing completed non-recurring cycles in `cycles` are migrated to `completed_tasks`. Completed titles are loaded into context and fed into the QuickAdd suggestion corpus.
**Lesson:** "Archive on complete" must be implemented at the data layer, not the view layer. The "show completed" toggle pattern is a code smell — completed tasks should be moved, not just filtered.

---

### B-29 · "This Week" preset on Friday computed +5 days instead of 0
**Symptom:** Setting due date to "This Week" on a Friday produced a date 5 days ahead (the following Wednesday) instead of staying on that same Friday.
**Root cause:** `resolveLabel('This Week')` used `((5 - base.getDay() + 7) % 7) || 5`. When today is already Friday (day 5), the expression evaluates to 0; `0 || 5` falls back to 5, adding 5 days instead of 0.
**Fix:** Removed the `|| 5` fallback. The expression now correctly returns 0 when today is already the target day. "This Week" was subsequently removed entirely from all preset arrays.
**Lesson:** Never use `expr || fallback` to handle a zero result when zero is a valid and expected value. Use an explicit check (`=== 0 ? 0 : expr`) instead.

---

### B-30 · Unchecking an item on a recurring done cycle did not clear nextDueAt
**Symptom:** After a recurring cycle reached all-items-done (nextDueAt was set), unchecking any one item visually un-completed it but the cycle remained locked in the "done" state. The UI still showed it as complete.
**Root cause:** `toggleItem` only handled the "just became fully done" path. There was no "un-done" branch to detect when a cycle with `nextDueAt` set had an item unchecked, making it no longer fully complete.
**Fix:** Added un-done branch in `work-data-context.tsx`: when `isRecurring && changed.nextDueAt && !allCycleDone(changed)` → clear `nextDueAt` from both state and DB.
**Lesson:** Whenever you add a "completion" state flag (`nextDueAt` acting as a done marker), you must also handle the reverse path when the user un-does an action that set the flag.

---

### B-31 · Weekday-specific recurrence had no UI (e.g. "Every Mon & Thu")
**Symptom:** RecurrencePicker offered no way to select specific weekdays for weekly recurrence — only "every N weeks" was supported.
**Root cause:** The UI had no weekday toggle row. The stored format had no `on` clause.
**Fix:** Added a Row 2 weekday toggle (Sun–Sat) visible when unit=week. At least one day must remain selected. Extended RECURR_RE with optional `(?:\s+on\s+([a-z0-9,]+))?` group. New stored format: `every week on mon,thu from DATE`. Added `nextWeekdayOnOrAfter` and `nextWeekdayStrictlyAfter` helpers with N-week alignment via `getMondayOf`. Updated `isTriggerDueToday`, `computeSortDate`, and `computeSkipDate` for weekday on-spec.
**Lesson:** N-week alignment must use `getMondayOf(start)` as the anchor and advance by N×7 days per iteration — not just count any matching weekday.

---

### B-32 · Month-day recurrence had no UI (e.g. "Every month on the 15th")
**Symptom:** Monthly recurrence fired on the same calendar day as the start date with no way to pin it to a specific day or "last day of month."
**Root cause:** RecurrencePicker had no month-day selector. The stored format had no `on` clause for months.
**Fix:** Added "on the [dropdown: 1st–31st + last day]" row visible when unit=month. Extended RECURR_RE and parsers. New stored format: `every month on 15 from DATE` or `every month on last from DATE`. Added `nextMonthDayOnOrAfter` and `nextMonthDayStrictlyAfter` with N-month alignment. Updated `isTriggerDueToday`, `computeSortDate`, and `computeSkipDate`.
**Lesson:** "Last day of month" requires a special string sentinel ("last") since the integer varies per month. Always clamp the target day to `maxDay` for months shorter than 31 days.

---

### B-33 · RECURR_RE group index shift broke date parsing after adding on-spec group
**Symptom:** After adding the optional `(?:\s+on\s+([a-z0-9,]+))?` capture group to RECURR_RE, code that read `m[3]` for the date was now reading the on-spec string (e.g., "mon") as a date, producing Invalid Date for any weekday recurrence.
**Root cause:** Adding a new capture group shifted the date group from m[3] to m[4]. Both `sort-utils.ts` and `RecurrencePicker.tsx` had hardcoded group indices that were not updated.
**Fix:** Updated all references: m[1]=N (optional), m[2]=unit, m[3]=on-spec (optional), m[4]=date. Both files verified to use m[4] for the date.
**Lesson:** When inserting a new capture group into a regex, immediately audit every use of m[1]..m[N] in both the same file and all files that import the regex. Optional groups shift all subsequent group indices.

---

### B-34 · "In 2 Days" replaced ambiguous "This Week" preset
**Symptom:** "This Week" was unclear — especially for end of week vs. beginning of next week context, and especially problematic on Fridays/weekends.
**Fix:** Replaced "This Week" with "In 2 Days" across all four due-date touchpoints (QuickAddButton, CycleCard, ChecklistItem, TemplatesView). "In 2 Days" uses `addWeekdays(today, 2)` which skips Saturday and Sunday. "Next Week" also removed from task touchpoints (kept only in TemplatesView for longer-horizon planning presets).
**Lesson:** Date presets should be unambiguous. Business-day–aware helpers (`addWeekdays`) prevent surprises around weekends.

---

### B-35 · allCycleDone checked parent status before sub-items (Task+ auto-complete bug)
**Symptom:** Checking off all sub-tasks from the Today tab did not auto-archive the parent cycle. The cycle remained visible with the "Overdue" badge even after 1/1 sub-tasks were ticked.  
**Root cause:** `allCycleDone` in `sort-utils.ts` evaluated `item.status !== 'done'` first. For Task+ items, the parent ChecklistItem status stays `'todo'` when sub-items are toggled — only the sub-item status changes. So the function always returned `false` for any parent item, blocking the auto-archive path in `toggleItem`.  
**Fix:** Moved subItems check BEFORE parent status check. If an item has subItems, evaluate only those (leaf-only). Leaf items with no subItems use their own status. Matches the progress bar counting logic exactly.  
**Lesson:** "Done" for a parent item with sub-tasks means all sub-tasks are done — the parent's own status field is irrelevant. Any completeness check must be leaf-only.

---

### B-36 · Birthdays calendar not appearing in Settings calendar list
**Symptom:** Google Calendar's Birthdays calendar never appeared in Settings → Calendar selector, even with `showHidden: true` in the API call.  
**Root cause:** The Birthdays calendar (`#contacts@group.v.calendar.google.com`) is a special Google system calendar that is not automatically included in `calendarList.list()` results. It must be explicitly inserted into the user's calendar list via `calendarList.insert()` before it can be fetched.  
**Fix:** In `GET /api/calendar/calendars`: after fetching the list, if the Birthdays calendar ID is absent, call `calendarList.insert({ requestBody: { id: BIRTHDAYS_ID } })` then re-fetch and return the updated list. Subsequent calls return it normally.  
**Lesson:** Some Google Calendar system calendars (Birthdays, Contacts) do not auto-appear in calendarList.list(). Must be explicitly inserted. Wrap the insert in try/catch to handle the 409-conflict case (already in list).

---

### B-37 · Ops and Finance tabs missing ··· overflow trigger button
**Symptom:** Ops and Finance tabs had `overflowOpen` state and dropdown content, but no button to actually open the dropdown — the ··· button existed only in HRTab.  
**Root cause:** The ··· button was added to HRTab but not backported to FinanceTab and OpsTab during the overflow refactor.  
**Fix:** Added `<button onClick={() => setOverflowOpen(o => !o)}>···</button>` to both FinanceTab and OpsTab, matching the HRTab pattern exactly.  
**Lesson:** When adding a UI pattern to one area tab, search for the same state setup (`overflowOpen`) in all other tabs and apply the same fix.

---

### B-38 · Today tab filter used item-level due dates as override (not additive)
**Symptom:** A cycle with `triggerLabel = '2026-06-18'` (today) did not appear in Today tab when any of its incomplete items had an explicit `due` date set to a future date.  
**Root cause:** Commit cb50883 changed the filter from additive ("show if trigger is today OR any item is due today") to override ("if items have due dates, use earliest as effective date — falls back to trigger only if NO items have dates"). A cycle due today with even one item scheduled for next week would be hidden.  
**Fix:** Restored trigger-first logic: check cycle-level trigger first (always shows if due today or overdue). Item-level due dates are additive — they surface additional cycles with no trigger, but never override a trigger that already fires today.  
**Lesson:** Cycle-level trigger and item-level due dates serve different purposes. Trigger = "when to surface this cycle." Item due = "when a specific step must be done." Never let item dates override the cycle's visibility trigger.

---

### B-40 · Accidentally completed cycles had no recovery path on mobile
**Symptom:** When all sub-tasks were checked and a cycle auto-completed, it disappeared instantly with no way to undo on mobile (the "Reopen" button only existed on desktop hover).  
**Root cause:** Auto-archive fired immediately in `toggleItem` with no undo window; completed cycles were stored in `completed_tasks` but only accessible via Supabase directly.  
**Fix:** Two-part: (1) Auto-archive now delays DB writes by 5 seconds and shows a toast with an "Undo" button — clicking undo cancels the timer, restores the cycle in state, and re-syncs to DB. (2) Settings → Completed Tasks archive: fetches `completed_tasks` table on load, shows entries newest-first, each with a Reopen button that re-inserts into `cycles` and removes from `completed_tasks`.  
**Lesson:** Any destructive auto-action needs an undo window. 5 seconds is enough for the "oops" case; the Settings archive is the safety net for anything that slipped through.

---

### B-39 · Sub-tasks in Task+ / Templates had no drag-to-reorder
**Symptom:** When editing a Task+ cycle or a Template, sub-tasks / steps could only be reordered by deleting and re-adding them — there was no drag handle.  
**Root cause:** Feature not yet built. Items were rendered as a plain list with no sortable wrapper.  
**Fix:** Added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. In `CycleCard.tsx`, wrapping the items list in `DndContext + SortableContext + SortableItemRow` (with `GripVertical` drag handle) when `editingTitle === true`. In `TemplatesView.tsx`, same pattern for the steps list in `TemplateFormModal` (always available). `updateCycle` updated to accept `items` in its patch so reordered items persist to DB.  
**Lesson:** Touch-compatible drag on iPhone Safari requires both `PointerSensor` and `TouchSensor` from @dnd-kit — `PointerSensor` alone does not fire on touch-only devices.

---

### B-41 · Google Calendar Birthdays calendar not appearing in Settings
**Symptom:** Birthdays calendar did not appear in the Settings calendar list. Removing the 2-calendar selection limit (first fix attempt) didn't resolve it because the calendar wasn't in the list to begin with.  
**Root cause (first layer):** `toggleCalendar` had a hard cap of 2 selected calendars — removed in `ec7822a` but re-introduced when SettingsTab was rewritten.  
**Root cause (second layer):** The calendar route only tried ONE Birthdays calendar ID (`#contacts@group.v.calendar.google.com`). Google uses different IDs depending on account type (`contactsbirthdays@contacts.google.com` is another common form). If the insert failed, the catch block silently discarded the error and returned the original list — no Birthdays calendar.  
**Fix:** (1) Removed 2-calendar limit. (2) Route now tries BOTH known Birthdays IDs in sequence; also checks the existing list for any calendar with "birthday" in the summary (case-insensitive) before attempting inserts. First successful insert triggers a refetch; if neither ID works, original list is returned.  
**Lesson:** Google Calendar system calendar IDs are account/region dependent. Always try multiple known IDs and fall back to name-based detection. Never swallow insert errors without at least trying the next option.

---

### B-42 · Completed Tasks archive in Settings shows nothing
**Symptom:** Settings → Completed Tasks section always showed "No completed tasks yet" even after tasks were completed.  
**Root cause (first layer):** The `completed_tasks` table was never created in Supabase. `loadArchive` silently returned `[]` when the API returned 400, making it indistinguishable from "empty table".  
**Root cause (second layer):** `loadArchive` only queried `completed_tasks` — it never scanned `cycles WHERE status='complete'` for tasks that were completed before the archive table existed or before the migration logic ran.  
**Root cause (third layer):** `reopenTask` re-inserted into `cycles` without `mode: 'work'`, so reopened tasks were filtered out by the mode filter and disappeared.  
**Fix:** (1) `archiveTableMissing` state shows the `CREATE TABLE` SQL inline when the API returns an error. (2) `loadArchive` now ALSO fetches `cycles WHERE status='complete'` and merges results (deduplicating by id), so any un-migrated historical completed tasks appear immediately. (3) `reopenTask` now handles both sources (`_source: 'completed_tasks'` vs `_source: 'cycles'`) and always writes `mode: 'work'` when reinserting. (4) SQL added to README.md.  
**Lesson:** An archive feature must scan ALL places the data could live, not just the primary archive table. Historical data may be stranded in the source table if migration didn't complete. Always include `mode` when writing back to `cycles`.

---

### B-43 · Mode badge switches to Work when navigating to shared tabs from Personal mode
**Symptom:** When in Personal mode and tapping Calendar, Analytics, or Settings (all shared `/work/*` routes) from the PersonalSidebar, the header badge switched from "🏠 Personal" to "💼 Work". Navigating away from the shared page left the app in Work mode.  
**Root cause:** `ModeBadge` derived `isPersonal` purely from `pathname.startsWith('/personal')`. Shared pages live under `/work/*` so the badge always read Work there. Additionally, `PersonalSidebar` shared-page links were plain `<Link>` elements that didn't save `lastPersonal` before navigating — so tapping the mode badge from a shared page would try to restore a stale personal destination.  
**Fix:** (1) `ModeBadge` now tracks `navi_mode` in localStorage. When on a personal page, writes `navi_mode='personal'`. When on a non-shared work page, writes `navi_mode='work'`. When on a shared page (`/work/settings`, `/work/calendar`, `/work/analytics`), reads `navi_mode` to show the correct badge without overwriting it. (2) `PersonalSidebar` shared links are now `<button>` elements with a `handleSharedLink` handler that saves `lastPersonal = pathname` before navigating — ensuring the badge's "switch to personal" action returns to the correct personal page.  
**Lesson:** "Shared" pages need a mode-neutral identity. The cleanest long-term fix would be moving them to top-level routes (`/settings`, `/calendar`) so they have no mode prefix at all. The localStorage workaround works, but moving them to top-level routes avoids the need for it.

---

### B-44 · Work cycles not loading after mode filter added (empty work mode)
**Symptom:** After deploying personal mode infrastructure, all work cycles disappeared — the Finance, HR, Ops, Others tabs showed empty.  
**Root cause:** `WorkDataContext.loadFromSupabase` was changed to `dbRead('cycles', { col: 'mode', val: 'work' })`. If this returns 0 rows (e.g., mode column not yet backfilled via SQL migration, or Supabase filter error), the code fell into the `else` branch which seeded the DB but never called any `set*Cycles` setter — leaving React state empty. The UI would show blank area tabs.  
**Fix:** (1) Added a fallback: if the mode-filtered read returns 0 rows, try fetching all cycles without filter and keep those with `!mode || mode === 'work'`. Backfills `mode='work'` in DB for any rows missing it. (2) Fixed the `else` branch (first-ever load) to call `setFinanceCycles(initFinance)` and `setHrCycles(initHr)` so initial cycles appear immediately without needing a page refresh. (3) Applied the same fallback to `refreshData`.  
**Lesson:** When adding a new DB filter to an existing query, always handle the zero-results case explicitly — both "truly empty" and "filter returned nothing because migration not applied" must set state. Never let an else branch write to DB without also updating React state.

---

### B-45 · Settings/Calendar/Analytics from Personal mode switched user to Work layout
**Symptom:** Clicking Settings (or Calendar, Analytics) from the PersonalSidebar navigated to `/work/settings` etc., which are under the Work layout — so the Work sidebar was shown. Clicking "Today" in that Work sidebar sent the user to Work Today instead of Personal Today.  
**Root cause:** The B-43 fix only tracked mode in localStorage and updated the badge, but the LAYOUT was still determined by the route prefix (`/work/*` = Work layout). PersonalSidebar linked shared pages to `/work/*` routes, so the full shell swapped to Work on navigation.  
**Fix:** Created dedicated personal-layout routes: `/personal/settings`, `/personal/calendar`, `/personal/analytics` (calendar and analytics are "Coming soon" placeholders; settings renders the shared `SettingsTab`). Updated all PersonalSidebar links to point to these personal routes. All links now use `<Link>` (no `handleSharedLink` needed). Users stay in the PersonalShell + PersonalSidebar when navigating these sections from personal mode.  
**Lesson:** The only true fix for layout isolation is route isolation. localStorage badges can mask the problem visually but don't change which shell Next.js renders. If a page must work in both modes, it either needs a top-level route with a mode-aware shell, or two separate route-tree copies under `/work/*` and `/personal/*`.

---

### B-46 · Birthdays calendar appears blank or undetectable if ID format differs
**Symptom:** Even after inserting the Birthdays calendar via the API (B-41 fix), some accounts returned it with `summary: null` — appearing as a blank nameless entry in the Settings calendar list. Also, IDs containing "birthday" or the `contacts+calendar` pattern were not detected by `isBirthdaysCalendar`.  
**Root cause:** `toCalItem` passed `c.summary` through directly with no null fallback, so a null-summary calendar rendered as empty text. `isBirthdaysCalendar` only checked two exact IDs and a name-contains check on summary — it missed ID-level substring detection.  
**Fix:** `toCalItem` now falls back to `'Birthdays'` for any birthday-identified calendar with a null summary, and to the raw `c.id` for any other null-summary calendar. `isBirthdaysCalendar` now also checks if the lowercased ID contains "birthday", or if it contains both "contacts" and "calendar" — covering additional account-specific ID variants.  
**Lesson:** Third-party calendar APIs can return null for display-name fields on system calendars. Always provide a meaningful fallback name based on the ID type, not just the summary field.

---

### B-47 · Archive always empty — both completed_tasks table and status column never existed
**Symptom:** Settings → Completed Tasks always showed "No completed tasks yet" even after completing cycles via the UI. The "Log task" form also appeared to save but nothing appeared.  
**Root cause (first layer):** The `completed_tasks` table was never created in Supabase (confirmed by B-42 lesson, which described the fix but the SQL migration was never run). All writes to `completed_tasks` silently failed with 404.  
**Root cause (second layer):** The B-42 "fix" switched from `completed_tasks` to writing `status='complete'` into the `cycles` table. But the `status` column was also never added to `cycles` via `ALTER TABLE` migration. Every `cycles upsert { status: 'complete' }` was silently ignored by Supabase (unknown column = ignored in JSONB-like behavior or silent error).  
**Root cause (third layer):** `toggleItem` completion path had a 5-second timer before writing. If the user navigated to Settings within 5 seconds, the DB write hadn't happened yet, so archive was empty regardless.  
**Fix:** Use `today_tasks` table as the archive store — this table is confirmed to exist (it holds the singleton today-task list). Archive entries are written as `{ id: 'completed-{cycleId}', data: { ...task } }`. Written IMMEDIATELY on completion (not after 5 seconds). Undo deletes the archive entry. `loadFromSupabase` reads ALL today_tasks rows and builds `completedArchiveIds` to filter the active cycle list. `loadArchive` reads all today_tasks and filters for `id.startsWith('completed-')` as the primary source.  
**Lesson:** Never write to a table or column that hasn't been explicitly confirmed to exist in production Supabase. Always verify schema changes are applied before building features on top of them. For archive features, use a table that is already in use (like today_tasks), not a newly-promised table. Write archive entries IMMEDIATELY — don't delay writes behind undo windows.

---

### B-48 · Birthday events don't appear in Calendar tab despite calendar being selected
**Symptom:** After selecting the Birthdays calendar in Settings (discovered via events.list() probe), no birthday events appeared on the Calendar tab.  
**Root cause:** The Google Birthdays system calendar (`#contacts@group.v.calendar.google.com`) is a special calendar whose events are stored as all-day recurring events. When fetching with `orderBy: 'startTime'`, this calendar may fail silently (return empty or 400) because `orderBy: 'startTime'` behaves differently for all-day-only calendars than for mixed timed/all-day calendars. The error was caught silently (`catch { return [] }`), so 0 events were returned with no visible error.  
**Fix:** Detect birthday calendar IDs (`BIRTHDAY_IDS.includes(calId) || calId.toLowerCase().includes('birthday')`) and omit `orderBy: 'startTime'` for those specifically. `singleEvents: true` is still used (required to expand recurring annual birthday events into current-year instances). The probe in `calendars/route.ts` correctly omits `orderBy`, so aligning the event-fetch to match the probe parameters.  
**Lesson:** Google system calendars (Birthdays, Contacts) may not support all events.list() parameters that regular calendars support. When a special calendar works in a probe but not in the full fetch, check whether extra parameters (`orderBy`, `timeZone`, etc.) are causing a silent failure. Always inspect what parameters the probe uses vs. the full fetch. Silent `catch { return [] }` hides these failures — add `console.error` to distinguish "no events in range" from "API error".

---

### B-49 · Due date presets stored plain strings instead of ISO dates — input and highlight broken

**Symptom:** Tapping Today / Tomorrow / In 2 Days in QuickAdd, CycleCard, PersonalQuickAdd, or TemplatesView visually highlighted the button but the `<input type="date">` beside it stayed blank. The task did save with the correct date (because `resolveLabel()` was called at save time), but the input and the selected-button highlight were desynced. Users could not see what date had been picked.
**Root cause:** Preset click handlers stored the raw label string (`"Today"`, `"Tomorrow"`) in state. The date input has a regex guard `^\d{4}-\d{2}-\d{2}$` — plain label strings fail it, so the input always rendered empty. The active-highlight check (`dueLabel === d`) worked on first tap but broke as soon as the user re-opened an edited cycle (which had an ISO date, not the label string). ChecklistItem already did it right — it called `resolveLabel(preset)` before saving.
**Fix:** All four touchpoints now call `resolveLabel(d)` at click time, not at save time. Toggle check updated to `prev === resolveLabel(d)`. TemplatesView input condition simplified (no longer needs to exclude preset strings since state is always ISO). QuickAddButton init and reset also updated from `'Today'` to `resolveLabel('Today')`.
**Files:** `QuickAddButton.tsx`, `CycleCard.tsx`, `PersonalQuickAddButton.tsx`, `TemplatesView.tsx`
**Lesson:** Always store resolved ISO dates in state, never label strings. `resolveLabel()` must be called at the moment the user picks a value — not deferred to save time. The input and the state must always agree on format.

---

### B-50 · Analytics page horizontally pannable in Safari — content clipped on left

**Symptom:** The analytics page could be panned left/right in Safari on iPhone. When panned slightly right, the left edge of every card was clipped off ("TION RATE", "KS DONE" etc. instead of "COMPLETION RATE"). The 2-column featured card grid was too cramped on mobile widths.
**Root cause:** An overflow-causing element (likely the heatmap or SVG chart) made the page wider than the viewport. Safari then treated the page as horizontally scrollable. The outer wrapper had `overflow-y-auto` but no horizontal containment. No `touch-action` restriction was set, so both axes were pannable.
**Fix:** Outer wrapper got `overflow-x-hidden` + `touch-action: pan-y` (vertical scroll only). `MetricCard` got `overflow-hidden` so no child chart can bleed outside its card boundary. Featured card grid changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` so cards stack full-width on iPhone. Zero-value bars in BarChart raised from 2px to 4px floor with faint opacity so empty weeks are visible as stubs.
**Lesson:** On Safari iOS, any element wider than the viewport makes the whole page horizontally pannable — even if the overflow is invisible. Always pair `overflow-x-hidden` with `touch-action: pan-y` on page wrappers for app-like views. Test horizontal overflow on actual iPhone, not just desktop browser DevTools.

---

### B-51 · Family and Birthdays calendars showing in Settings calendar selector

**Symptom:** Settings → Select Calendars showed "Family" and "Birthdays" calendars. User never uses them. They cluttered the selector and the Birthdays probe logic was adding noise.
**Root cause:** The `/api/calendar/calendars` route returned all calendars from Google's `calendarList` without filtering out system/social calendars the user doesn't want.
**Fix:** Added `isFamilyCalendar()` (matches IDs starting with `family` + `@group.calendar.google.com`) and combined with existing `isBirthdaysCalendar()` into `isHiddenSystemCalendar()`. Applied filter in the GET handler before returning. Also removed the Birthdays probe loop since Birthdays are now always excluded.
**Lesson:** Always filter out known-unused system calendars at the API layer, not the UI layer. If a calendar is never wanted, don't fetch it, don't probe for it, don't add complexity around it.

---

### B-52 · Ideas sidebar entry navigated nowhere — tapping the label only toggled expand

**Symptom:** Tapping "Ideas" in the PersonalSidebar only toggled the subcategory list open/closed. It never navigated to `/personal/ideas`.
**Root cause:** The Ideas row was a plain `<button onClick={() => setIdeasExpanded(e => !e)}>` with no `href`. The label was never wrapped in a `<Link>`.
**Fix:** Split the row into two interactive elements: a `<Link href="/personal/ideas">` for the icon + label (navigates + forces expand), and a separate `<button>` for the chevron (toggles collapse only).
**Lesson:** Any sidebar entry that has sub-items must have TWO separate tap targets: the parent label (navigates to parent route) and the chevron (toggles the sub-list). Never make the whole row a toggle-only button if it has a valid destination.

---

### B-53 · Diary "New questions" always returned the same questions on same day

**Symptom:** Tapping "↻ New questions" fetched new prompts from Gemini but returned the same two questions every time on the same day.
**Root cause:** Q1 was computed as `BASE_QUESTIONS[dayOfYear % BASE_QUESTIONS.length]` — deterministic by date only, no randomness. Q2 was generated by Gemini from the same fixed context, so with `temperature: 0.85` it could vary slightly but Q1 was always identical. The `promptsFetched` ref guard was reset correctly, but the API had no way to know a refresh was requested.
**Fix:** Added `refreshSeed` state to `DiaryView`. `refreshPrompts()` increments it and passes `&seed=${newSeed}` to the API. The API reads `?seed=N` and computes `(dayOfYear + seed) % pool.length` — shifting the rotation index on every refresh. Gemini prompt also notes "this is refresh #N — do NOT repeat the question already shown" when seed > 0.
**Lesson:** Any "refresh / get new" feature that calls a deterministic endpoint needs a client-controlled seed or nonce to break the determinism. Don't rely on `temperature` alone for variety — vary the input.

---

### B-54 · "New questions" button overlapping the first diary prompt on mobile

**Symptom:** In prompt mode, the "↻ New questions" button visually overlapped the first question text on iPhone.
**Root cause:** The button container had `className="flex justify-end -mb-1"` — the negative bottom margin pulled the following question upward into the button's space.
**Fix:** Changed `-mb-1` to `mb-1` (positive margin) so the button has breathing room above the first question.
**Lesson:** Negative margins as layout micro-adjustments are fragile on mobile — they can look fine at one viewport but overlap on smaller screens. Prefer positive padding/margin on the element below instead.

---

### B-55 · Payroll phases never auto-activated — all phases shown collapsed in Today

**Symptom:** Payroll appeared in the Today tab on its trigger dates but all 3 phases showed as collapsed headers with no items visible. The user had to manually tap each phase to expand it, making the cycle look empty/broken.
**Root cause:** Each `CyclePhase` has a `status` field (`upcoming | active | locked`). `PhaseSection` only auto-opens (`useState(true)`) when `phase.status === 'active'`. But nothing ever transitioned phases from `'upcoming'` to `'active'` — the DB had all 3 phases as `'upcoming'` since initial seeding. The phases each have their own `triggerLabel` (`Starts 20th of month`, `Last 5 days of month`, `1st work day of next month`) but `WorkDataContext` never read those to activate phases.
**Fix:** Added `applyPhaseActivation(cycle, today)` in `work-data-context.tsx`. Runs after `applyRecurrenceResets` on every load and refresh. For each phase with `status === 'upcoming'`, checks its `triggerLabel`: "Starts Nth" → activates if `dom >= N`; "Last N days" → activates if in last-5-days window; "1st work day" → activates only on the exact day (via `isTriggerDueToday`). Writes updated phases to DB. `resetCycle()` already reverts phases to `'upcoming'` on next cycle start so the reset path is unaffected.
**Lesson:** Phases need their own trigger-based lifecycle. Just having a `triggerLabel` on a phase means nothing unless something actually reads it and transitions the status. Anytime a data model has a status field, there must be code that transitions it based on conditions.

---

### B-56 · Must recurring cycles disappeared after trigger day with unfinished items

**Symptom:** `budgets-monthly` appeared on June 20 (trigger day), user ticked 6/7 items. On June 21 the cycle disappeared from Today even though item `bm4` ("Allocate funds + mark records") was still unfinished. Payroll similarly vanished June 21-24 (trigger was June 20, item due dates not until June 25).
**Root cause:** `cyclesToday` filter used `isTriggerDueToday(trigger, today)` — exact date match only. On June 21, "Every 20th of month" returns `dom === 20` → false. Items with no due dates can't trigger the fallback due-date check either. So the cycle was hidden despite incomplete items. There was no "stay visible until done" logic.
**Fix:** Added `hasTriggerFiredThisPeriod(trigger, today)` to `sort-utils.ts`. Returns true if the trigger has already fired at some point in the current period (e.g. dom >= 20 for "Every 20th", or within last-5-days window). In `TodayView.tsx` `cyclesToday` filter, cycles with `must: true` AND `isRecurring` AND `!nextDueAt` use this sticky check — they remain visible until all items done (at which point `nextDueAt` is set and the cycle hides naturally).
**Lesson:** Monthly trigger dates fire once per month. Any cycle with work that takes multiple days needs "sticky" visibility after the trigger day. `isTriggerDueToday` alone is insufficient for multi-day Must tasks — pair it with a period-aware "has fired this period" check. Non-Must cycles intentionally don't get this treatment (they're optional; appearing on the exact trigger day is correct).

---

### B-58 · "New questions" button still overlapping question area; API generated only 2 prompts including a generic "Anything else" Q2

**Symptom:** (1) The "New questions" button sat inside the scrolling section immediately above Q1, too close to the first question even after the previous `-mb-1` → `mb-1` fix. (2) API generated only 2 questions; Q2 was often "Anything else on your mind today?" — either from the Gemini fallback path or because Gemini lacked day context. User wanted 3 distinct prompted questions (Q1–Q3) plus a separate hardcoded "anything else" field as Q4.
**Root cause:** Button placement was inside `section.space-y-4` rather than the header, so it always rendered adjacent to Q1. API prompt asked for `exactly 2` questions; fallback hardcoded `'Anything else on your mind today?'` as Q2; Gemini prompt gave no explicit rule against generic questions.
**Fix:** (1) Moved "New questions" button into the page header (right side), replacing the `✨ Prompt` mode badge — cleaner and always visible regardless of scroll. (2) Updated API prompt to request `exactly 3` questions, added explicit rule "Never generate 'Anything else on your mind?' or any catch-all question". Updated fallback to rotate 3 answers from `BASE_QUESTIONS` using `+1`/`+2` offsets. Updated `slice(0, 3)` and `maxOutputTokens: 400`. Added 3rd loading skeleton row in DiaryView.
**Lesson:** Fallback values must follow the same quality rules as the live path — never hardcode generic phrases like "Anything else on your mind?" that would be rejected in the main path. Action buttons belong in persistent header chrome, not embedded in scrollable content.

---

### B-57 · User-set due dates on active one-off cycles wiped on every reload

**Symptom:** `bcom-admin-duties` (due 2026-06-30) and `ai-accounting-system` (due 2026-07-02) never appeared in Today on their due dates. The DB had the correct `trigger_label` values written by the user via the UI, but the cycles never showed up.
**Root cause:** The static-to-DB merge in `WorkDataContext` (`loadFromSupabase` and `refreshData`) unconditionally overwrote `triggerLabel` from the static cycle definition. Both cycles have `triggerLabel: ''` in their static definitions (they're one-off active projects, not recurring). Every reload replaced the user's manually-set due date with `''`, making `isTriggerDueToday` always return false.
**Fix:** Changed both merge sites in `work-data-context.tsx` from `triggerLabel: s.triggerLabel` to `triggerLabel: s.triggerLabel || row.triggerLabel`. Static wins when it has a value (preserving recurring schedule integrity); DB value is kept when static is empty (preserving user-set one-off due dates).
**Lesson:** Static override is correct for recurring cycles (code is source of truth). But one-off active cycles have empty static triggers — the user must be able to set their own due date and have it persist. Never unconditionally override with a potentially-empty value from static data.

---

### B-59 · Unstarted recurring cycles appearing via sticky logic on every non-trigger day

**Symptom:** `bank-statements-monthly` ("Every 2nd of month") appeared in Today on June 26 even though no items had ever been started (0/3 items done). It should only appear on the 2nd.
**Root cause:** The sticky-visibility check in `TodayView.tsx` (`isStickyActive`) activates when `hasTriggerFiredThisPeriod` returns true — for "Every 2nd", that means `dom >= 2`, which is true from June 2 onwards. There was no guard to prevent unstarted cycles from being shown via sticky; the logic was originally designed for in-progress cycles that need to stay visible after their trigger day.
**Fix:** Added `hasStarted = allItems.some(i => i.status === 'done')` in the `cyclesToday` filter before the sticky check. `isStickyActive` now requires `must && isRecurring && !nextDueAt && hasStarted && hasTriggerFiredThisPeriod`. Unstarted cycles only appear on their exact trigger day via `isTriggerDueToday`; sticky only activates once the user has touched at least one item.
**Lesson:** Sticky "stay visible" logic is only meaningful for in-progress work. An unstarted recurring cycle should appear exactly once on its trigger day and then disappear until the user acts on it. Always gate sticky/carry-over behavior on `hasStarted` — otherwise cycles with past trigger dates become permanently visible background noise.

---

### B-60 · Scriptable widget: personal habits hijacking top row, hiding calendar events

**Symptom:** When home had no tasks but had uncompleted personal habits, the top row showed "Home 🏃📚🍎" instead of the calendar event. Events were invisible despite existing in the iOS calendar.
**Root cause:** The top-row condition was `if (homeEmpty && homeUndone.length > 0) { show habits }` — this branch had priority over the `else if (calEvents.length > 0)` event branch. So events were silently dropped whenever home was empty with pending habits.
**Fix:** Complete rewrite of widget layout logic (v9). Events now always occupy the top row when they exist. Personal habits move into the Work column header when the Home column is hidden (homeEmpty). Symmetric logic added for workEmpty (Home full-width, work habits in Home header). Also added: smart event selection (next upcoming / last of day), amber colour for event text, coloured bar from `shownEvent.calendar.color`, and S6 centred emoji screen.
**Lesson:** Top-row slot must follow a strict priority: event > habits. Never let a secondary indicator (habits) silently displace the primary one (events). Layout decisions for all edge cases should be drawn and confirmed before coding.

### B-61 · "Due Today" tasks showing "Overdue · 1d" after midnight

**Symptom:** Tasks set as "Due Today" via any due-date preset displayed "Overdue · 1d" the next calendar day in the user's timezone (HKT, UTC+8).
**Root cause:** `resolveLabel` in `sort-utils.ts` used `d.toISOString().slice(0, 10)` to build the stored ISO date. `toISOString()` always returns UTC. Since `base = new Date(); base.setHours(0,0,0,0)` sets local midnight, in HKT that is 16:00 UTC of the *previous* calendar day — so "Today" stored `2026-06-28` while the actual local date was `2026-06-29`. The next time `fmtTrigger` ran, `d < today` was true and `days = 1`.
**Fix:** Changed `iso` helper in `resolveLabel` to use local date parts: `` `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` ``. All presets (Today, Tomorrow, In 2 Days, etc.) now store the correct local date.
**Lesson:** `toISOString()` is always UTC. Any code that converts a local-time `Date` to a `YYYY-MM-DD` string for user-facing features must use `getFullYear()` / `getMonth()` / `getDate()` (local) — not `toISOString()`.

### B-62 · Payroll Phase 2 p2b subItems not showing after static update

**Symptom:** After adding `subItems` to item `p2b` in `hr/data.ts`, the payroll cycle still showed the flat item with no sub-tasks in the app.
**Root cause:** Both merge sites in `work-data-context.tsx` (`loadFromSupabase` and `refreshData`) spread `...row` from the DB row first, then only overwrote `triggerLabel`, `effort`, `must`, `title`, `subArea`, `area`. The `phases` field was left as-is from the DB. The DB's stored phases JSON predated the `subItems` addition, so the new subItems on `p2b` were silently discarded every load.
**Fix:** Added `mergePhases(staticPhases, dbPhases)` helper. Uses static phases as the structural template (items, subItems, labels, flags); overlays only `status` fields from the DB (phase status, item status, subItem status). Applied in both merge sites: `phases: s.phases ? mergePhases(s.phases, row.phases) : row.phases`.
**Lesson:** DB owns *state* (statuses, completion timestamps); static code owns *structure* (which items/subItems exist, their labels). The merge must always apply structure from static and status from DB — not blindly prefer one source. Whenever items or subItems are added to a static cycle, the DB rows for existing cycles will lag behind until a merge-aware load is performed.

### B-63 · Completed cycles reappear on their tab after reopening the app

**Symptom:** User marks a cycle as "Done ✓" (all items ticked, clicks Done). It disappears from the tab. On next app open, it reappears showing "Overdue · Xd".
**Root cause:** `updateCycle` correctly removes the cycle from in-memory state and writes `status: 'complete'` to the DB. But both `loadFromSupabase` and `refreshData` read ALL cycles from DB (regardless of status) and set them back into `financeCycles`/`hrCycles`/etc. with no status filter. The `status: 'complete'` cycle was silently re-injected on every load.
**Fix:** Added `const activeCycles = allCycles.filter(c => c.status !== 'complete')` before the four `setXxxCycles` calls in `loadFromSupabase`, and the same in `refreshData`. Completed cycles stay in the DB (for the Settings archive to read), but never enter the active cycle lists.
**Lesson:** Whenever a "remove from state" operation writes a tombstone flag to DB (`status: 'complete'`), the load path must explicitly exclude that flag. Removing from in-memory state is not enough — the DB read on next load will undo it without a corresponding filter.

### B-64 · Edits to cycles (title, effort, must, subArea) lost on every reload

**Symptom:** User edits a cycle's title, effort, must toggle, or sub-area via the UI. Change saves fine and shows immediately. On next page load or pull-to-refresh, all edits revert to the original values.
**Root cause:** `loadFromSupabase` and `refreshData` both merged static data (`initFinance`/`initHr`) back on top of every DB row using field-level static-wins: `title: s.title, effort: s.effort, must: s.must, subArea: s.subArea, triggerLabel: finalTrigger`. This was originally intended to ensure recurring schedules in code always propagated to users, but it silently overwrote all user edits on every load.
**Fix:** Removed all static field overrides from both merge sites. Only `phases` is still merged from static (via `mergePhases`), which is needed so sub-task additions in code appear correctly. DB now owns all user-editable fields after initial creation.
**Lesson:** Static data should seed the DB once on first insert, then DB owns the data. Static-wins on every load defeats the purpose of a DB-backed app. Keep static overrides only for structural fields the user cannot edit (like phase sub-task labels), not for user-facing fields.

### B-65 · Timezone bug: `toISOString().slice(0,10)` returns UTC date, not local
**Symptom:** In UTC+8 (HKT), after midnight local time but before midnight UTC, `applyRecurrenceResets` computes yesterday's date. Recurring cycles reset a day late.
**Root cause:** `new Date().toISOString()` returns UTC time. `slice(0,10)` gives the UTC date, which is one day behind local date between midnight local and midnight UTC in positive-offset timezones.
**Fix:** Replaced with local date parts: `` `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` `` in both `work-data-context.tsx` and `personal-data-context.tsx`.
**Lesson:** Never use `toISOString().slice(0,10)` for local date strings. Use `getFullYear/getMonth/getDate` which respect local timezone.

### B-72 · Work Coming Up was hidden when Due Today had items; personal Coming Up items not clickable
**Symptom:** Work Today "Coming Up" section only appeared when nothing was due today, not as a persistent section below Due Today. Personal Coming Up timeline rows were plain divs — tapping them did nothing.
**Root cause:** Work `ComingUpSection` was wrapped in `{totalDueToday === 0 && !query && ...}` conditional. Personal timeline rows used `<div>` with no onClick or cursor styling.
**Fix:** Work — replaced old single-card `ComingUpSection` with a new timeline-list component (date badge + title + sub-area label + MUST flag + color dot), removed the `totalDueToday === 0` guard, passes `cyclesTodayIds`, `todayStr`, `onOpen` props, each row calls `setSheetCycle`. Personal — changed `<div>` rows to `<button>` with `onClick={() => setSheetCycle(c)}`, added `CycleDetailSheet` import and `sheetCycle` state, sheet uses live-derived cycle (B-68 pattern).
**Lesson:** Coming Up should always be visible alongside Due Today, not as a fallback. Interactive list rows must always be buttons or have explicit cursor/onClick.

### B-66 · Audit fixes: diverged logic between work and personal contexts
**Symptom:** PersonalTodayView was missing (a) sticky recurring logic — must cycles that fired their trigger this period wouldn't stay visible after first day; (b) search filter — query bar had no effect on personal today; (c) two-tier sort — recurring and non-recurring cycles mixed randomly; (d) mergePhases — DB phase structure overwriting static for personal finance cycles.
**Root cause:** Work and personal parallel files drifted over multiple sessions. Fixes applied to work context were not ported to personal.
**Fix:** PersonalTodayView — added `isStickyActive`, `hasTriggerFiredThisPeriod`, `useSearch`, `fuzzyMatch`, recurring-aware nextDueAt filter, two-tier sort. personal-data-context — added `mergePhases` function and applied in `loadFromSupabase`. Also fixed `new Date(str+'T00:00:00')` UTC-parse in TodayView, widget route, widget page, CycleCard `fmtTrigger`. Extracted shared `getHabitCount` from TodayView and PersonalTodayView into `habit-context.tsx`.
**Lesson:** When fixing logic in one parallel context, always port the fix to its mirror immediately. Add a TODO comment or audit note so drift doesn't accumulate silently.

### B-70 · Personal completed cycles deleted from DB; no QuickAdd suggestions
**Symptom:** Personal completed cycles were permanently deleted from the `cycles` table (not kept for analytics/diary). Personal QuickAdd had no autocomplete suggestions from past tasks.
**Root cause:** `personal-data-context` used `cycles DELETE` on completion instead of `cycles UPSERT status=complete` (like work context). No `completedTitles` state existed. `PersonalQuickAdd` had no suggestion corpus at all.
**Fix:** (1) `updateCycle` and `toggleItem` now upsert `status: 'complete'` to cycles instead of deleting. (2) Added `completedTitles` state, populated on load from `cycles WHERE mode=personal AND status=complete` and updated on each completion. (3) `loadFromSupabase` filters active cycles before setting state. (4) `PersonalQuickAdd` now builds a suggestion corpus from active + completed titles and shows a chip strip when ≥2 chars are typed.
**Lesson:** Personal and work contexts must stay in sync. Any "archive on complete" feature must keep the row in DB with status=complete — never delete. Suggestions are only possible if titles are accumulated across sessions.

### B-69 · Completed cycles stayed visible in area tabs
**Symptom:** After marking a task complete (or ticking all sub-tasks on a recurring cycle), the cycle still appeared in Finance/HR/Ops/Others/personal area tabs.
**Root cause:** The area tab filter functions (sortedFiltered useMemo) had no guard for `status === 'complete'` or `nextDueAt`. Non-recurring completed cycles were already removed from context state, but recurring cycles that completed their current period have `nextDueAt` set and stay in state — they were leaking through with no view-layer filter to hide them.
**Fix:** Added `if (cycle.status === 'complete' || cycle.nextDueAt) return false` at the top of the filter in FinanceTab, HRTab, OpsTab, OthersTab, and PersonalTabLayout.
**Lesson:** Any list view of active cycles must explicitly filter out both `status === 'complete'` (non-recurring archived) and `nextDueAt` (recurring done-for-this-period). The data layer only removes non-recurring cycles; view-layer guards are needed for recurring ones.

### B-68 · Sub-task ticks not saving in CycleDetailSheet
**Symptom:** Tapping a sub-task checkbox inside the cycle detail sheet appeared to do nothing — ticks wouldn't persist visually.
**Root cause:** `TodayView` stored the clicked cycle in `sheetCycle` state as a snapshot. When `toggleItem` updated `allCycles` in the data context, `sheetCycle` still held the old object, so `CycleCard` re-rendered with stale data and the tick appeared to revert.
**Fix:** Replaced `cycle={sheetCycle}` with `cycle={sheetCycle ? (allCycles.find(c => c.id === sheetCycle.id) ?? sheetCycle) : null}` in `TodayView.tsx` (line 798), so the sheet always receives the live cycle from `allCycles`.
**Lesson:** Never pass a click-time snapshot as a long-lived prop to a sheet/modal that needs to reflect mutations. Always derive the current object from the live data source using the ID.

### B-67 · isStickyActive never fired for personal recurring cycles
**Symptom:** Recurring personal cycles that had been started (some items done) would disappear from Personal Today after their trigger day, even though work wasn't finished.
**Root cause:** `isStickyActive` in PersonalTodayView had a stray `c.must &&` condition copied from the work context. Personal cycles don't use the `must` flag, so the condition was always false.
**Fix:** Removed `c.must &&` from the `isStickyActive` expression in `PersonalTodayView.tsx`.
**Lesson:** When porting logic from work to personal context, audit every flag condition — personal and work cycles don't share the same flag conventions.

---

## How to use this doc

**MANDATORY RULE:** Every bug fixed must be logged here. This is a build record, not optional cleanup.

- Add a new entry immediately after each fix, while context is fresh.
- Each entry must include: **symptom**, **root cause**, **fix**, **lesson**.
- Number sequentially (next is B-74).
- Before building a new feature that touches an area — re-read relevant entries to avoid repeating past mistakes.
