-- Habit definitions: singleton row { id: 'singleton', habits: [...] }
CREATE TABLE IF NOT EXISTS habit_definitions (
  id         text        PRIMARY KEY,
  habits     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Habit logs: one row per day { id: 'YYYY-MM-DD', logs: { habitId: count } }
CREATE TABLE IF NOT EXISTS habit_logs (
  id         text        PRIMARY KEY,
  logs       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Missing columns on cycles table
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS sub_area          text;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS last_completed_at timestamptz;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS next_due_at       date;
