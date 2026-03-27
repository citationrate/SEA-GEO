-- Run on seageo1 (ubvkzstxviqwgufppiko) via SQL Editor
-- Adds Stripe payment tracking to package_purchases

ALTER TABLE package_purchases
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';
