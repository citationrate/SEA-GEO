-- Soft delete for analysis runs
ALTER TABLE analysis_runs
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
