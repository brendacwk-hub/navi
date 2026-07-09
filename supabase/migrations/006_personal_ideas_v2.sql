-- Add tags and sub_thoughts columns for the Ideas pipeline redesign.
-- tags: free-text array replacing fixed categories
-- sub_thoughts: inline bullet notes before converting to a full cycle

ALTER TABLE personal_ideas ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personal_ideas ADD COLUMN IF NOT EXISTS sub_thoughts jsonb DEFAULT '[]'::jsonb;
