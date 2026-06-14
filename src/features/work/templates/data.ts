// Templates are now stored in Supabase (template_collections table).
// Run this SQL in your Supabase dashboard if the table doesn't exist:
//
// CREATE TABLE IF NOT EXISTS template_collections (
//   id text PRIMARY KEY,
//   templates jsonb NOT NULL DEFAULT '[]'::jsonb,
//   updated_at timestamptz DEFAULT now()
// );
