-- 019: Final plan structure — Demo/Base/Pro with browsing counters

-- 1. Add new columns to plans table
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS monthly_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS annual_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS annual_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS browsing_prompts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_browsing_prompts integer DEFAULT 0;

-- 2. Upsert plan data
INSERT INTO plans
(id, display_name, monthly_price, annual_price, annual_discount,
 browsing_prompts, no_browsing_prompts, max_models_per_project,
 max_comparisons, can_generate_queries, can_access_dataset,
 can_access_comparisons, is_active)
VALUES
('demo', 'Demo Gratuita', 0, 0, 0, 0, 40, 2, 0,
 false, false, false, true),
('base', 'Base', 59, 649, 8.3, 30, 70, 3, 0,
 true, false, false, true),
('pro', 'Pro', 159, 1719, 10, 90, 210, 5, 10,
 true, true, true, true)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  annual_discount = EXCLUDED.annual_discount,
  browsing_prompts = EXCLUDED.browsing_prompts,
  no_browsing_prompts = EXCLUDED.no_browsing_prompts,
  max_models_per_project = EXCLUDED.max_models_per_project,
  max_comparisons = EXCLUDED.max_comparisons,
  can_generate_queries = EXCLUDED.can_generate_queries,
  can_access_dataset = EXCLUDED.can_access_dataset,
  can_access_comparisons = EXCLUDED.can_access_comparisons;

-- 3. Add browsing counters to usage_monthly
ALTER TABLE usage_monthly
ADD COLUMN IF NOT EXISTS browsing_prompts_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_browsing_prompts_used integer DEFAULT 0;

-- 4. Migrate existing free users to demo plan
UPDATE profiles SET plan = 'demo' WHERE plan = 'free';
