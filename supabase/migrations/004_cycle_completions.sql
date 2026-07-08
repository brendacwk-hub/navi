-- One row per cycle completion event.
-- Survives recurring resets — last_completed_at on cycles overwrites;
-- this table keeps the full history forever.
CREATE TABLE IF NOT EXISTS cycle_completions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id     TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  area         TEXT        NOT NULL,
  mode         TEXT        NOT NULL CHECK (mode IN ('work', 'personal')),
  sub_area     TEXT,
  effort       TEXT,
  due_date     DATE,
  recurring    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cycle_completions_mode_date
  ON cycle_completions (mode, completed_at DESC);

CREATE INDEX IF NOT EXISTS cycle_completions_cycle_id
  ON cycle_completions (cycle_id);
