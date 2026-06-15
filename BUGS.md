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

## Infrastructure

### B-10 · Vercel CDN caching stale API responses
**Symptom:** Code fixes were deployed but the app still served old cycle data because `/api/db` responses were cached.  
**Root cause:** Next.js server route was missing `export const dynamic = 'force-dynamic'` and the response lacked `Cache-Control: no-store`.  
**Fix:** Added both. Client-side `dbRead` fetch also uses `cache: 'no-store'`.  
**Lesson:** Any route that reads live DB data must be `force-dynamic` + `no-store`. Never assume Next.js doesn't cache your API routes.

---

## How to use this doc

- After every fix session, add a new entry here.
- Each entry must include: **symptom**, **root cause**, **fix**, **lesson**.
- Before building a new feature that touches triggers, seeding, or item structure — re-read the relevant entries first.
