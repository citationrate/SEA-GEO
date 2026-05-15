-- Soft delete per queries.
--
-- Motivazione: prompts_executed.query_id ha FK senza ON DELETE CASCADE verso
-- queries(id) (vedi 001_initial_schema.sql:144). Conseguenza: ogni query che
-- è stata usata in almeno una run non può essere DELETE-ata fisicamente —
-- l'utente clicca "Elimina" e l'operazione torna errore (foreign_key_violation
-- 23503). Cancellare fisicamente con CASCADE farebbe peggio: cancellerebbe
-- anche prompts_executed → response_analysis → la storia di quella run è
-- persa.
--
-- Soluzione standard: soft delete, identico al pattern già usato per `runs`
-- (007_soft_delete_runs.sql) e `projects` (005_soft_delete_projects.sql).
-- L'API DELETE marca la riga; le viste utente filtrano deleted_at IS NULL;
-- gli storici (run detail page, export) continuano a leggere il testo della
-- query anche dopo la "cancellazione".

ALTER TABLE queries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index parziale: la stragrande maggioranza delle query NON è deleted, quindi
-- ottimizziamo le query "attive" (filtro WHERE deleted_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_queries_active_by_project
  ON queries(project_id)
  WHERE deleted_at IS NULL;
