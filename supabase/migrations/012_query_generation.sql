-- Add structured query generation metadata to queries table
ALTER TABLE queries ADD COLUMN IF NOT EXISTS set_type TEXT DEFAULT 'manual';
-- 'generale', 'verticale', 'persona', 'manual'
ALTER TABLE queries ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT NULL;
-- 'A', 'B', 'C'
ALTER TABLE queries ADD COLUMN IF NOT EXISTS funnel TEXT DEFAULT NULL;
-- 'TOFU', 'MOFU'
ALTER TABLE queries ADD COLUMN IF NOT EXISTS persona_mode TEXT DEFAULT NULL;
-- 'demographic', 'decision_drivers'
ALTER TABLE queries ADD COLUMN IF NOT EXISTS persona_id UUID DEFAULT NULL;

-- Store generation inputs for reproducibility
CREATE TABLE IF NOT EXISTS query_generation_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  mercato TEXT,
  use_cases TEXT[] DEFAULT '{}',
  criteri TEXT[] DEFAULT '{}',
  must_have TEXT[] DEFAULT '{}',
  vincoli TEXT,
  obiezioni TEXT,
  linguaggio_mercato TEXT,
  ruolo TEXT,
  dimensione_azienda TEXT,
  personas_enabled BOOLEAN DEFAULT FALSE,
  personas JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
