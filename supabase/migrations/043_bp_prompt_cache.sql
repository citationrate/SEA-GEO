-- Cross-brand cache for Brand Profile prompts that depend ONLY on
-- sector + country (Recognition #1, Recognition #2, Authority #1,
-- Authority #2). For these the AI's response is independent of the
-- brand being analyzed — running the same prompt for two different
-- brands in the same sector wastes spend.
--
-- Out of the 50 main calls in a Setup C-light run, ~20 (5 models ×
-- 4 prompts) are cacheable. With repeated audits in the same sector
-- (typical for an agency client base) this halves the main-call cost
-- after the first audit per sector.
--
-- TTL: 30 days. Long enough to amortize repeat audits within an
-- agency's monthly cadence, short enough that AI knowledge drift
-- (new models, fresh web data) refreshes the cache regularly.

CREATE TABLE IF NOT EXISTS brand_profile.prompt_cache (
  cache_key text PRIMARY KEY,
  prompt_text text NOT NULL,
  model text NOT NULL,
  country text NOT NULL,
  sector_normalized text NOT NULL,
  pillar text NOT NULL,
  response_raw text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL,
  last_hit_at timestamptz
);

-- Cleanup index: cron `DELETE WHERE expires_at < NOW()` runs daily
CREATE INDEX IF NOT EXISTS prompt_cache_expires_idx
  ON brand_profile.prompt_cache (expires_at);

-- Lookup index: admin diagnostics typically filter by
-- (model, country, sector, pillar). Primary key serves the hot path.
CREATE INDEX IF NOT EXISTS prompt_cache_lookup_idx
  ON brand_profile.prompt_cache (model, country, sector_normalized, pillar);

-- RLS: service-role only. The BP backend uses the service client; no
-- end user ever queries this table directly.
ALTER TABLE brand_profile.prompt_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE brand_profile.prompt_cache IS
  'Cross-brand cache for sector+country-only BP prompts (Recognition + Authority pillars). Saves ~20 main calls per audit when the sector has been seen recently. TTL 30 days. Service-role access only.';
