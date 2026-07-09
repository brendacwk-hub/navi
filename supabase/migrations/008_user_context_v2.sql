-- Enrich user_context with mood trends, velocity, and calendar patterns.

ALTER TABLE user_context ADD COLUMN IF NOT EXISTS mood_trends      text;
ALTER TABLE user_context ADD COLUMN IF NOT EXISTS velocity_summary text;
ALTER TABLE user_context ADD COLUMN IF NOT EXISTS calendar_patterns text;
