-- Add today_order to user_preferences for cross-device drag-to-reorder sync
-- Format: { "date": "YYYY-MM-DD", "order": ["id1", "id2", ...] }
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS today_order jsonb;
