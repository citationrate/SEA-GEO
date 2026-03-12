-- Add notification preferences and preferred models to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notify_analysis_complete BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_competitor_alert BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preferred_models TEXT[] DEFAULT ARRAY['gpt-4o-mini', 'gemini-2.5-flash'];
