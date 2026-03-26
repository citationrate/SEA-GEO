-- Extend vouchers table to support different voucher types
-- Run on seageo1 (ubvkzstxviqwgufppiko)

-- Add type and credit columns
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS type text DEFAULT 'plan_upgrade',
ADD COLUMN IF NOT EXISTS extra_browsing_prompts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_no_browsing_prompts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_comparisons integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reset_usage boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS description text;

-- Types:
--   plan_upgrade      → upgrades user plan (uses existing 'plan' column)
--   query_credit      → adds extra query credits for current month
--   comparison_credit  → adds extra comparison credits
--   usage_reset       → resets all usage counters for current month
--   combo             → plan upgrade + credits + reset (uses all fields)

-- ═══════════════════════════════════════════════════════
-- Seed: 10 vouchers with various benefits
-- ═══════════════════════════════════════════════════════

-- 1. Demo → Base upgrade
INSERT INTO vouchers (code, plan, type, description, is_used)
VALUES ('AVIBASE2026', 'base', 'plan_upgrade', 'Upgrade gratuito al piano Base', false);

-- 2. Demo → Pro upgrade
INSERT INTO vouchers (code, plan, type, description, is_used)
VALUES ('AVIPRO2026', 'pro', 'plan_upgrade', 'Upgrade gratuito al piano Pro', false);

-- 3. Base → Pro upgrade
INSERT INTO vouchers (code, plan, type, description, is_used)
VALUES ('GOPRO2026', 'pro', 'plan_upgrade', 'Upgrade da Base a Pro', false);

-- 4. +100 query senza browsing
INSERT INTO vouchers (code, type, extra_no_browsing_prompts, description, is_used)
VALUES ('QUERY100', 'query_credit', 100, '+100 query senza browsing', false);

-- 5. +100 query con browsing
INSERT INTO vouchers (code, type, extra_browsing_prompts, description, is_used)
VALUES ('BROWSE100', 'query_credit', 100, '+100 query con browsing', false);

-- 6. +300 query mix (90 browsing + 210 no browsing — equivalente pacchetto Pro)
INSERT INTO vouchers (code, type, extra_browsing_prompts, extra_no_browsing_prompts, description, is_used)
VALUES ('QUERYPACK', 'query_credit', 90, 210, '+300 query (90 browsing + 210 standard)', false);

-- 7. +5 confronti extra
INSERT INTO vouchers (code, type, extra_comparisons, description, is_used)
VALUES ('COMPARE5', 'comparison_credit', 5, '+5 confronti competitivi', false);

-- 8. Reset completo utilizzo mensile
INSERT INTO vouchers (code, type, reset_usage, description, is_used)
VALUES ('RESETAVI', 'usage_reset', true, 'Azzera tutti i contatori del mese', false);

-- 9. Pro upgrade + reset utilizzo
INSERT INTO vouchers (code, plan, type, reset_usage, description, is_used)
VALUES ('PROFRESH', 'pro', 'combo', true, 'Upgrade a Pro + reset contatori', false);

-- 10. Pro upgrade + 100 query browsing + 5 confronti
INSERT INTO vouchers (code, plan, type, extra_browsing_prompts, extra_comparisons, description, is_used)
VALUES ('PROBOOST', 'pro', 'combo', 100, 5, 'Upgrade a Pro + 100 query browsing + 5 confronti', false);
