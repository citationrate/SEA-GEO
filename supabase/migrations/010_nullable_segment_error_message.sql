-- Make segment_id nullable on prompts_executed (allows analysis without audience segments)
ALTER TABLE prompts_executed ALTER COLUMN segment_id DROP NOT NULL;

-- Add error_message to analysis_runs for crash diagnostics
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS error_message TEXT;
