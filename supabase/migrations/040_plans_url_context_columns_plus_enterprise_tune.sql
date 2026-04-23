-- 040: Add the Pro/Enterprise analysis-limit columns on the unified plans
-- table and tune the Enterprise row.
-- Applied in prod 2026-04-23 via MCP.
-- Run in the Supabase SQL editor of project tzcxlchrcspqsayehrky (CitationRate).
--
-- Context: after the 2026-04-07 consolidation the `plans` table moved from
-- seageo1 to CitationRate as the single source of truth (see
-- SEA-GEO/lib/usage.ts header). The original SEA-GEO migration 023 had
-- added `max_url_analyses` and `max_context_analyses` on seageo1, but that
-- migration was never replayed on CR, so the unified table was missing the
-- two columns. The Enterprise row already existed but with values that
-- drifted from the UI (max_models_per_project=7 while the UI showed 10).

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_url_analyses integer,
  ADD COLUMN IF NOT EXISTS max_context_analyses integer;

-- Demo / Base: both features are Pro+ only.
UPDATE public.plans SET max_url_analyses = 0, max_context_analyses = 0
WHERE id IN ('demo', 'base');

-- Pro: carry over the values that lived on seageo1.
UPDATE public.plans SET max_url_analyses = 50, max_context_analyses = 5
WHERE id = 'pro';

-- Enterprise: unlimited URL analyses (NULL per usage.ts convention),
-- context analyses capped at 100/month, max 10 models/project aligned
-- with the UI in piano-client.tsx.
UPDATE public.plans SET
  max_url_analyses = NULL,
  max_context_analyses = 100,
  max_models_per_project = 10
WHERE id = 'enterprise';
