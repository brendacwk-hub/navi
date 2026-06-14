-- Stores Google OAuth tokens (singleton row per app instance)
CREATE TABLE IF NOT EXISTS google_auth (
  id                    text PRIMARY KEY,
  access_token          text,
  refresh_token         text,
  token_expiry          timestamptz,
  email                 text,
  selected_calendar_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  calendar_colors       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at            timestamptz DEFAULT now()
);

-- Add calendar_colors if upgrading from an older schema
ALTER TABLE google_auth ADD COLUMN IF NOT EXISTS calendar_colors jsonb NOT NULL DEFAULT '{}'::jsonb;
