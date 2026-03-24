-- Add is_active column to queries table (default true)
-- Allows users to disable queries without deleting them
ALTER TABLE queries ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
