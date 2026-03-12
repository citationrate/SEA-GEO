-- Track monthly query usage per user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS queries_used_this_month INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS queries_reset_at TIMESTAMPTZ DEFAULT NOW();
