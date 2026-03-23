-- Extra token packages system
-- Run in Supabase dashboard SQL editor

-- 1. Packages catalog
CREATE TABLE IF NOT EXISTS packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  plan_required text REFERENCES plans(id),
  browsing_prompts integer DEFAULT 0,
  no_browsing_prompts integer DEFAULT 0,
  comparisons integer DEFAULT 0,
  price numeric NOT NULL,
  max_per_month integer DEFAULT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Seed packages
INSERT INTO packages VALUES
  ('base_100', '100 Query Extra', '+100 query senza browsing', 'base', 0, 100, 0, 19, 1, true, now()),
  ('base_300', '300 Query Extra', '+300 query senza browsing', 'base', 0, 300, 0, 49, 1, true, now()),
  ('pro_100',  '100 Query Extra', '+100 query (browsing incluso)', 'pro', 30, 70, 0, 29, NULL, true, now()),
  ('pro_300',  '300 Query Extra', '+300 query (browsing incluso)', 'pro', 90, 210, 0, 89, NULL, true, now()),
  ('pro_comp_3',  '3 Confronti Extra',  '+3 analisi competitive',  'pro', 0, 0, 3,  15, NULL, true, now()),
  ('pro_comp_5',  '5 Confronti Extra',  '+5 analisi competitive',  'pro', 0, 0, 5,  19, NULL, true, now()),
  ('pro_comp_10', '10 Confronti Extra', '+10 analisi competitive', 'pro', 0, 0, 10, 25, NULL, true, now())
ON CONFLICT (id) DO NOTHING;

-- 3. Purchase history
CREATE TABLE IF NOT EXISTS package_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  package_id text NOT NULL REFERENCES packages(id),
  period text NOT NULL,
  purchased_at timestamp with time zone DEFAULT now(),
  price_paid numeric NOT NULL
);

-- 4. Extra counters on usage_monthly
ALTER TABLE usage_monthly
  ADD COLUMN IF NOT EXISTS extra_browsing_prompts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_no_browsing_prompts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_comparisons integer DEFAULT 0;
