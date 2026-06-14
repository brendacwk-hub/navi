# Habits — Feature Plan

## Scope of this folder
Work Mode habits only. Personal Mode habits live in `src/features/personal/habits/`.

---

## Work Mode Habits (from requirements)

| Habit | Emoji | Goal | Tracking |
|-------|-------|------|----------|
| Water | 💧 | ≥1 bottle/day | Tap to increment count |
| Standing desk | 🧍 | 1–2× per day | Tap to log each session |

- Both show as emoji dots on Calendar for the day completed
- In-app badge grows if not checked by a set time
- Push notification if still unchecked past reminder time

---

## Data model

```ts
interface HabitLog {
  date: string          // YYYY-MM-DD
  water: number         // count of bottles/taps
  standing: number      // count of sessions
}
```

Stored in Supabase table: `habit_logs`
- One row per day
- Upserted on every tap

---

## UI — HabitsTab (Work Mode)

### Layout (single screen, no sub-tabs)

```
┌─────────────────────────────────┐
│  Habits                         │
│  Today, Sat 14 Jun              │
│                                 │
│  ┌────────────┐ ┌────────────┐  │
│  │     💧     │ │     🧍     │  │
│  │   Water    │ │  Standing  │  │
│  │  ● ● ○ ○  │ │   ● ○ ○   │  │
│  │  2 / 4    │ │   1 / 2   │  │
│  │  [+ Tap]  │ │  [+ Tap]  │  │
│  └────────────┘ └────────────┘  │
│                                 │
│  ── This Week ──────────────    │
│  Mon  💧💧  🧍                  │
│  Tue  💧💧💧 🧍🧍               │
│  Wed  —                        │
│  Thu  💧  —                    │
│  Fri  —  —                     │
│  Sat  💧💧  🧍   ← today       │
│  Sun  —  —                     │
└─────────────────────────────────┘
```

### Tap card behaviour
- Tap the card or [+ Tap] → increments count for today
- Long-press or swipe → decrement (undo accidental tap)
- Dot indicators fill as count increases toward goal
- Goal met → card turns green + checkmark

---

## Personal Mode Habits (from requirements)

Tracked in `src/features/personal/habits/`.

| Habit | Emoji | Cadence | Notes |
|-------|-------|---------|-------|
| Exercise | 🏃 | Daily | Streak counter |
| Stretching | User-chosen | Daily | Streak counter |
| Supplements | 💊 | Daily | Simple tap |
| Skincare | 🪞 | Daily | Morning + evening optional |
| Water | 💧 | Daily | Same count mechanic as work |
| Crochet | 🪡 | Weekly | Weekly streak |
| Coding practice | 💻 | Weekly | Weekly target (e.g. 3×/week) |
| AI practice | 🧠 | Weekly | Weekly target |
| Investing practice | 📈 | Weekly | Weekly target |
| Social life | 👥 | Auto | From Google Calendar; nudge if >7 days |
| Family | ❤️ | Auto | From Google Calendar; nudge if >14 days |
| Health appointment | 🩺 | Annual | Reminder-driven |

All emojis user-configurable in settings.

---

## Build order

1. **Work habits** — simpler, 2 habits, no streaks, just daily count
   - `HabitsTab.tsx` — the tab view
   - `habit-context.tsx` — state + DB sync
   - Supabase table: `habit_logs`
   - Wire into sidebar (Work Mode)

2. **Personal habits** — richer, streaks, weekly targets, multiple habits
   - After Work habits are done and patterns are established

3. **Calendar dots** — after both modes are done

4. **Push notifications** — last (needs PWA service worker setup)

---

## Open questions before building

- Water goal: is 1 bottle the target, or do you want a configurable count (e.g. 4 glasses)?
- Standing desk: 1–2× target — should it show as done at 1, or only at 2?
- Reminder times: what time should the notification fire if not done?
- Should the weekly history show the full 7-day strip or just Mon–Fri for work habits?
