-- Add configurable diary reminder hour to push subscriptions (0-23, default 21 = 9pm HKT)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS diary_reminder_hour int;
