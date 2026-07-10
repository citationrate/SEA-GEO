-- 044: Argomenti — livello intermedio tra Progetto e Run.
-- Gerarchia: Progetto → Argomento → Run
-- Ogni argomento raggruppa query e run per un topic specifico
-- (es. "Stivaletti Chelsea", "Scarpe eleganti da ufficio").

-- 1. Tabella argomenti
CREATE TABLE argomenti (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_argomenti_project_id ON argomenti(project_id);

CREATE TRIGGER trg_argomenti_updated_at
  BEFORE UPDATE ON argomenti FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. RLS (stessa logica di queries/segments: visibilità via ownership progetto)
ALTER TABLE argomenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own argomenti" ON argomenti FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = argomenti.project_id AND user_id = auth.uid())
);

-- 3. FK su queries (nullable per ora, diventerà NOT NULL dopo backfill)
ALTER TABLE queries ADD COLUMN argomento_id UUID REFERENCES argomenti(id);
CREATE INDEX idx_queries_argomento_id ON queries(argomento_id);

-- 4. FK su analysis_runs (nullable per ora)
ALTER TABLE analysis_runs ADD COLUMN argomento_id UUID REFERENCES argomenti(id);
CREATE INDEX idx_runs_argomento_id ON analysis_runs(argomento_id);

-- 5. Backfill: crea un Argomento "Generale" per ogni progetto esistente
INSERT INTO argomenti (project_id, name, description)
SELECT id, 'Generale', 'Argomento predefinito'
FROM projects
WHERE deleted_at IS NULL;

-- 6. Backfill: assegna tutte le query esistenti al loro Argomento "Generale"
UPDATE queries q
SET argomento_id = a.id
FROM argomenti a
WHERE a.project_id = q.project_id
  AND a.name = 'Generale';

-- 7. Backfill: assegna tutte le run esistenti al loro Argomento "Generale"
UPDATE analysis_runs ar
SET argomento_id = a.id
FROM argomenti a
WHERE a.project_id = ar.project_id
  AND a.name = 'Generale';

-- 8. Dopo backfill, rendi NOT NULL
ALTER TABLE queries ALTER COLUMN argomento_id SET NOT NULL;
ALTER TABLE analysis_runs ALTER COLUMN argomento_id SET NOT NULL;
