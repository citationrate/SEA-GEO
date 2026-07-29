-- Alias/abbreviazioni del brand per il rilevamento menzioni (es. "P&G" per
-- "Procter & Gamble"). Colonna additiva e opzionale: se assente, l'estrattore
-- usa solo il nome brand + il recupero semantico. Nessun default distruttivo.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brand_aliases text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN projects.brand_aliases IS
  'Alias/abbreviazioni note del brand usate dall''estrattore per il match menzioni (es. {"P&G","Procter and Gamble"}).';
