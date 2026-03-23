-- Restrict Analyze URL and Analyze Contexts to Pro plan with monthly limits
-- Run in Supabase dashboard SQL editor

ALTER TABLE usage_monthly
ADD COLUMN IF NOT EXISTS url_analyses_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS context_analyses_used integer DEFAULT 0;

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS max_url_analyses integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_context_analyses integer DEFAULT 0;

UPDATE plans SET max_url_analyses = 0, max_context_analyses = 0
WHERE id IN ('demo', 'base');

UPDATE plans SET max_url_analyses = 50, max_context_analyses = 5
WHERE id = 'pro';
