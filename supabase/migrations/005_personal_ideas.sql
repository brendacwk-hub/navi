CREATE TABLE IF NOT EXISTS personal_ideas (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  category   TEXT        NOT NULL DEFAULT 'Pending',
  title      TEXT        NOT NULL,
  body       TEXT,
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS personal_ideas_status   ON personal_ideas (status);
CREATE INDEX IF NOT EXISTS personal_ideas_category ON personal_ideas (category);
