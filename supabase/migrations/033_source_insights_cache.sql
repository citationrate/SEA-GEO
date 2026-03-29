-- Cache AI insights on the projects table
-- Apply in Supabase Dashboard → SQL Editor
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_insights JSONB DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_insights_hash TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_insights_lang TEXT DEFAULT NULL;
