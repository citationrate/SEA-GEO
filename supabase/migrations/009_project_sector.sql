ALTER TABLE projects
ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_type TEXT DEFAULT 'manufacturer';

ALTER TABLE competitor_mentions
ADD COLUMN IF NOT EXISTS competitor_type TEXT DEFAULT 'direct';
