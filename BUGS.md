# Bug Log & Lessons Learned

A living document. Update after every fix session to avoid repeating the same mistakes.

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

## How to use this doc

- After every fix session, add a new entry here.
- Each entry must include: **symptom**, **root cause**, **fix**, **lesson**.
- Before building a new feature that touches triggers, seeding, or item structure — re-read the relevant entries first.
