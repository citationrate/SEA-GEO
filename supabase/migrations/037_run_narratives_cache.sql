-- Cache for AI-generated brand narrative insights per run × language.
-- Avoids re-calling Claude Haiku every time a completed run is re-opened.
CREATE TABLE IF NOT EXISTS public.run_narratives (
  run_id UUID NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('it','en','fr','de','es')),
  insight_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, language)
);

-- FK to analysis_runs so the cache row is dropped when the run is deleted.
ALTER TABLE public.run_narratives
  ADD CONSTRAINT run_narratives_run_id_fkey
  FOREIGN KEY (run_id) REFERENCES public.analysis_runs(id) ON DELETE CASCADE;

-- No RLS policies: table is accessed exclusively via service client from API routes.
ALTER TABLE public.run_narratives ENABLE ROW LEVEL SECURITY;
