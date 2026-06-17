<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Due date / recurrence UI — consistency rule

**Every place where users set a due date or schedule must have identical options:**

1. **One-time** — presets (Today, Tomorrow, This Week, Next Week) + `<input type="date">` for custom dates.
2. **Recurring** — `<RecurrencePicker>` from `@/shared/components/RecurrencePicker.tsx`.  
   Format stored in `triggerLabel`/`due`: `every [N] unit from YYYY-MM-DD`  
   Examples: `every day from 2026-06-17` · `every 3 weeks from 2026-06-01` · `every month from 2026-06-17`
3. **Mutual exclusivity** — picking a one-time date clears the recurrence string; picking a recurring option clears the one-time date.

**All five touchpoints must stay in sync:**
- `QuickAddButton` (add task / cycle)
- `CycleCard` (edit cycle)
- `ChecklistItem` (edit sub-task due date)
- `TemplateFormModal` in `TemplatesView` (template schedule)
- Any future date/schedule input

Never use a plain text `<input>` for scheduling. Never add a new date UI without adding `RecurrencePicker` alongside it.
