-- Add per-model attribution to sources so the same domain can be filtered by AI model.
-- Applied directly to the live SEA-GEO Supabase project on 2026-05-09 — this file
-- exists as the canonical record of that schema change.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS model text;

-- Replace UNIQUE(project_id, domain) with UNIQUE(project_id, domain, model)
-- so the same domain cited by different models is preserved as separate rows.
-- NULLS NOT DISTINCT keeps legacy backfill rows (model IS NULL) deduped together.
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_project_domain_unique;
ALTER TABLE sources
  ADD CONSTRAINT sources_project_domain_model_unique
  UNIQUE NULLS NOT DISTINCT (project_id, domain, model);

CREATE INDEX IF NOT EXISTS idx_sources_project_model ON sources(project_id, model);
