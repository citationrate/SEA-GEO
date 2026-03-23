-- Add site_analysis JSONB column to projects table
-- Run in Supabase dashboard SQL editor

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS site_analysis jsonb DEFAULT NULL;
