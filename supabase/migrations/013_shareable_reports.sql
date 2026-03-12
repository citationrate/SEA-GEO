-- Add share token support to analysis_runs
ALTER TABLE analysis_runs
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_analysis_runs_share_token ON analysis_runs (share_token) WHERE share_token IS NOT NULL;
