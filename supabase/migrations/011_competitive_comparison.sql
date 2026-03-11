-- Competitive Comparison module (pilot)
CREATE TABLE competitive_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  brand_a TEXT NOT NULL,
  brand_b TEXT NOT NULL,
  driver TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'light',
  status TEXT NOT NULL DEFAULT 'pending',
  win_rate_a NUMERIC,
  win_rate_b NUMERIC,
  fmr_a NUMERIC,
  fmr_b NUMERIC,
  comp_score_a NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitive_analyses_project ON competitive_analyses(project_id);

CREATE TABLE competitive_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES competitive_analyses(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  query_text TEXT NOT NULL,
  model TEXT NOT NULL,
  run_number INTEGER NOT NULL,
  response_text TEXT,
  recommendation NUMERIC,
  first_mention TEXT,
  key_arguments TEXT[],
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitive_prompts_analysis ON competitive_prompts(analysis_id);

-- RLS
ALTER TABLE competitive_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own competitive_analyses" ON competitive_analyses FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = competitive_analyses.project_id AND user_id = auth.uid())
);
CREATE POLICY "own competitive_prompts" ON competitive_prompts FOR ALL USING (
  EXISTS (
    SELECT 1 FROM competitive_analyses ca
    JOIN projects p ON p.id = ca.project_id
    WHERE ca.id = competitive_prompts.analysis_id AND p.user_id = auth.uid()
  )
);
