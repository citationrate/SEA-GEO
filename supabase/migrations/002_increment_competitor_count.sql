-- Add mention_count column if not exists
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 0;

-- Add unique constraint for upsert on competitors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'competitors_project_id_name_key'
  ) THEN
    ALTER TABLE competitors ADD CONSTRAINT competitors_project_id_name_key UNIQUE (project_id, name);
  END IF;
END $$;

-- Add unique constraint for upsert on sources
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sources_project_id_domain_key'
  ) THEN
    -- Add project_id and run_id columns to sources if not exists
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
    ALTER TABLE sources ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES analysis_runs(id);
    ALTER TABLE sources ADD CONSTRAINT sources_project_id_domain_key UNIQUE (project_id, domain);
  END IF;
END $$;

-- Function to increment competitor mention count
CREATE OR REPLACE FUNCTION increment_competitor_count(p_project_id UUID, p_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE competitors SET mention_count = mention_count + 1
  WHERE project_id = p_project_id AND name = p_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
