-- ═══════════════════════════════════════════════════════
-- PayPal Integration — DB Changes
-- ═══════════════════════════════════════════════════════

-- ─── CitationRate Supabase (tzcxlchrcspqsayehrky) ───
-- Run these on the CitationRate project dashboard:
--
-- ALTER TABLE profiles
-- ADD COLUMN IF NOT EXISTS paypal_subscription_id text,
-- ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
-- ADD COLUMN IF NOT EXISTS subscription_plan text,
-- ADD COLUMN IF NOT EXISTS subscription_period text;
--
-- CREATE INDEX IF NOT EXISTS idx_profiles_paypal_sub_id
--   ON profiles(paypal_subscription_id)
--   WHERE paypal_subscription_id IS NOT NULL;

-- ─── seageo1 (ubvkzstxviqwgufppiko) ───
-- Run these on seageo1:

-- Add paypal_order_id and status to package_purchases
ALTER TABLE package_purchases
ADD COLUMN IF NOT EXISTS paypal_order_id text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

-- Index for looking up purchases by PayPal order ID
CREATE INDEX IF NOT EXISTS idx_package_purchases_paypal_order_id
  ON package_purchases(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;
