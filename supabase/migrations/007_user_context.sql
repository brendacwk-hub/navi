-- Nightly snapshot of longitudinal user patterns.
-- One singleton row, rebuilt by /api/context/snapshot each night.
-- Passed as context to all AI calls so Gemini knows who Brenda is over time.

CREATE TABLE IF NOT EXISTS user_context (
  id                  text PRIMARY KEY DEFAULT 'singleton',
  built_at            timestamptz,
  completions_summary text,  -- "8 sidoi (task1, task2); 3 finance (task3)"
  ideas_summary       text,  -- "1 ready: X. 2 developing: Y, Z. 4 new"
  shelved_patterns    text,  -- "Shelved: language idea, fitness idea"
  diary_themes        text   -- Gemini-extracted recurring themes from last 14 entries
);

INSERT INTO user_context (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
