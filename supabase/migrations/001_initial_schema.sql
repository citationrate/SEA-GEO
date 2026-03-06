-- ============================================================
-- SeaGeo — Schema Iniziale
-- File: supabase/migrations/001_initial_schema.sql
-- Come usare:
--   1. Vai su supabase.com → il tuo progetto
--   2. Clicca "SQL Editor" nel menu a sinistra
--   3. Incolla tutto questo file e clicca "Run"
-- ============================================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE funnel_stage    AS ENUM ('tofu', 'mofu', 'bofu');
CREATE TYPE source_type     AS ENUM ('explicit', 'mentioned', 'inferred', 'none');
CREATE TYPE segment_name    AS ENUM ('beginner', 'researcher', 'professional', 'buyer', 'custom');
CREATE TYPE analysis_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE ai_model AS ENUM (
  'gpt-4o', 'gpt-4o-mini',
  'claude-3-5-sonnet',
  'gemini-1.5-pro',
  'grok-2',
  'perplexity-sonar',
  'copilot'
);
CREATE TYPE user_plan AS ENUM ('free', 'pro', 'agency');

-- ============================================================
-- PROFILES
-- Si crea automaticamente quando un utente si registra
-- ============================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  plan        user_plan NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: crea il profilo in automatico al signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  target_brand        TEXT NOT NULL,
  known_competitors   TEXT[] NOT NULL DEFAULT '{}',
  market_context      TEXT,
  language            TEXT NOT NULL DEFAULT 'it' CHECK (language IN ('it', 'en')),
  country             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ============================================================
-- QUERIES
-- ============================================================

CREATE TABLE queries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  funnel_stage  funnel_stage NOT NULL DEFAULT 'tofu',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queries_project_id ON queries(project_id);

-- ============================================================
-- AUDIENCE SEGMENTS
-- ============================================================

CREATE TABLE audience_segments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            segment_name NOT NULL DEFAULT 'custom',
  label           TEXT NOT NULL,
  prompt_context  TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_project_id ON audience_segments(project_id);

-- ============================================================
-- ANALYSIS RUNS
-- ============================================================

CREATE TABLE analysis_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL DEFAULT 1,
  status              analysis_status NOT NULL DEFAULT 'pending',
  models_used         ai_model[] NOT NULL DEFAULT '{}',
  run_count           INTEGER NOT NULL DEFAULT 3,
  total_prompts       INTEGER NOT NULL DEFAULT 0,
  completed_prompts   INTEGER NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_project_id ON analysis_runs(project_id);
CREATE INDEX idx_runs_status     ON analysis_runs(status);

-- ============================================================
-- PROMPTS EXECUTED
-- (ogni singola chiamata a un modello AI)
-- ============================================================

CREATE TABLE prompts_executed (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id            UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  query_id          UUID NOT NULL REFERENCES queries(id),
  segment_id        UUID NOT NULL REFERENCES audience_segments(id),
  model             ai_model NOT NULL,
  run_number        INTEGER NOT NULL CHECK (run_number BETWEEN 1 AND 10),
  full_prompt_text  TEXT NOT NULL,
  raw_response      TEXT,
  response_length   INTEGER,
  executed_at       TIMESTAMPTZ,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompts_run_id ON prompts_executed(run_id);
CREATE INDEX idx_prompts_model  ON prompts_executed(model);

-- ============================================================
-- RESPONSE ANALYSIS
-- (risultati estratti da ogni risposta AI)
-- ============================================================

CREATE TABLE response_analysis (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_executed_id    UUID NOT NULL REFERENCES prompts_executed(id) ON DELETE CASCADE,
  brand_mentioned       BOOLEAN NOT NULL DEFAULT FALSE,
  brand_rank            INTEGER,
  brand_occurrences     INTEGER NOT NULL DEFAULT 0,
  sentiment_score       NUMERIC(4,3),       -- es: 0.750
  topics                TEXT[] NOT NULL DEFAULT '{}',
  competitors_found     TEXT[] NOT NULL DEFAULT '{}',
  avi_score             NUMERIC(5,2),       -- es: 73.50
  avi_components        JSONB,              -- { presence, rank, sentiment, stability }
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_response_analysis_prompt ON response_analysis(prompt_executed_id);

-- ============================================================
-- SOURCES
-- (URL/fonti citate dall'AI nelle risposte)
-- ============================================================

CREATE TABLE sources (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_executed_id  UUID NOT NULL REFERENCES prompts_executed(id) ON DELETE CASCADE,
  url                 TEXT,
  domain              TEXT,
  label               TEXT,
  source_type         source_type NOT NULL DEFAULT 'none',
  is_brand_owned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sources_prompt_id ON sources(prompt_executed_id);
CREATE INDEX idx_sources_domain    ON sources(domain);

-- ============================================================
-- COMPETITORS
-- ============================================================

CREATE TABLE competitors (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  is_manual             BOOLEAN NOT NULL DEFAULT FALSE,
  discovered_at_run_id  UUID REFERENCES analysis_runs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX idx_competitors_project_id ON competitors(project_id);

-- ============================================================
-- TOPICS
-- ============================================================

CREATE TABLE topics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  first_seen_run_id   UUID REFERENCES analysis_runs(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX idx_topics_project_id ON topics(project_id);

-- ============================================================
-- AVI HISTORY
-- (storico del punteggio nel tempo, una riga per run)
-- ============================================================

CREATE TABLE avi_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id           UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  avi_score        NUMERIC(5,2) NOT NULL,
  presence_score   NUMERIC(4,3) NOT NULL,
  rank_score       NUMERIC(4,3) NOT NULL,
  sentiment_score  NUMERIC(4,3) NOT NULL,
  stability_score  NUMERIC(4,3) NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, run_id)
);

CREATE INDEX idx_avi_history_project_id ON avi_history(project_id);
CREATE INDEX idx_avi_history_computed   ON avi_history(computed_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Ogni utente vede SOLO i propri dati
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts_executed  ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE avi_history       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"   ON profiles    FOR ALL USING (auth.uid() = id);
CREATE POLICY "own projects"  ON projects    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own queries"   ON queries     FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = queries.project_id AND user_id = auth.uid())
);
CREATE POLICY "own segments"  ON audience_segments FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = audience_segments.project_id AND user_id = auth.uid())
);
CREATE POLICY "own runs"      ON analysis_runs FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = analysis_runs.project_id AND user_id = auth.uid())
);
CREATE POLICY "own prompts"   ON prompts_executed FOR ALL USING (
  EXISTS (
    SELECT 1 FROM analysis_runs ar
    JOIN projects p ON p.id = ar.project_id
    WHERE ar.id = prompts_executed.run_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "own analyses"  ON response_analysis FOR ALL USING (
  EXISTS (
    SELECT 1 FROM prompts_executed pe
    JOIN analysis_runs ar ON ar.id = pe.run_id
    JOIN projects p ON p.id = ar.project_id
    WHERE pe.id = response_analysis.prompt_executed_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "own sources"   ON sources FOR ALL USING (
  EXISTS (
    SELECT 1 FROM prompts_executed pe
    JOIN analysis_runs ar ON ar.id = pe.run_id
    JOIN projects p ON p.id = ar.project_id
    WHERE pe.id = sources.prompt_executed_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "own competitors" ON competitors FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = competitors.project_id AND user_id = auth.uid())
);
CREATE POLICY "own topics"    ON topics FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = topics.project_id AND user_id = auth.uid())
);
CREATE POLICY "own avi"       ON avi_history FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = avi_history.project_id AND user_id = auth.uid())
);

-- ============================================================
-- AUTO updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
